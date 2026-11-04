import { describe, expect, it, vi } from 'vitest';
import { currentSourcePassages, currentSourceText } from '../../server/domain/sourceConflicts.js';
import { reviewClaims, reviewKey, reviewPrompt } from '../../server/agent/evidenceReview.js';
import { normalise } from '../../server/domain/text.js';

const historical = (quote, extra = {}) => ({ quote, sourceId: 's1', ...extra });
function workspace(text, quote = 'I found the fault.', history = []) {
  return { applicant: { sources: [{ id: 's1', kind: 'answer', text }], facts: [
    { id: 'f1', status: 'confirmed', sourceId: 's1', quote, history: [] },
    { id: 'f2', status: 'confirmed', sourceId: 's2', quote: 'Sam wrote the quota check.', history },
  ] } };
}
const source = (ws) => ws.applicant.sources[0];
const passages = (ws) => currentSourcePassages(ws, source(ws));
const claimant = (text = 'I located the fault.') => ({ kind: 'claim', text, factIds: ['f1'] });
const reviewer = () => vi.fn(async ({ claims }) => ({ decisions: claims.map(({ id }) => ({ id, verdict: 'supported', reason: 'Same action.' })) }));

describe('discontiguous active source passages', () => {
  it('keeps untouched ownership and negation, omitting only the historical quota span', () => {
    const text = 'This was a lab, not production. I found the fault. I wrote the Helm change. I wrote the quota check. We did not change production.';
    const ws = workspace(text, 'I found the fault.', [historical('I wrote the quota check.')]);
    expect(passages(ws)).toEqual(['This was a lab, not production. I found the fault. I wrote the Helm change.', 'We did not change production.']);
    expect(source(ws).text).toBe(text);
    expect(currentSourceText(ws, source(ws))).toBe('This was a lab, not production. I found the fault. I wrote the Helm change. [Superseded by the applicant’s explicit correction] We did not change production.');
  });

  it.each([
    ['Before. I wrote the runbook. I wrote the runbook. After.', ['I wrote the runbook.'], ['Before.', 'After.']],
    ['Before. I wrote the runbook and tested it. After.', ['I wrote the runbook', 'the runbook and tested it.'], ['Before.', 'After.']],
    ['Before. I wrote the runbook and tested it. After.', ['the runbook and tested it.', 'I wrote the runbook'], ['Before.', 'After.']],
    ['aaaaa', ['aaa'], []],
  ])('unions every repeated or overlapping occurrence in the original text', (text, removed, expected) => {
    expect(passages(workspace(text, 'Unrelated fact.', removed.map((quote) => historical(quote))))).toEqual(expected);
  });

  it('does not interpret marker-like applicant text as removal authority', () => {
    const kept = 'I documented “[Superseded by the applicant’s explicit correction]” and “[Removed by the applicant]” as literal UI examples.';
    const ws = workspace(`${kept} I wrote the quota check. I tested the change.`, 'I tested the change.', [historical('I wrote the quota check.')]);
    expect(passages(ws)).toEqual([normalise(kept), 'I tested the change.']);
  });

  it('uses the existing fact-status and source-history authority, including corrected then removed facts', () => {
    const ws = workspace('I found the fault. I wrote the quota check. I tested the release.', 'I found the fault.');
    ws.applicant.facts.push(
      { id: 'f3', status: 'proposed', history: [historical('I found the fault.')] },
      { id: 'f4', status: 'rejected', history: [historical('I found the fault.')] },
      { id: 'f5', status: 'confirmed', history: [historical('I found the fault.', { sourceId: 'other' })] },
      { id: 'f6', status: 'rejected', history: [historical('I wrote the quota check.'), historical('I tested the release.', { removed: true })] },
    );
    expect(passages(ws)).toEqual(['I found the fault.']);
  });

  it('normalises quote typography and whitespace consistently with current source removal', () => {
    const ws = workspace('I found the fault. I wrote the “quota”\n check. I tested it.', 'I found the fault.', [historical('I wrote the "quota" check.')]);
    expect(passages(ws)).toEqual(['I found the fault.', 'I tested it.']);
  });
});

describe('review only admits quotes inside one active passage', () => {
  it('sends ordered passages, preserves context and introduces no removal marker', async () => {
    const ws = workspace('In our lab, not production. I found the fault. I wrote the quota check. Sam tested it.', 'I found the fault.', [historical('I wrote the quota check.')]);
    const review = reviewer();
    const result = await reviewClaims(ws, [claimant()], { provider: { id: 'meta' }, review });
    expect(review.mock.calls[0][0].claims[0].evidence).toEqual([{
      from: 'the applicant’s answer to a question', quote: 'I found the fault.',
      sourcePassages: ['In our lab, not production. I found the fault.', 'Sam tested it.'],
    }]);
    expect(result.get(reviewKey(ws, claimant()))).toBeNull();
  });

  it.each(['withheld', 'empty', 'fully-removed', 'missing'])('fails closed for %s source context even on an exact quote', async (mode) => {
    const ws = workspace('I found the fault.');
    if (mode === 'withheld') source(ws).withheld = true;
    if (mode === 'empty') source(ws).text = '';
    if (mode === 'fully-removed') ws.applicant.facts[1].history = [historical('I found the fault.')];
    if (mode === 'missing') ws.applicant.sources = [];
    const review = reviewer(); const claim = claimant('I found the fault.');
    const result = await reviewClaims(ws, [claim], { provider: { id: 'meta' }, review });
    expect(review).not.toHaveBeenCalled();
    expect(result.get(reviewKey(ws, claim))).toEqual(expect.any(String));
  });

  it.each(['I tested production.', 'I tested the live service.'])('does not join a citation over a removal gap: %s', async (text) => {
    const ws = workspace('I tested the lab, not production.', 'I tested production.', [historical('the lab, not')]);
    const claim = claimant(text); const review = reviewer();
    const result = await reviewClaims(ws, [claim], { provider: { id: 'meta' }, review });
    expect(review).not.toHaveBeenCalled();
    expect(result.get(reviewKey(ws, claim))).toEqual(expect.any(String));
  });

  it('still accepts an intact confirmed exact quote without spending on model review', async () => {
    const ws = workspace('I found the fault. I wrote the quota check.', 'I found the fault.', [historical('I wrote the quota check.')]);
    const review = reviewer(); const claim = claimant('I found the fault.');
    const result = await reviewClaims(ws, [claim], { provider: { id: 'meta' }, review });
    expect(review).not.toHaveBeenCalled();
    expect(result.get(reviewKey(ws, claim))).toBeNull();
  });

  it('binds review reuse to passage boundaries and changed surrounding context', () => {
    const ws = workspace('I found the fault. Removed details. I tested it.', 'I found the fault.', [historical('Removed details.')]);
    const key = reviewKey(ws, claimant());
    const joined = structuredClone(ws); source(joined).text = 'I found the fault. I tested it.';
    expect(reviewKey(joined, claimant())).not.toBe(key);
    const changed = structuredClone(ws); source(changed).text = source(changed).text.replace('I tested it.', 'Sam tested it.');
    expect(reviewKey(changed, claimant())).not.toBe(key);
    ws.applicant.facts[1].history = [];
    expect(reviewKey(ws, claimant())).not.toBe(key);
  });

  it('replaces obsolete marker advice with discontiguous passage guidance while preserving review duties', () => {
    const prompt = reviewPrompt([]);
    expect(prompt).toContain('sourcePassages');
    expect(prompt).not.toContain('An application-inserted removal marker');
    expect(prompt).toMatch(/not.*join|do not.*concatenate/i);
    expect(prompt).toContain('actor AND action, negation');
    expect(prompt).toContain('uncertainty/intention versus completed work');
    expect(prompt).toContain('A kind: retention entry');
  });
});
