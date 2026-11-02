// Who is asking: Easy Auth when trusted, a private visitor cookie on the hosted demo
// (so a judge needs no sign-in), otherwise everyone is "local".
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../server/build.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const appWith = (env) => buildApp({ dataDir: mkdtempSync(join(tmpdir(), 'identity-')), env });
const visitorOf = (res) => /(?:^|;\s*|,\s*)ae_visitor=([^;,]+)/.exec(res.headers.get('set-cookie') ?? '')?.[1] ?? null;
const get = (app, headers = {}) => app.request('/api/state', { headers });
const addNotes = async (app, headers) => {
  const { workspace } = await (await get(app, headers)).json();
  return app.request('/api/actions/notes', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify({ revision: workspace.revision, text: 'I built a GPU job runner with three classmates.' }) });
};
const sourceCount = async (app, headers) => (await (await get(app, headers)).json()).workspace.applicant.sources.length;

describe('the hosted visitor cookie', () => {
  it('gives a first-time visitor a private id in a cookie, once', async () => {
    const app = appWith({ VISITOR_COOKIE: '1' });
    const first = await get(app);
    expect(first.status).toBe(200);
    const id = visitorOf(first);
    expect(id).toMatch(UUID);
    const cookie = first.headers.get('set-cookie');
    for (const attribute of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/', 'Max-Age=604800']) expect(cookie).toContain(attribute);
    const again = await get(app, { cookie: `ae_visitor=${id}` });
    expect(again.status).toBe(200);
    expect(again.headers.get('set-cookie')).toBeNull();
  });

  it('keeps each visitor’s workspace apart', async () => {
    const app = appWith({ VISITOR_COOKIE: '1' });
    const a = { cookie: `ae_visitor=${visitorOf(await get(app))}` };
    const b = { cookie: `ae_visitor=${visitorOf(await get(app))}` };
    expect(a.cookie).not.toBe(b.cookie);
    expect((await addNotes(app, a)).status).toBe(200);
    expect(await sourceCount(app, a)).toBe(1);
    expect(await sourceCount(app, b)).toBe(0);
  });

  it('replaces a malformed or foreign cookie with a fresh id', async () => {
    const app = appWith({ VISITOR_COOKIE: '1' });
    for (const bad of ['../../etc', 'local', '', 'x'.repeat(80)]) {
      const res = await get(app, { cookie: `ae_visitor=${bad}` });
      expect(res.status).toBe(200);
      expect(visitorOf(res)).toMatch(UUID);
    }
  });

  it('trusts Easy Auth over the cookie when told to, and sets no cookie then', async () => {
    const app = appWith({ VISITOR_COOKIE: '1', TRUST_EASY_AUTH: '1' });
    const judge = { 'x-ms-client-principal-id': 'judge-1' };
    const res = await addNotes(app, judge);
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toBeNull();
    expect(await sourceCount(app, judge)).toBe(1);
    const visitor = { cookie: `ae_visitor=${visitorOf(await get(app))}` };
    expect(await sourceCount(app, visitor)).toBe(0);
  });
});

describe('without the visitor cookie', () => {
  it('stays one local user and sets no cookie', async () => {
    const app = appWith({});
    const res = await addNotes(app, {});
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toBeNull();
    expect(await sourceCount(app, {})).toBe(1);
  });

  it('still asks for sign-in when only Easy Auth is trusted and no principal is sent', async () => {
    const app = appWith({ TRUST_EASY_AUTH: '1' });
    expect((await get(app)).status).toBe(404);
  });
});
