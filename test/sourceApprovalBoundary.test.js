import { describe, expect, it } from 'vitest';
import { actions, agentActions } from '../server/flows.js';
import { addSource, createWorkspace } from '../server/domain/workspace.js';
import { decideFact, proposeFacts } from '../server/domain/facts.js';
import { editSegment, setDraft } from '../server/domain/documents.js';
import { approve } from '../server/domain/review.js';
import { buildExport } from '../server/domain/exportPack.js';

const original = ['I prepared the volunteer rota.', 'I printed the event timetable.'];
const extra = 'I checked the room bookings.';
const form = {
  id: 'fictional-community-role', company: 'Fictional Community Centre', role: 'Coordinator',
  url: 'https://example.invalid/role', portalTasks: ['Upload your CV'],
  documents: ['answer', 'letter'].map((id) => ({
    id, title: id === 'answer' ? 'Project answer' : 'Cover letter', fieldId: id,
    wordLimit: 300, requirements: [],
  })),
};

function approvedWorkspace() {
  const ws = createWorkspace({ form, applicant: 'Avery' });
  const source = addSource(ws, { kind: 'notes', text: original.join(' ') });
  source.read = true;
  const { accepted } = proposeFacts(ws, source.id, original.map((quote) => ({ statement: quote, quote })));
  accepted.forEach((id) => decideFact(ws, id, 'confirm'));
  for (const [index, id] of ['answer', 'letter'].entries()) {
    setDraft(ws, id, [{ kind: 'claim', text: original[index], factIds: [accepted[index]] }]);
  }
  editSegment(ws, 'answer', 'answer-1', 'My own opening: I prepared the volunteer rota.');
  approveBoth(ws);
  buildExport(ws);
  ws.archive = [{ ...structuredClone(ws.application), archivedAt: '2026-10-28T10:00:00Z' }];
  return ws;
}

function approveBoth(ws) {
  for (const id of ['answer', 'letter']) approve(ws, id, ws.application.documents[id].revision);
}

function assertPending(ws) {
  const before = structuredClone(ws);
  expect(() => approve(ws, 'answer', ws.application.documents.answer.revision)).toThrow();
  expect(() => buildExport(ws)).toThrow();
  expect(ws).toEqual(before);
}

async function readWith(ws, source, result) {
  return agentActions.read(ws, { sourceId: source.id }, { extract: async () => result }, () => {});
}

describe('new evidence requires fresh approval independently of model conflict detection', () => {
  it.each(['notes', 'answer', 'voice'])('adding a %s source invalidates only current approvals and blocks unread evidence', (kind) => {
    const ws = approvedWorkspace();
    const before = structuredClone(ws);
    addSource(ws, { kind, text: extra });
    expect(ws.application.approvals).toEqual({ answer: null, letter: null });
    expect(ws.application.documents).toEqual(before.application.documents);
    expect(ws.application.exports).toEqual(before.application.exports);
    expect(ws.archive).toEqual(before.archive);
    expect(ws.applicant.facts).toEqual(before.applicant.facts);
    expect(ws.application.questions).toEqual([]);
    assertPending(ws);
  });

  it.each(['unread', 'proposed'])('direct approve and export also guard an existing saved %s state', (state) => {
    const ws = approvedWorkspace();
    const oldApprovals = structuredClone(ws.application.approvals);
    const source = addSource(ws, { kind: 'notes', text: extra });
    if (state === 'proposed') {
      source.read = true;
      proposeFacts(ws, source.id, [{ statement: extra, quote: extra }]);
    }
    // Simulate a previously persisted workspace from before invalidation existed.
    ws.application.approvals = oldApprovals;
    expect(ws.application.questions).toEqual([]);
    assertPending(ws);
  });

  it('an empty extraction never revives old approvals; each document needs an explicit new approval', async () => {
    const ws = approvedWorkspace();
    const source = actions.notes(ws, { text: 'I have no other details to add.' });
    await readWith(ws, source, { facts: [], conflicts: [] });
    expect(source.read).toBe(true);
    expect(ws.application.questions).toEqual([]);
    expect(ws.application.approvals).toEqual({ answer: null, letter: null });
    expect(() => buildExport(ws)).toThrow();
    approve(ws, 'answer', ws.application.documents.answer.revision);
    expect(() => buildExport(ws)).toThrow();
    approve(ws, 'letter', ws.application.documents.letter.revision);
    expect(buildExport(ws).status).toBe('NOT SUBMITTED');
  });

  it.each(['confirm', 'reject'])('a model response with no conflict question waits for proposal %s and fresh approvals', async (decision) => {
    const ws = approvedWorkspace();
    const text = 'Lee prepared the volunteer rota, while I printed it.';
    const source = actions.notes(ws, { text });
    // The model missed the conflict. This boundary is not semantic detection:
    // it makes the applicant resolve proposals and approve again explicitly.
    const result = await readWith(ws, source, { facts: [{ statement: text, quote: text }], conflicts: [] });
    expect(ws.application.questions).toEqual([]);
    expect(result.accepted).toHaveLength(1);
    assertPending(ws);
    actions.decideFact(ws, { factId: result.accepted[0], decision });
    expect(ws.application.approvals).toEqual({ answer: null, letter: null });
    expect(() => buildExport(ws)).toThrow();
    approveBoth(ws);
    expect(buildExport(ws).status).toBe('NOT SUBMITTED');
  });

  it('dismissing a detected conflict still requires new approvals and leaves the saved writing alone', async () => {
    const ws = approvedWorkspace();
    const before = structuredClone(ws.application.documents);
    const text = 'Lee prepared the volunteer rota, while I printed it.';
    const source = actions.notes(ws, { text });
    await readWith(ws, source, { facts: [], conflicts: [{
      quote: text, priorQuote: original[0], priorSourceId: 's1', question: 'Who prepared the volunteer rota?',
    }] });
    assertPending(ws);
    actions.skip(ws, { questionId: ws.application.questions[0].id });
    expect(ws.application.documents).toEqual(before);
    expect(ws.application.approvals).toEqual({ answer: null, letter: null });
    expect(() => buildExport(ws)).toThrow();
    approveBoth(ws);
    expect(buildExport(ws).status).toBe('NOT SUBMITTED');
  });

  it('keeps direct corrections selective: only the document citing that fact loses approval', () => {
    const ws = approvedWorkspace();
    const before = structuredClone(ws);
    actions.changeFact(ws, { factId: 'f1', text: 'I checked the volunteer rota prepared by Lee.' });
    expect(ws.application.approvals.answer).toBeNull();
    expect(ws.application.approvals.letter).toEqual(before.application.approvals.letter);
    expect(ws.application.documents).toEqual(before.application.documents);
    expect(ws.archive).toEqual(before.archive);
  });

  it.each(['empty-notes', 'long-notes', 'empty-answer', 'missing-question', 'closed-question'])('invalid %s leaves approvals and all saved state intact', (mode) => {
    const ws = approvedWorkspace();
    ws.application.questions.push({ id: 'q1', status: mode === 'closed-question' ? 'skipped' : 'open', text: 'Any detail to add?' });
    const before = structuredClone(ws);
    const action = () => mode.includes('notes')
      ? actions.notes(ws, { text: mode === 'empty-notes' ? ' ' : 'x'.repeat(20001) })
      : actions.answer(ws, { questionId: mode === 'missing-question' ? 'q99' : 'q1', text: mode === 'empty-answer' ? ' ' : extra });
    expect(action).toThrow();
    expect(ws).toEqual(before);
  });
});
