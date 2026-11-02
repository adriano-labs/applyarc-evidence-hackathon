import { describe, expect, it } from 'vitest';
import { actions, agentActions } from '../server/flows.js';
import { viewOf } from '../server/view.js';
import { approve } from '../server/domain/review.js';
import { heldSourceConflict } from '../server/domain/sourceConflicts.js';
import { draftedWorkspace } from './helpers.js';

const words = 'Sam wrote the Helm patch. I reproduced the failure, tested his fix and wrote the incident notes.';

async function conflictingWorkspace() {
  const ws = await draftedWorkspace();
  ws.applicant.sources[0].read = true;
  actions.edit(ws, { docId: 'answer', segmentId: 'answer-1', text: 'This is my opening; keep it.' });
  for (const docId of ['answer', 'letter']) approve(ws, docId, ws.application.documents[docId].revision);
  const source = actions.notes(ws, { text: words });
  await agentActions.read(ws, { sourceId: source.id }, { extract: async () => ({ facts: [], conflicts: [{
    quote: words, priorSourceId: 's1', priorQuote: ws.applicant.facts[2].quote,
    question: 'Did Sam write the patch, or did you write it yourself?',
  }] }) }, () => {});
  return { ws, source };
}

const resolve = (ws, source, text = words) => actions.resolveSourceConflict(ws, {
  questionId: 'q1', sourceId: source.id, factId: 'f3', text,
});

describe('one explicit correction from an already-read conflicting note', () => {
  it('offers the exact source without mutation, then resolves only that question and starts ordinary repair', async () => {
    const { ws, source } = await conflictingWorkspace();
    const before = structuredClone(ws);
    expect(viewOf(ws).sourceCorrections).toEqual([{
      questionId: 'q1', sourceId: source.id, factId: 'f3', before: ws.applicant.facts[2].quote, text: words,
    }]);
    expect(ws).toEqual(before);
    const result = resolve(ws, source);
    expect(result.fact.quote).toBe(words);
    expect(ws.applicant.facts[2].history.at(-1).quote).toBe(before.applicant.facts[2].quote);
    expect(ws.application.questions[0]).toMatchObject({ status: 'answered', settled: true });
    expect(ws.applicant.sources.find((s) => s.id === source.id).withheld).toBe(true);
    expect(ws.applicant.sources.at(-1)).toMatchObject({ kind: 'correction', text: words, read: true });
    expect(heldSourceConflict(ws)).toBeNull();
    expect(ws.application.repair.items.map((i) => i.docId).sort()).toEqual(['answer', 'letter']);
    expect(ws.application.documents).toEqual(before.application.documents);
    expect(ws.application.approvals).toEqual({ answer: null, letter: null });
    expect(viewOf(ws).sourceCorrections).toEqual([]);
    expect(() => resolve(ws, source)).toThrow();
  });

  it.each(['changed-source', 'answered', 'not-withheld', 'wrong-fact', 'too-long', 'empty', 'active-repair', 'other-question'])('rejects %s without changing saved work', async (mode) => {
    const { ws, source } = await conflictingWorkspace();
    let text = words;
    let factId = 'f3';
    if (mode === 'changed-source') ws.application.questions[0].conflictSourceId = 's999';
    if (mode === 'answered') ws.application.questions[0].status = 'answered';
    if (mode === 'not-withheld') source.withheld = false;
    if (mode === 'wrong-fact') factId = 'f1';
    if (mode === 'too-long') text = 'x'.repeat(281);
    if (mode === 'empty') text = '  ';
    if (mode === 'active-repair') ws.application.repair = { status: 'review', factId: 'f1', items: [] };
    if (mode === 'other-question') ws.application.questions.push({ id: 'q2', status: 'open', text: 'A separate unresolved question?' });
    const before = structuredClone(ws);
    expect(() => actions.resolveSourceConflict(ws, { questionId: 'q1', sourceId: source.id, factId, text })).toThrow();
    expect(ws).toEqual(before);
  });

  it('keeps the existing clarification route when more than one earlier fact matches', async () => {
    const { ws, source } = await conflictingWorkspace();
    const original = ws.applicant.sources[0].text;
    ws.application.questions[0].priorQuote = original.slice(original.indexOf(ws.applicant.facts[1].quote), original.indexOf(ws.applicant.facts[2].quote) + ws.applicant.facts[2].quote.length);
    const before = structuredClone(ws);
    expect(viewOf(ws).sourceCorrections).toEqual([]);
    expect(() => resolve(ws, source)).toThrow();
    expect(ws).toEqual(before);
  });

  it('saves the applicant’s edited wording without another extraction step', async () => {
    const { ws, source } = await conflictingWorkspace();
    const edited = words.replace('tested his fix', 'tested his fix on our lab nodes');
    resolve(ws, source, edited);
    expect(ws.applicant.facts[2].quote).toBe(edited);
    expect(ws.application.questions).toHaveLength(1);
    expect(heldSourceConflict(ws)).toBeNull();
  });

  it('reopens only the originating conflict when the applicant undoes the correction', async () => {
    const { ws, source } = await conflictingWorkspace();
    const questionBefore = structuredClone(ws.application.questions[0]);
    const factBefore = structuredClone(ws.applicant.facts[2]);
    const documentsBefore = structuredClone(ws.application.documents);
    resolve(ws, source);
    const correctionSourceId = ws.applicant.facts[2].sourceId;
    const unrelated = { id: 'q2', kind: 'source-conflict', status: 'answered', settled: true, sourceId: 's1', resolution: 'corrected' };
    ws.application.questions.push(structuredClone(unrelated));

    actions.cancelRepair(ws);

    expect(ws.applicant.facts[2]).toEqual(factBefore);
    expect(ws.application.documents).toEqual(documentsBefore);
    expect(ws.application.questions[0]).toEqual(questionBefore);
    expect(ws.application.questions[1]).toEqual(unrelated);
    expect(ws.applicant.sources.some((s) => s.id === correctionSourceId)).toBe(false);
    expect(heldSourceConflict(ws)).not.toBeNull();
    expect(viewOf(ws).sourceCorrections).toHaveLength(1);
    expect(() => actions.approve(ws, { docId: 'answer', docRevision: ws.application.documents.answer.revision })).toThrow();

    // The original question is actionable again; leaving out the added note
    // remains the applicant's explicit decision, never an automatic bypass.
    actions.skip(ws, { questionId: 'q1' });
    expect(heldSourceConflict(ws)).toBeNull();
    expect(() => actions.approve(ws, { docId: 'answer', docRevision: ws.application.documents.answer.revision })).not.toThrow();
  });
});
