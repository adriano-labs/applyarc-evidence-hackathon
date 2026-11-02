import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { apiClient } from '../scripts/journey.mjs';
import { buildApp } from '../server/build.js';

describe('the receipts', () => {
  it('count only what this workspace did: Start again starts them at zero', async () => {
    const app = buildApp({ dataDir: mkdtempSync(join(tmpdir(), 'rc-')), env: {} });
    const api = apiClient((method, path, body) => app.request(path, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) }));
    await api.reset();
    const sample = await api.get('/api/sample');
    const state = await api.act('notes', { text: sample.notes });
    await api.run('read', { sourceId: state.result.id });
    expect((await api.get('/api/receipts')).receipts.map((r) => r.step)).toEqual(['extract']);
    await new Promise((r) => setTimeout(r, 5));
    await api.reset();
    expect((await api.get('/api/receipts')).receipts).toEqual([]);
  });
});
