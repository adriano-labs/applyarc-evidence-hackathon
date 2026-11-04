import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { actions, agentActions } from '../server/flows.js';
import { fromRoot } from '../server/paths.js';
import { viewOf } from '../server/view.js';
import { setDraft } from '../server/domain/documents.js';
import { decideFact, proposeFacts } from '../server/domain/facts.js';
import { preparedWorkspace } from '../server/domain/prepared.js';
import { approve } from '../server/domain/review.js';
import { sourceCorrections } from '../server/domain/sourceConflictCorrection.js';
import { heldSourceConflict } from '../server/domain/sourceConflicts.js';
import { addSource } from '../server/domain/workspace.js';
import { draftedWorkspace, workspaceWithNotes } from './helpers.js';

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

  // Live, 3 Nov: the model's earlier quote was a whole answer that extraction had split into two facts.
  const spanning = (ws, from, to) => {
    const original = ws.applicant.sources[0].text;
    ws.application.questions[0].priorQuote = original.slice(original.indexOf(from.quote), original.indexOf(to.quote) + to.quote.length);
  };

  it('offers the cited fact sharing the most words with the note when the earlier quote spans several facts', async () => {
    const { ws, source } = await conflictingWorkspace();
    spanning(ws, ws.applicant.facts[1], ws.applicant.facts[2]);
    const other = structuredClone(ws.applicant.facts[1]);
    expect(viewOf(ws).sourceCorrections).toEqual([{
      questionId: 'q1', sourceId: source.id, factId: 'f3', before: ws.applicant.facts[2].quote, text: words,
    }]);
    expect(resolve(ws, source).fact.quote).toBe(words);
    expect(ws.applicant.facts[1]).toEqual(other);
    expect(ws.application.repair.factId).toBe('f3');
  });

  it('keeps the clarification route when the spanned facts match the note equally', async () => {
    const { ws, source } = await conflictingWorkspace();
    spanning(ws, ws.applicant.facts[0], ws.applicant.facts[1]);
    const before = structuredClone(ws);
    expect(viewOf(ws).sourceCorrections).toEqual([]);
    expect(() => actions.resolveSourceConflict(ws, { questionId: 'q1', sourceId: source.id, factId: 'f1', text: words })).toThrow();
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

// Live, 3 Nov (Leo): extraction cut his answer into three cited facts. His note overturns the first
// and repeats the second word for word, and the second was the one offered.
describe('a note that repeats part of the earlier quote', () => {
  const ANSWER = 'I set up the cluster and wrote the containerd proxy fix; the other members ran their jobs on it.';
  const NOTE = 'Correction: Mira set up the cluster. I wrote the containerd proxy fix.';

  async function leoWorkspace(note = NOTE, priorQuote = ANSWER) {
    const { ws, source: notes } = workspaceWithNotes('Set up a three-node k3s cluster on old office desktops for our robotics society.');
    const answer = addSource(ws, { kind: 'answer', text: ANSWER });
    notes.read = answer.read = true;
    proposeFacts(ws, answer.id, ['I set up the cluster', 'wrote the containerd proxy fix', 'the other members ran their jobs on it']
      .map((quote) => ({ statement: quote, quote, requirementIds: [] })));
    for (const f of ws.applicant.facts) decideFact(ws, f.id, 'confirm');
    setDraft(ws, 'answer', ['I set up the cluster.', 'I wrote the containerd proxy fix.', 'The other members ran their jobs on it.']
      .map((text, i) => ({ kind: 'claim', text, factIds: [`f${i + 1}`] })));
    const source = actions.notes(ws, { text: note });
    await agentActions.read(ws, { sourceId: source.id }, { extract: async () => ({ facts: [], conflicts: [{
      quote: note, priorSourceId: answer.id, priorQuote, question: 'Who set up the cluster, you or Mira?',
    }] }) }, () => {});
    return { ws, source };
  }

  it('offers the fact the note overturns, never the fragment it repeats', async () => {
    const { ws, source } = await leoWorkspace();
    const kept = structuredClone(ws.applicant.facts.slice(1));
    expect(viewOf(ws).sourceCorrections).toEqual([{ questionId: 'q1', sourceId: source.id, factId: 'f1', before: 'I set up the cluster', text: NOTE }]);
    expect(() => actions.resolveSourceConflict(ws, { questionId: 'q1', sourceId: source.id, factId: 'f2', text: NOTE })).toThrow();
    expect(actions.resolveSourceConflict(ws, viewOf(ws).sourceCorrections[0]).fact.quote).toBe(NOTE);
    expect(ws.applicant.facts.slice(1)).toEqual(kept);
    expect(ws.application.repair.items.map((i) => i.segmentId)).toEqual(['answer-1']);
  });

  it('scores a note that repeats none of the facts as before', async () => {
    const { ws, source } = await leoWorkspace('Correction: Mira set up the cluster; my part was the proxy settings.');
    expect(viewOf(ws).sourceCorrections).toMatchObject([{ sourceId: source.id, factId: 'f1' }]);
  });

  it.each([
    ['two facts', 'I set up the cluster and wrote the containerd proxy fix', 'I said I set up the cluster and wrote the containerd proxy fix, but Mira set up the cluster.'],
    ['one fact', 'wrote the containerd proxy fix', NOTE],
  ])('keeps the clarification route when the note repeats every fact the earlier quote spans (%s)', async (_, priorQuote, note) => {
    const { ws, source } = await leoWorkspace(note, priorQuote);
    const before = structuredClone(ws);
    expect(viewOf(ws).sourceCorrections).toEqual([]);
    expect(() => actions.resolveSourceConflict(ws, { questionId: 'q1', sourceId: source.id, factId: 'f2', text: note })).toThrow();
    expect(ws).toEqual(before);
    expect(heldSourceConflict(ws)).not.toBeNull();
  });

  // Ellie: neither her key-moment note nor her sample correction repeats one of her facts, so
  // whichever fact the live model quotes as the earlier account is still the one offered.
  it('still offers the quoted fact on Ellie’s prepared key moment, for either of her notes', () => {
    const saved = JSON.parse(readFileSync(fromRoot('fixtures', 'ellie-prepared-wonder-20261103.json'), 'utf8'));
    const { correction } = JSON.parse(readFileSync(fromRoot('fixtures', 'ellie-fixture.json'), 'utf8'));
    for (const note of [saved.prepared.note, correction.text]) {
      for (const fact of saved.applicant.facts) {
        const ws = preparedWorkspace(saved);
        ws.applicant.sources.push({ id: 's3', kind: 'notes', text: note, read: true, withheld: true });
        ws.application.questions.push({ id: 'q2', kind: 'source-conflict', status: 'open', conflictSourceId: 's3', priorSourceId: fact.sourceId, quote: note, priorQuote: fact.quote, text: 'Who wrote the Helm patch?' });
        expect(sourceCorrections(ws)).toEqual([{ questionId: 'q2', sourceId: 's3', factId: fact.id, before: fact.quote, text: note }]);
      }
    }
  });
});
