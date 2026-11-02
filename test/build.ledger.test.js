import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../server/build.js';

const state = async (app) => (await app.request('/api/state')).json();

describe('the spend ledger the app uses', () => {
  it('is the shared file SPEND_LEDGER_FILE names, with SPEND_CAP_USD as its cap', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'spend-')), 'meta-ledger.json');
    writeFileSync(file, JSON.stringify({ entries: [{ id: 'earlier-run', status: 'settled', reservedUsd: 20, chargedUsd: 12.5, at: '2026-10-27T09:00:00.000Z' }] }));
    const app = buildApp({ dataDir: mkdtempSync(join(tmpdir(), 'app-')), env: { PROVIDER: 'meta', META_API_KEY: 'k', SPEND_LEDGER_FILE: file, SPEND_CAP_USD: '130' } });
    expect((await state(app)).budget).toMatchObject({ capUsd: 130, spentUsd: 12.5 });
  });

  it('stays in the data folder when no shared file is named', async () => {
    const app = buildApp({ dataDir: mkdtempSync(join(tmpdir(), 'app-')), env: { PROVIDER: 'meta', META_API_KEY: 'k' } });
    expect((await state(app)).budget).toMatchObject({ capUsd: 2, spentUsd: 0 });
  });
});
