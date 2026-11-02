import { describe, expect, it } from 'vitest';
import { costOf, PRICES, worstCase } from '../../server/agent/pricing.js';

const usage = (input, cached, output, reasoning = 0) => ({
  input_tokens: input,
  input_tokens_details: { cached_tokens: cached },
  output_tokens: output,
  output_tokens_details: { reasoning_tokens: reasoning },
});

describe('pricing', () => {
  it('has Meta Muse Spark 1.3 at its published price per million tokens', () => {
    expect(PRICES['muse-spark-1.3']).toEqual({ input: 1.25, cached: 0.15, output: 4.25 });
  });

  it('charges cached input tokens at the cached rate', () => {
    expect(costOf('muse-spark-1.3', usage(1000, 400, 500))).toBeCloseTo((600 * 1.25 + 400 * 0.15 + 500 * 4.25) / 1e6, 12);
  });

  it('does not add reasoning tokens twice: they are already in output tokens', () => {
    expect(costOf('muse-spark-1.3', usage(0, 0, 1000, 800))).toBeCloseTo(1000 * 4.25 / 1e6, 12);
  });

  it('treats missing usage details as zero', () => {
    expect(costOf('muse-spark-1.3', { input_tokens: 1000, output_tokens: 0 })).toBeCloseTo(1000 * 1.25 / 1e6, 12);
  });

  it('prices the worst case with no cache hit and every output token used', () => {
    expect(worstCase('muse-spark-1.3', { inputTokens: 2000, maxOutputTokens: 1000 })).toBeCloseTo((2000 * 1.25 + 1000 * 4.25) / 1e6, 12);
  });

  it('refuses a model it has no price for, so the spend cap is never blind', () => {
    expect(() => costOf('mystery-model', usage(1, 0, 1))).toThrow(/No price for mystery-model/);
    expect(() => worstCase('mystery-model', { inputTokens: 1, maxOutputTokens: 1 })).toThrow(/No price/);
  });
});
