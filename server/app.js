// HTTP routes. Plain actions answer JSON; model steps stream NDJSON progress
// events and end with the new workspace.
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { stream } from 'hono/streaming';
import { setCookie } from 'hono/cookie';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { createWorkspace } from './domain/workspace.js';
import { actions, agentActions } from './flows.js';
import { toHttpError } from './http/errors.js';
import { identify, VISITOR_COOKIE } from './http/user.js';
import { createReceiptLog } from './receipts.js';
import { createStore } from './store/jsonFile.js';
import { viewOf } from './view.js';
import { workspaceMode } from './http/allowance.js';

const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";

export function createApp({ dataDir, form, forms, agent, ledger = null, trustEasyAuth = false, visitorCookie = false, sample = null, samples = [], fallback = null, visitorCapUsd, visitorIdsPerIpPerDay = 50, voice = null }) {
  const appForms = forms ?? (form ? [form] : []);
  const defaultForm = appForms[0] ?? form;
  const app = new Hono();
  const stores = new Map();
  const newVisitorCounts = new Map();
  const userOf = (c) => {
    const id = c.get('userId');
    if (!id) throw Object.assign(new Error('Sign in to continue.'), { code: 'not-found' });
    if (!stores.has(id)) {
      stores.set(id, {
        id,
        store: createStore({ file: join(dataDir, 'users', id, 'workspace.json'), seed: () => createWorkspace({ form: structuredClone(defaultForm) }) }),
        receipts: createReceiptLog(join(dataDir, 'users', id, 'receipts.jsonl')),
      });
    }
    return stores.get(id);
  };

  // On the fixture once a hosted visitor has used their live allowance (decided once per workspace).
  const onFixture = (user) => Boolean(fallback) && workspaceMode({ receipts: user.receipts.list(), createdAt: user.store.read().createdAt, capUsd: visitorCapUsd, ledgerLeftUsd: ledger?.summary().remainingUsd }) === 'fixture';
  const modeFor = (user) => (onFixture(user) ? { ...fallback.provider, label: 'Fixture: the live Meta allowance for this demo is used up' } : agent.provider);

  // Visitors see the demo's totals only: the list of calls (everyone's) stays on the server.
  const publicBudget = () => {
    if (!ledger) return null;
    const { entries, ...totals } = ledger.summary();
    return totals;
  };
  const payload = (user, ws, result) => ({ workspace: ws, view: viewOf(ws), result, mode: modeFor(user), budget: publicBudget(), voice: Boolean(voice) && !onFixture(user), working: Boolean(user.store.working?.()) });
  const httpError = (error) => {
    const mapped = toHttpError(error);
    if (mapped.status === 500) console.error('Unexpected error', error);
    return mapped;
  };
  const fail = (c, error) => { const { status, body } = httpError(error); return c.json(body, status); };

  app.use('*', async (c, next) => {
    await next();
    c.header('content-security-policy', CSP);
    c.header('x-content-type-options', 'nosniff');
    c.header('referrer-policy', 'no-referrer');
    c.header('cross-origin-opener-policy', 'same-origin');
  });
  // A network may start only so many new visitors a day; judges may share one address, so the limit is generous.
  const newVisitorAllowed = (c) => {
    const key = `${(c.req.header('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'}|${new Date().toISOString().slice(0, 10)}`;
    const count = newVisitorCounts.get(key) ?? 0;
    if (count >= visitorIdsPerIpPerDay) return false;
    newVisitorCounts.set(key, count + 1);
    return true;
  };

  // Resolve who is asking once; a new hosted visitor gets their cookie on this response.
  app.use('/api/*', async (c, next) => {
    const { id, isNew } = identify(c, { trustEasyAuth, visitorCookie });
    if (isNew) {
      if (!newVisitorAllowed(c)) return c.json({ error: { code: 'limit', message: 'Too many new visits from this network today. Open the link in the same browser, or try again tomorrow.' } }, 429);
      setCookie(c, VISITOR_COOKIE, id, { httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: 7 * 24 * 3600 });
    }
    c.set('userId', id);
    await next();
  });
  // A spoken note: Meta Voice Transcribe turns the recording into text the applicant
  // checks. Added before the 100 KB text limit, with its own limit for about 3 minutes.
  app.post('/api/voice', bodyLimit({ maxSize: 6 * 1024 * 1024, onError: (c) => c.json({ error: { code: 'invalid', message: 'Keep a spoken note under 3 minutes.' } }, 413) }), async (c) => {
    try {
      if (!voice) throw Object.assign(new Error('Spoken notes need the live Meta model.'), { code: 'not-found' });
      const user = userOf(c);
      user.store.ensure(); // saved before its first receipt, so "What Meta did" lists it
      if (onFixture(user)) throw Object.assign(new Error('You have used this demo’s live Meta allowance. Type your notes instead.'), { code: 'limit' });
      const started = Date.now();
      const { text, durationMs, costUsd, model } = await voice.transcribe(new Uint8Array(await c.req.arrayBuffer()), { callId: randomUUID() });
      user.receipts.append({
        step: 'transcribe', flow: 'voice', provider: 'meta', isMeta: true, model, turns: 0, attempts: 1, requestIds: [], toolCalls: [],
        usage: { input: 0, cached: 0, output: 0, reasoning: 0 }, costUsd, audioMs: durationMs, totalMs: Date.now() - started, at: new Date().toISOString(),
      });
      return c.json({ text, durationMs });
    } catch (e) { return fail(c, e); }
  });
  app.use('/api/*', bodyLimit({ maxSize: 100 * 1024, onError: (c) => c.json({ error: { code: 'invalid', message: 'That is too much text for one request.' } }, 413) }));

  app.get('/api/state', (c) => {
    try { const user = userOf(c); c.header('cache-control', 'no-store'); c.header('pragma', 'no-cache'); return c.json(payload(user, user.store.read())); } catch (e) { return fail(c, e); }
  });
  app.get('/api/sample', (c) => c.json(sample ?? {}));
  app.get('/api/forms', (c) => {
    try {
      const ws = userOf(c).store.read();
      const currentId = ws.application?.form?.id;
      const formsList = appForms.map((f) => ({
        id: f.id,
        company: f.company,
        role: f.role,
        url: f.url,
        fetchedAt: f.snapshot?.fetchedAt,
        current: f.id === currentId,
      }));
      return c.json({ forms: formsList });
    } catch (e) { return fail(c, e); }
  });
  app.get('/api/receipts', (c) => {
    try {
      // Only what this workspace did: Start again starts the drawer at zero (the log keeps everything).
      const user = userOf(c);
      const { createdAt } = user.store.read();
      const receipts = user.receipts.list().filter((r) => r.at >= createdAt);
      return c.json({ receipts, mode: modeFor(user), budget: publicBudget() });
    } catch (e) { return fail(c, e); }
  });
  app.post('/api/reset', async (c) => {
    try { const user = userOf(c); return c.json(payload(user, await user.store.reset())); } catch (e) { return fail(c, e); }
  });

  app.post('/api/actions/:name', async (c) => {
    const action = actions[c.req.param('name')];
    if (!action) return c.json({ error: { code: 'not-found', message: 'Unknown action.' } }, 404);
    try {
      const input = await c.req.json();
      const user = userOf(c);
      const liveModel = modeFor(user).id !== 'fixture';
      const { ws, result } = await user.store.update(input.revision, (w) => action(w, input, { forms: appForms, samples, liveModel }));
      return c.json(payload(user, ws, result));
    } catch (e) { return fail(c, e); }
  });

  app.post('/api/run/:name', async (c) => {
    const run = agentActions[c.req.param('name')];
    if (!run) return c.json({ error: { code: 'not-found', message: 'Unknown step.' } }, 404);
    let user, input;
    try { user = userOf(c); input = await c.req.json(); } catch (e) { return fail(c, e); }
    c.header('content-type', 'application/x-ndjson; charset=utf-8');
    c.header('cache-control', 'no-store');
    return stream(c, async (out) => {
      const started = Date.now();
      const write = (event) => out.write(`${JSON.stringify({ ...event, ms: Date.now() - started })}\n`);
      const emit = (event) => {
        if (event.type === 'receipt') user.receipts.append({ ...event.receipt, flow: c.req.param('name'), at: new Date().toISOString() });
        write(event);
      };
      try {
        const fixture = onFixture(user);
        // The fixture only knows Ellie's sample, so other notes cannot run on it.
        if (fixture && user.store.read().applicant.sources.some((src) => src.kind === 'notes' && src.text.trim() !== sample?.notes?.trim())) {
          throw Object.assign(new Error('You have used this demo’s live Meta allowance. Ellie’s sample still runs on the hand-written fixture.'), { code: 'limit' });
        }
        const runner = fixture ? fallback : agent;
        const scoped = runner.forUser ? runner.forUser(user.id) : runner;
        const { ws, result } = await user.store.update(input.revision, (w) => run(w, input, scoped, emit));
        await write({ type: 'done', ...payload(user, ws, result) });
      } catch (e) {
        await write({ type: 'error', ...httpError(e).body });
      }
    });
  });

  return app;
}
