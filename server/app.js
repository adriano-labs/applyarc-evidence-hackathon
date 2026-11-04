// HTTP routes. Plain actions answer JSON; model steps stream NDJSON progress
// events and end with the new workspace.
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { stream } from 'hono/streaming';
import { setCookie } from 'hono/cookie';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { refuse } from './domain/errors.js';
import { preparedWorkspace } from './domain/prepared.js';
import { createWorkspace } from './domain/workspace.js';
import { checkLanguage } from './domain/languages.js';
import { verifyRun } from './domain/verifyRun.js';
import { actions, agentActions } from './flows.js';
import { toHttpError } from './http/errors.js';
import { identify, VISITOR_COOKIE } from './http/user.js';
import { createReceiptLog } from './receipts.js';
import { createStore } from './store/jsonFile.js';
import { viewOf } from './view.js';
import { overCeiling, workspaceMode } from './http/allowance.js';

const CEILING = 'This visit has used its live Meta allowance. Press Start again to continue with Ellie’s or Ana’s labelled sample.';
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";

// prepared: Ellie's saved key-moment state, the default; preparedFor: other samples' saved states by id.
export function createApp({ dataDir, form, forms, agent, ledger = null, trustEasyAuth = false, visitorCookie = false, sample = null, samples = [], fallback = null, visitorCapUsd, visitorIdsPerIpPerDay = 50, voice = null, prepared = null, preparedFor = {} }) {
  const appForms = forms ?? (form ? [form] : []);
  const fixtureNotes = new Set([sample, ...samples.filter((s) => !s.liveOnly)].map((s) => s?.notes?.trim()).filter(Boolean));
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
        // The loop's own decisions (a refused sentence, a second draft), kept apart from the costed receipts.
        stages: createReceiptLog(join(dataDir, 'users', id, 'stages.jsonl')),
      });
    }
    return stores.get(id);
  };

  // On the fixture once a hosted visitor has used their live allowance (decided once per workspace).
  const onFixture = (user) => Boolean(fallback) && workspaceMode({ receipts: user.receipts.list(), createdAt: user.store.read().createdAt, capUsd: visitorCapUsd, ledgerLeftUsd: ledger?.summary().remainingUsd }) === 'fixture';
  const modeFor = (user) => (onFixture(user) ? { ...fallback.provider, label: 'Fixture: the live Meta allowance for this demo is used up', fallbackReason: 'live-allowance-unavailable' } : agent.provider);
  // Checked before every live call. It counts all this visitor's receipts, so Start again cannot reset it.
  const refuseOverCeiling = (user) => {
    if (overCeiling(user.receipts.list(), visitorCapUsd)) throw Object.assign(new Error(CEILING), { code: 'limit' });
  };
  // A bundled sample's clip names its sample, whose own names and places go to Meta as keywords.
  const keywordsFor = (sampleId) => {
    if (sampleId === undefined) return [];
    const found = samples.find((s) => s.id === sampleId);
    if (!found) refuse('invalid', 'There is no such sample.');
    return found.voiceKeywords ?? [];
  };

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
  // The ingress appends the real client address last; any earlier X-Forwarded-For entry is the client's own claim.
  const newVisitorAllowed = (c) => {
    const key = `${(c.req.header('x-forwarded-for') ?? '').split(',').at(-1).trim() || 'unknown'}|${new Date().toISOString().slice(0, 10)}`;
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
      refuseOverCeiling(user);
      const started = Date.now();
      const record = ({ durationMs, costUsd, model, host, hint, keywords }) => user.receipts.append({
        step: 'transcribe', flow: 'voice', provider: 'meta', isMeta: true, model, host, turns: 0, attempts: 1, requestIds: [], toolCalls: [],
        usage: { input: 0, cached: 0, output: 0, reasoning: 0 }, costUsd, audioMs: durationMs, totalMs: Date.now() - started, at: new Date().toISOString(),
        ...(hint ? { languageBias: hint } : {}), ...(keywords ? { keywords } : {}),
      });
      // The language the applicant chose, if any, goes to Meta as a hint; a sample's clip adds its keywords.
      const language = checkLanguage(c.req.query('language'));
      const keywords = keywordsFor(c.req.query('sample'));
      // A recording with no words in it is still charged, so it gets a receipt before the refusal.
      const heard = await voice.transcribe(new Uint8Array(await c.req.arrayBuffer()), { callId: randomUUID(), language, keywords }).catch((e) => { if (e.heard) record(e.heard); throw e; });
      record(heard);
      return c.json({ text: heard.text, durationMs: heard.durationMs, model: heard.model, ...(heard.hint ? { languageBias: heard.hint } : {}), ...(heard.keywords ? { keywords: heard.keywords } : {}) });
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
  // Only what this workspace did: Start again starts the drawer at zero (the log keeps everything).
  // Receipts and the loop's recorded decisions, in the order they happened.
  const recordsOf = (user, { createdAt }) => [...user.receipts.list(), ...user.stages.list()].filter((r) => r.at >= createdAt).sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  app.get('/api/receipts', (c) => {
    try {
      const user = userOf(c);
      return c.json({ receipts: recordsOf(user, user.store.read()), mode: modeFor(user), budget: publicBudget() });
    } catch (e) { return fail(c, e); }
  });
  // Verify this run: the saved workspace and its records re-checked by code. Read-only, no model call.
  app.get('/api/verify', (c) => {
    try { const user = userOf(c); const ws = user.store.read(); c.header('cache-control', 'no-store'); return c.json({ revision: ws.revision, checks: verifyRun(ws, recordsOf(user, ws)) }); } catch (e) { return fail(c, e); }
  });
  app.post('/api/reset', async (c) => {
    try { const user = userOf(c); return c.json(payload(user, await user.store.reset())); } catch (e) { return fail(c, e); }
  });

  // Start at the key moment: the facts, documents and approvals a real model run saved become this
  // visitor's own fresh workspace, marked with what prepared them and when. The run's receipts stay
  // out of their log, so nothing is charged. Registered before the generic action route, so it wins.
  app.post('/api/actions/startPrepared', async (c) => {
    try {
      const user = userOf(c);
      const { sampleId } = await c.req.json().catch(() => ({}));
      const own = sampleId !== undefined && sampleId !== 'ellie';
      if (own && !Object.hasOwn(preparedFor, String(sampleId))) refuse('invalid', 'There is no such sample.');
      const saved = own ? preparedFor[sampleId] : prepared;
      if (!saved || modeFor(user).id === 'fixture') refuse('invalid', 'Starting at the key moment needs the live model.');
      if (user.store.read().applicant.sources.length) refuse('invalid', 'Press Start again first.');
      return c.json(payload(user, await user.store.reset(() => preparedWorkspace(saved))));
    } catch (e) { return fail(c, e); }
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
        if (event.type === 'stage' && event.decision) user.stages.append({ kind: 'stage', flow: c.req.param('name'), label: event.label, at: new Date().toISOString() });
        write(event);
      };
      try {
        const fixture = onFixture(user);
        // The fixture only knows its samples' written notes, so other notes cannot run on it.
        if (fixture && user.store.read().applicant.sources.some((src) => src.kind === 'notes' && !fixtureNotes.has(src.text.trim()))) {
          throw Object.assign(new Error('You have used this demo’s live Meta allowance. Ellie’s sample and Ana’s written note still run on the hand-written fixture.'), { code: 'limit' });
        }
        const runner = fixture ? fallback : agent;
        const scoped = runner.forUser ? runner.forUser(user.id) : runner;
        const { ws, result } = await user.store.update(input.revision, (w) => {
          if (!fixture) refuseOverCeiling(user); // as the step starts, after any queued step has added its cost
          return run(w, input, scoped, emit);
        });
        await write({ type: 'done', ...payload(user, ws, result) });
      } catch (e) {
        await write({ type: 'error', ...httpError(e).body });
      }
    });
  });

  return app;
}
