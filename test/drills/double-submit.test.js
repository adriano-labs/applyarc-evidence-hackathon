// @vitest-environment node
// Failure drill: the same action sent twice at once, as a double click would. One is saved, the
// other is refused as stale with a plain message, and nothing in the workspace is doubled.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../../server/build.js';

const app = () => buildApp({ dataDir: mkdtempSync(join(tmpdir(), 'double-submit-')), env: {} });
const post = (server, name, body) => server.request(`/api/actions/${name}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const state = async (server) => (await server.request('/api/state')).json();

async function twiceAtOnce(server, name, body) {
  const replies = await Promise.all([post(server, name, body), post(server, name, body)]);
  return Promise.all(replies.map(async (r) => ({ status: r.status, body: await r.json() })));
}
const refusedAsStale = (replies) => {
  expect(replies.map((r) => r.status).sort()).toEqual([200, 409]);
  expect(replies.find((r) => r.status === 409).body.error).toMatchObject({ code: 'stale', message: 'This changed in another tab. Showing the latest.' });
};

describe('a double submit', () => {
  it('saves a note sent twice at once only once', async () => {
    const server = app();
    const first = await (await post(server, 'notes', { revision: (await state(server)).workspace.revision, text: 'I built a GPU job runner with three classmates.' })).json();
    refusedAsStale(await twiceAtOnce(server, 'notes', { revision: first.workspace.revision, text: 'I also wrote the Helm change.' }));
    const sources = (await state(server)).workspace.applicant.sources;
    expect(sources.map((s) => s.text)).toEqual(['I built a GPU job runner with three classmates.', 'I also wrote the Helm change.']);
  });

  it('starts Ellie’s sample pressed twice at once only once', async () => {
    const server = app();
    refusedAsStale(await twiceAtOnce(server, 'startSample', { revision: (await state(server)).workspace.revision, sampleId: 'ellie' }));
    const { workspace } = await state(server);
    expect(workspace.applicant.sources).toHaveLength(1);
    expect(workspace.applicant.name).toBe('Ellie');
  });
});
