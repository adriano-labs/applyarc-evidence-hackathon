import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BudgetError, createLedger } from '../../server/agent/budget.js';

const file = () => join(mkdtempSync(join(tmpdir(), 'ledger-')), 'ledger.json');

describe('spend ledger', () => {
  it('reserves the worst case before a call and charges the real cost after it', () => {
    const ledger = createLedger({ file: file(), capUsd: 2 });
    ledger.reserve('call-1', 0.5);
    expect(ledger.summary()).toMatchObject({ capUsd: 2, spentUsd: 0, reservedUsd: 0.5, remainingUsd: 1.5 });
    ledger.settle('call-1', 0.01);
    expect(ledger.summary()).toMatchObject({ spentUsd: 0.01, reservedUsd: 0, remainingUsd: 1.99 });
  });

  it('refuses a reservation that would pass the cap, before anything is sent', () => {
    const ledger = createLedger({ file: file(), capUsd: 2 });
    ledger.reserve('call-1', 1.5);
    const error = (() => { try { ledger.reserve('call-2', 0.6); } catch (e) { return e; } })();
    expect(error).toBeInstanceOf(BudgetError);
    expect(error.code).toBe('cap');
    expect(error.message).toBe('Spend cap reached ($2.00). Nothing was sent.');
    expect(ledger.summary().reservedUsd).toBe(1.5);
  });

  it('releases a reservation when the provider refused the call before running it', () => {
    const ledger = createLedger({ file: file(), capUsd: 2 });
    ledger.reserve('call-1', 0.5);
    ledger.release('call-1');
    expect(ledger.summary()).toMatchObject({ spentUsd: 0, reservedUsd: 0, remainingUsd: 2 });
  });

  it('keeps the whole reservation charged when the outcome is unknown', () => {
    const ledger = createLedger({ file: file(), capUsd: 2 });
    ledger.reserve('call-1', 0.5);
    ledger.unknown('call-1');
    expect(ledger.summary()).toMatchObject({ spentUsd: 0.5, reservedUsd: 0, remainingUsd: 1.5 });
  });

  it('survives a restart, and a call still reserved at restart counts as unknown and charged', () => {
    const path = file();
    const first = createLedger({ file: path, capUsd: 2 });
    first.reserve('call-1', 0.25);
    first.settle('call-1', 0.1);
    first.reserve('call-2', 0.4);
    const second = createLedger({ file: path, capUsd: 2 });
    expect(second.summary()).toMatchObject({ spentUsd: 0.5, reservedUsd: 0, remainingUsd: 1.5 });
    expect(second.summary().entries.map((e) => [e.id, e.status])).toEqual([['call-1', 'settled'], ['call-2', 'unknown']]);
    expect(JSON.parse(readFileSync(path, 'utf8')).entries).toHaveLength(2);
  });

  it('charges the real cost even when it is above the reservation', () => {
    const ledger = createLedger({ file: file(), capUsd: 2 });
    ledger.reserve('call-1', 0.1);
    ledger.settle('call-1', 0.3);
    expect(ledger.summary().spentUsd).toBe(0.3);
  });

  it('refuses a duplicate id and a settlement of a call that is not reserved', () => {
    const ledger = createLedger({ file: file(), capUsd: 2 });
    ledger.reserve('call-1', 0.1);
    expect(() => ledger.reserve('call-1', 0.1)).toThrow(/already/);
    ledger.release('call-1');
    expect(() => ledger.settle('call-1', 0.1)).toThrow(/not reserved/);
    expect(() => ledger.unknown('nope')).toThrow(/not reserved/);
  });
});

describe('spend ledger safety', () => {
  it('fails closed on a corrupt ledger file instead of forgetting what was spent', async () => {
    const { writeFileSync } = await import('node:fs');
    const path = file();
    writeFileSync(path, '{"entries": [');
    expect(() => createLedger({ file: path, capUsd: 2 })).toThrow();
  });

  it('refuses an amount that is not a finite, non-negative number', () => {
    const ledger = createLedger({ file: file(), capUsd: 2 });
    for (const bad of [Number.NaN, -0.01, Number.POSITIVE_INFINITY, '0.1']) {
      expect(() => ledger.reserve(`r-${bad}`, bad)).toThrow(/amount/);
    }
    ledger.reserve('ok', 0.1);
    expect(() => ledger.settle('ok', Number.NaN)).toThrow(/amount/);
    expect(ledger.summary()).toMatchObject({ reservedUsd: 0.1, remainingUsd: 1.9 });
  });

  it('creates the ledger folder on first use', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'ledger-')), 'nested', 'deeper', 'ledger.json');
    createLedger({ file: path, capUsd: 1 }).reserve('a', 0.1);
    expect(JSON.parse(readFileSync(path, 'utf8')).entries).toHaveLength(1);
  });
});
