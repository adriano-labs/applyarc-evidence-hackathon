// What the API shows of the spend ledger: the demo's totals only. The list of
// calls stays on the server, so no visitor sees another visitor's activity.
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../server/build.js';

describe('the budget the API returns', () => {
  it('carries the totals and never the ledger entries', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'budget-'));
    const file = join(dataDir, 'ledger.json');
    writeFileSync(file, JSON.stringify({ entries: [{ id: 'someone-else', status: 'settled', reservedUsd: 0.2, chargedUsd: 0.1, at: '2026-10-27T09:00:00.000Z' }] }));
    const app = buildApp({ dataDir, env: { PROVIDER: 'meta', META_API_KEY: 'k', SPEND_LEDGER_FILE: file, SPEND_CAP_USD: '40' } });
    for (const path of ['/api/state', '/api/receipts']) {
      const { budget } = await (await app.request(path)).json();
      expect(budget).toEqual({ capUsd: 40, spentUsd: 0.1, reservedUsd: 0, remainingUsd: 39.9 });
    }
  });
});
