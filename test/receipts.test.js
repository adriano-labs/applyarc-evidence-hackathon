import { appendFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { apiClient } from '../scripts/journey.mjs';
import { createApp } from '../server/app.js';
import { buildApp } from '../server/build.js';
import { createReceiptLog } from '../server/receipts.js';
import { form } from './helpers.js';

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

  it('keep the loop’s recorded decisions beside the receipts, in time order, apart from the costed steps', async () => {
    const agent = {
      provider: { id: 'fixture', label: 'Test' },
      async extract({ emit }) {
        emit({ type: 'stage', label: 'Reading your words' });
        emit({ type: 'receipt', receipt: { step: 'extract', provider: 'fixture', model: 'fixture', costUsd: 0, toolCalls: [] } });
        await new Promise((r) => setTimeout(r, 2));
        emit({ type: 'stage', decision: true, label: 'The evidence check refused 1 sentence; asking for a fix' });
        return { facts: [] };
      },
    };
    const app = createApp({ dataDir: mkdtempSync(join(tmpdir(), 'rc-')), form, agent });
    const api = apiClient((method, path, body) => app.request(path, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) }));
    const state = await api.act('notes', { text: 'I built the thing.' });
    await api.run('read', { sourceId: state.result.id });
    const { receipts } = await api.get('/api/receipts');
    expect(receipts.map((r) => (r.kind === 'stage' ? r.label : r.step))).toEqual(['extract', 'The evidence check refused 1 sentence; asking for a fix']);
    expect(receipts[1]).toMatchObject({ kind: 'stage', flow: 'read', at: expect.any(String) });
    expect(receipts[1]).not.toHaveProperty('costUsd');
  });

  it('skip a line cut short mid-append instead of losing the whole log', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'rc-')), 'receipts.jsonl');
    const log = createReceiptLog(file);
    log.append({ step: 'extract' });
    appendFileSync(file, '{"step":"dra');
    expect(log.list()).toEqual([{ step: 'extract' }]);
  });
});
