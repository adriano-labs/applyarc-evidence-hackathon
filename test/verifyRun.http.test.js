// GET /api/verify: the visitor's own saved run, re-checked by code. Read-only, on the fixture
// journey and on the prepared key-moment workspace.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { apiClient, runJourney } from '../scripts/journey.mjs';
import { buildApp } from '../server/build.js';

const dir = () => mkdtempSync(join(tmpdir(), 'verify-'));
const requestFor = (app, headers = {}) => (method, path, body) => app.request(path, { method, headers: { 'content-type': 'application/json', ...headers }, body: body && JSON.stringify(body) });

describe('GET /api/verify', () => {
  it('passes Ellie’s fixture journey to the finish, says no model reviewed it, and changes nothing', async () => {
    const app = buildApp({ dataDir: dir(), env: {} });
    await runJourney(requestFor(app));
    const before = await (await app.request('/api/state')).json();
    const response = await app.request('/api/verify');
    expect(response.headers.get('cache-control')).toBe('no-store');
    const { revision, checks } = await response.json();
    expect(revision).toBe(before.workspace.revision);
    expect(checks.every((c) => c.pass)).toBe(true);
    expect(checks.find((c) => c.id === 'export').text).toBe('Export e1 is stamped NOT SUBMITTED and holds exactly the approved versions');
    expect(checks.find((c) => c.id === 'review').text).toBe('No model review on record: no live model has written document wording');
    expect((await (await app.request('/api/state')).json()).workspace).toEqual(before.workspace);
  });

  it('passes the prepared key-moment workspace before the visitor adds anything', async () => {
    const app = buildApp({ dataDir: dir(), env: { PROVIDER: 'meta', META_API_KEY: 'k', VISITOR_COOKIE: '1' } });
    const cookie = `ae_visitor=${/ae_visitor=([^;]+)/.exec((await app.request('/api/state')).headers.get('set-cookie'))[1]}`;
    const api = apiClient(requestFor(app, { cookie }));
    await api.act('startPrepared');
    const { checks } = await api.get('/api/verify');
    expect(checks.map((c) => [c.id, c.pass, c.count])).toEqual([
      ['quotes', true, 12], ['citations', true, 17], ['numbers', true, 17], ['approvals', true, 2], ['own', true, 1], ['export', true, 0], ['review', true, 17],
    ]);
  });
});
