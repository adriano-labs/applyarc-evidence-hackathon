import { describe, expect, it } from 'vitest';
import { acceptSuggestion, candidateFor, dismissSuggestion, finishSuggestion, prepareSuggestion } from '../server/domain/sentenceSuggestion.js';
import { reviewKey } from '../server/agent/evidenceReview.js';
import { approve } from '../server/domain/review.js';
import { draftedWorkspace } from './helpers.js';

const provider = { id: 'meta-test-double' };
const input = { docId: 'answer', segmentId: 'answer-1' };
const proposal = { outcome: 'revision', text: 'We used Kubernetes Jobs instead of Slurm.', factIds: ['f1'], reason: 'This states the choice directly.' };
const stamp = '2026-10-28T13:00:00.000Z';
async function setup() {
  const ws = await draftedWorkspace();
  approve(ws, 'answer', ws.application.documents.answer.revision);
  approve(ws, 'letter', ws.application.documents.letter.revision);
  return ws;
}
function offer(ws, response = proposal, supported = true) {
  const context = prepareSuggestion(ws, input, provider);
  const review = new Map([[reviewKey(ws, candidateFor(response) ?? {}), supported ? null : 'The evidence does not support this.']]);
  return finishSuggestion(ws, context, response, review, stamp);
}

describe('one-sentence suggestion boundary', () => {
  it('stores a reviewed proposal while preserving both documents and approvals', async () => {
    const ws = await setup();
    ws.application.documents.answer.segments[0].author = 'user';
    const before = structuredClone(ws.application);
    const { suggestion } = offer(ws);
    expect(suggestion).toMatchObject({ status: 'proposed', docId: 'answer', segmentId: 'answer-1', after: proposal.text, before: before.documents.answer.segments[0].text });
    expect(ws.application.documents).toEqual(before.documents);
    expect(ws.application.approvals).toEqual(before.approvals);
  });

  it('applies only after explicit acceptance and clears only the changed document approval', async () => {
    const ws = await setup();
    const before = structuredClone(ws.application);
    const { suggestion } = offer(ws);
    acceptSuggestion(ws, suggestion.id, stamp);
    expect(ws.application.documents.answer.segments[0]).toMatchObject({ id: 'answer-1', text: proposal.text, factIds: ['f1'], author: 'assisted' });
    expect(ws.application.documents.answer.segments.slice(1)).toEqual(before.documents.answer.segments.slice(1));
    expect(ws.application.documents.letter).toEqual(before.documents.letter);
    expect(ws.application.documents.answer.revision).toBe(before.documents.answer.revision + 1);
    expect(ws.application.approvals.answer).toBeNull();
    expect(ws.application.approvals.letter).toEqual(before.approvals.letter);
    expect(ws.application.lastSuggestion.before).toBe(suggestion.before);
    expect(ws.application.suggestion).toBeNull();
  });

  it('dismissal, refusal and unchanged wording preserve approvals and current text', async () => {
    for (const response of [{ outcome: 'refusal', text: '', factIds: [], reason: 'Your evidence says you tested it, not that you led it.' }, proposal]) {
      const ws = await setup();
      const before = structuredClone(ws.application);
      const { suggestion } = offer(ws, response, false);
      expect(suggestion.status).toBe('refused');
      await expect(() => acceptSuggestion(ws, suggestion.id)).toThrow();
      dismissSuggestion(ws, suggestion.id);
      expect(ws.application.documents).toEqual(before.documents);
      expect(ws.application.approvals).toEqual(before.approvals);
    }
    const ws = await setup();
    const { suggestion } = offer(ws, { ...proposal, text: ws.application.documents.answer.segments[0].text });
    expect(suggestion.status).toBe('refused');
    expect(suggestion.reason).toMatch(/already|different/i);
  });

  it.each(['text', 'revision', 'source', 'form', 'author'])('refuses stale %s without overwriting current work', async (change) => {
    const ws = await setup();
    const { suggestion } = offer(ws);
    if (change === 'text') ws.application.documents.answer.segments[0].text = 'My newer manual wording.';
    if (change === 'revision') ws.application.documents.answer.revision += 1;
    if (change === 'source') ws.applicant.sources[0].text += ' New context.';
    if (change === 'form') ws.application.form.id = 'different-form';
    if (change === 'author') ws.application.documents.answer.segments[0].author = 'user';
    const before = structuredClone(ws.application);
    expect(() => acceptSuggestion(ws, suggestion.id)).toThrow(/changed|stale/i);
    expect(ws.application.documents).toEqual(before.documents);
    expect(ws.application.approvals).toEqual(before.approvals);
  });

  it('binds proposed citations too, not only original citations', async () => {
    const ws = await setup();
    const { suggestion } = offer(ws, { ...proposal, factIds: ['f3'], text: 'I found the problem and wrote the fix.' });
    ws.applicant.facts.find((f) => f.id === 'f3').status = 'rejected';
    expect(() => acceptSuggestion(ws, suggestion.id)).toThrow(/changed|stale/i);
  });

  it('requires a live claim, bounded request and no open repair or suggestion', async () => {
    const ws = await setup();
    expect(() => prepareSuggestion(ws, input, { id: 'fixture' })).toThrow(/live/i);
    expect(() => prepareSuggestion(ws, { docId: 'letter', segmentId: 'letter-1' }, provider)).toThrow(/claim|sentence/i);
    expect(() => prepareSuggestion(ws, { ...input, request: 'x'.repeat(501) }, provider)).toThrow(/500/);
    const context = prepareSuggestion(ws, { ...input, request: 'make it sound like I led it' }, provider);
    expect(context.request).toBe('make it sound like I led it');
    expect(context.facts).not.toContainEqual(expect.objectContaining({ quote: context.request }));
    ws.application.repair = {};
    expect(() => prepareSuggestion(ws, input, provider)).toThrow(/review|finish/i);
    ws.application.repair = null;
    offer(ws);
    expect(() => prepareSuggestion(ws, input, provider)).toThrow(/suggestion/i);
  });

  it('refuses unknown citations and absent review even if a model claims support', async () => {
    const ws = await setup();
    const context = prepareSuggestion(ws, input, provider);
    const result = finishSuggestion(ws, context, { ...proposal, factIds: ['missing'] }, new Map(), stamp);
    expect(result.suggestion.status).toBe('refused');
    dismissSuggestion(ws, result.suggestion.id);
    expect(finishSuggestion(ws, prepareSuggestion(ws, input, provider), proposal, undefined).suggestion.status).toBe('refused');
  });
});
