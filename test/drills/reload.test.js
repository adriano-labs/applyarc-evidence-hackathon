// @vitest-environment node
// Failure drill: a judge reloads the page. The same cookie brings back exactly the saved workspace;
// a browser without it gets a fresh one, and the first judge's work is still theirs.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { apiClient } from '../../scripts/journey.mjs';
import { buildApp } from '../../server/build.js';

const app = () => buildApp({ dataDir: mkdtempSync(join(tmpdir(), 'reload-')), env: { VISITOR_COOKIE: '1' } });
const cookieOf = (res) => /ae_visitor=[^;,\s]+/.exec(res.headers.get('set-cookie') ?? '')?.[0] ?? null;
const stateWith = async (server, cookie) => (await server.request('/api/state', { headers: cookie ? { cookie } : {} })).json();

async function withFacts(server) {
  const cookie = cookieOf(await server.request('/api/state'));
  const api = apiClient((method, path, body) => server.request(path, { method, headers: { cookie, 'content-type': 'application/json' }, body: body && JSON.stringify(body) }));
  const ellie = await api.get('/api/sample');
  let s = await api.act('notes', { text: ellie.notes });
  s = await api.run('read', { sourceId: s.result.id });
  s = await api.act('confirmFacts', { factIds: s.result.accepted });
  return { cookie, workspace: s.workspace };
}

describe('a reload', () => {
  it('returns the same saved workspace for the same cookie', async () => {
    const server = app();
    const { cookie, workspace } = await withFacts(server);
    expect(workspace.applicant.facts.filter((f) => f.status === 'confirmed').length).toBeGreaterThan(0);
    expect((await stateWith(server, cookie)).workspace).toEqual(workspace);
  });

  it('gives a browser without the cookie a fresh workspace, and leaves the first one as it was', async () => {
    const server = app();
    const { cookie, workspace } = await withFacts(server);
    const other = await server.request('/api/state');
    expect(cookieOf(other)).not.toBe(cookie);
    expect((await other.json()).workspace.applicant.sources).toEqual([]);
    expect((await stateWith(server, cookie)).workspace).toEqual(workspace);
  });
});
