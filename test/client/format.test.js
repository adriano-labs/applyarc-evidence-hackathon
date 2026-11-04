import { describe, expect, it } from 'vitest';
import { formatMs, formatTokens, formatUsd, summariseReceipts } from '../../client/src/lib/format.js';

describe('format helpers', () => {
  it('formats US dollars for tiny model costs and the cap', () => {
    expect(formatUsd(0)).toBe('$0.00');
    expect(formatUsd(0.0042)).toBe('$0.0042');
    expect(formatUsd(0.04217)).toBe('$0.042');
    expect(formatUsd(1.5)).toBe('$1.50');
    expect(formatUsd(null)).toBe('not reported');
  });

  it('formats durations', () => {
    expect(formatMs(840)).toBe('840 ms');
    expect(formatMs(6200)).toBe('6.2 s');
    expect(formatMs(61000)).toBe('1 min 1 s');
    expect(formatMs(null)).toBe('—');
  });

  it('formats token counts with thousands separators', () => {
    expect(formatTokens(950)).toBe('950');
    expect(formatTokens(12345)).toBe('12,345');
  });

  it('summarises receipts into the drawer’s one closed line', () => {
    const receipts = [
      { step: 'extract', provider: 'compatible', model: 'muse-spark-open', costUsd: 0.003, totalMs: 4000, toolCalls: [{}, {}] },
      { step: 'draft', provider: 'compatible', model: 'muse-spark-open', costUsd: 0.0012, totalMs: 2200, toolCalls: [{}] },
      { step: 'repair', provider: 'compatible', model: 'muse-spark-open', costUsd: null, totalMs: 1000, toolCalls: [], error: 'cut' },
    ];
    expect(summariseReceipts(receipts)).toEqual({ steps: 3, toolCalls: 3, failed: 1, totalMs: 7200, costUsd: 0.0042, costComplete: false, models: ['muse-spark-open'] });
    expect(summariseReceipts([])).toEqual({ steps: 0, toolCalls: 0, failed: 0, totalMs: 0, costUsd: 0, costComplete: true, models: [] });
    // The loop's recorded decisions sit beside the receipts but are not model steps.
    const stage = { kind: 'stage', flow: 'draft', label: 'The evidence check refused 1 sentence; asking for a fix', at: '2026-11-03T10:00:00.000Z' };
    expect(summariseReceipts([receipts[0], stage, receipts[1]])).toEqual({ steps: 2, toolCalls: 3, failed: 0, totalMs: 6200, costUsd: 0.0042, costComplete: true, models: ['muse-spark-open'] });
    expect(summariseReceipts([stage])).toEqual({ steps: 0, toolCalls: 0, failed: 0, totalMs: 0, costUsd: 0, costComplete: true, models: [] });
  });
});
