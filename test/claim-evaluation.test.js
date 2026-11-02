import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { baselinePrompt, evaluate, makeReviewer, score } from '../scripts/evaluate-claims.mjs';

const corpus = JSON.parse(readFileSync(new URL('../fixtures/claim-evaluation.json', import.meta.url)));
const answer = (cases) => ({ decisions: cases.map((c) => ({ id: c.id, verdict: c.expectedSupported ? 'supported' : 'uncertain', reason: 'Stub decision, not model proof.' })) });

describe('paired claim evaluation', () => {
  it('requires live opt-in and has a safe help path without credentials', () => {
    for (const [args, status] of [[['--help'], 0], [[], 1], [['--run-live'], 1]]) {
      const result = spawnSync(process.execPath, ['scripts/evaluate-claims.mjs', ...args], { env: { PATH: process.env.PATH, PROVIDER: 'fixture' }, encoding: 'utf8' });
      expect(result.status).toBe(status);
      expect(result.stdout + result.stderr).not.toContain('Bearer');
    }
  });

  it('freezes 12 distinct synthetic cases with balanced labels and explicit rationales', () => {
    expect(corpus.cases).toHaveLength(12);
    expect(new Set(corpus.cases.map((c) => c.id)).size).toBe(12);
    expect(corpus.cases.filter((c) => c.expectedSupported)).toHaveLength(6);
    for (const c of corpus.cases) {
      expect(typeof c.expectedSupported).toBe('boolean');
      expect(c.rationale.length).toBeGreaterThan(20);
      expect(c.evidence.every((e) => e.source.includes(e.quote))).toBe(true);
    }
  });

  it('counterbalances call order, supplies identical evidence without labels and preserves ties', async () => {
    const calls = [];
    const runners = Object.fromEntries(['baseline', 'app'].map((name) => [name, async (claims) => {
      calls.push({ name, claims });
      return answer(corpus.cases.filter((c) => claims.some((x) => x.id === c.id)));
    }]));
    const report = await evaluate(corpus.cases, runners);
    expect(calls.map((c) => c.name)).toEqual(['baseline', 'app', 'app', 'baseline']);
    expect(calls[0].claims).toEqual(calls[1].claims);
    expect(calls[2].claims).toEqual(calls[3].claims);
    expect(JSON.stringify(calls)).not.toMatch(/expectedSupported|rationale/);
    expect(report.summaries.app.correct).toBe(12);
    expect(report.summaries.baseline.correct).toBe(12);
    expect(report.correctDifference).toBe(0);
  });

  it('counts malformed, duplicate and failed outputs as invalid, never successful rejection', async () => {
    const cases = corpus.cases.slice(0, 2);
    for (const response of [null, { decisions: [] }, { decisions: [{ id: cases[0].id, verdict: 'supported', reason: 'x' }, { id: cases[0].id, verdict: 'supported', reason: 'x' }] }]) {
      expect(score(cases, response)).toMatchObject({ correct: 0, invalid: 2, trueNegative: 0 });
    }
    const checkpoint = vi.fn();
    const report = await evaluate(cases, { app: async () => { throw Object.assign(new Error('secret'), { code: 'network' }); }, baseline: async () => answer(cases) }, checkpoint);
    expect(report.runs.filter((r) => r.method === 'app').every((r) => r.error === 'network')).toBe(true);
    expect(JSON.stringify(report)).not.toContain('secret');
    expect(checkpoint).toHaveBeenCalledTimes(4);
  });

  it('uses exactly the app model/schema/settings for both methods; only the review prompt differs', async () => {
    const bodies = [];
    const transport = { respond: async (body) => {
      bodies.push(body);
      return { response: { output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(answer(corpus.cases)) }] }] }, usage: {}, attempts: 1, requestId: 'stub', model: 'stub', costUsd: 0, timings: { firstEventMs: 1 } };
    } };
    const provider = { id: 'test', model: 'stub', effort: 'high' };
    const claims = corpus.cases.map(({ id, text, evidence }) => ({ id, text, evidence }));
    for (const method of ['baseline', 'app']) await makeReviewer(method, provider, transport)(claims, () => {});
    expect(bodies[0].input[0].content).toBe(baselinePrompt(claims));
    expect(bodies[0].input[0].content).not.toBe(bodies[1].input[0].content);
    const withoutPrompt = ({ input, ...rest }) => rest;
    expect(withoutPrompt(bodies[0])).toEqual(withoutPrompt(bodies[1]));
    expect(bodies[0].reasoning.effort).toBe('high');
    expect(bodies[0].max_output_tokens).toBe(6000);
  });
});
