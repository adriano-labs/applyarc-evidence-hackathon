// One spend file for every Meta run: the cap holds across runs, not per run.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createLedger } from '../../server/agent/budget.js';

describe('a ledger shared by several runs', () => {
  it('sees what the other runs spent before it reserves', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'shared-')), 'ledger.json');
    const first = createLedger({ file, capUsd: 130 });
    const second = createLedger({ file, capUsd: 130 });
    first.reserve('a', 100);
    first.settle('a', 100);
    expect(() => second.reserve('b', 40)).toThrow('Spend cap reached ($130.00). Nothing was sent.');
    second.reserve('c', 20);
    expect(second.summary()).toMatchObject({ capUsd: 130, spentUsd: 100, reservedUsd: 20, remainingUsd: 10 });
    expect(first.summary()).toMatchObject({ spentUsd: 100, reservedUsd: 20 });
  });

  it('still settles its own call when another run started meanwhile and counted it as unknown', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'shared-')), 'ledger.json');
    const first = createLedger({ file, capUsd: 130 });
    first.reserve('a', 5);
    const second = createLedger({ file, capUsd: 130 });
    second.reserve('b', 1);
    first.settle('a', 0.25);
    expect(second.summary().entries.find((e) => e.id === 'a')).toMatchObject({ status: 'settled', chargedUsd: 0.25 });
  });
});
