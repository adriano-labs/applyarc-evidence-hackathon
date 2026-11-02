import { describe, expect, it } from 'vitest';
import { documentStats, documentText, draftBlockers, editSegment, setDraft } from '../../server/domain/documents.js';
import { decideFact, proposeFacts } from '../../server/domain/facts.js';
import { addQuestions } from '../../server/domain/questions.js';
import { draftedWorkspace, workspaceWithNotes } from '../helpers.js';

describe('documents', () => {
  it('will not draft while a fact is undecided or a question is open', () => {
    const { ws, source } = workspaceWithNotes();
    proposeFacts(ws, source.id, [{ statement: 'Took three days.', quote: 'Took us three days.', requirementIds: ['problem'] }]);
    expect(draftBlockers(ws)).toContain('Confirm or reject every proposed fact.');
    decideFact(ws, 'f1', 'confirm');
    addQuestions(ws, [{ requirementId: 'contribution', question: 'What did you do yourself?' }]);
    expect(draftBlockers(ws)).toEqual(['Answer or skip the open question.']);
    expect(() => setDraft(ws, 'answer', [{ kind: 'claim', text: 'x', factIds: ['f1'] }])).toThrow(/open question/);
  });

  it('refuses a draft with a claim that cites nothing or an unconfirmed fact', async () => {
    const ws = await draftedWorkspace();
    ws.application.documents.answer = null;
    const attempt = (segments) => {
      try { setDraft(ws, 'answer', segments); return null; } catch (e) { return e.details.problems; }
    };
    expect(attempt([{ kind: 'claim', text: 'I am brilliant.', factIds: [] }])).toEqual([[0, 'a claim must cite a fact']]);
    expect(attempt([{ kind: 'claim', text: 'Fine.', factIds: ['f9'] }])).toEqual([[0, 'cites a fact that is not confirmed']]);
    expect(attempt([{ kind: 'frame', text: 'Hi.', factIds: ['f1'] }])).toEqual([[0, 'a greeting or sign-off cites no facts']]);
  });

  it('marks an edited sentence as the applicant’s own and bumps the revision', async () => {
    const ws = await draftedWorkspace();
    const doc = editSegment(ws, 'answer', 'answer-3', 'I spotted the OOM kills in dmesg and wrote the Helm fix.');
    expect(doc.revision).toBe(2);
    expect(doc.segments[2]).toMatchObject({ author: 'user', factIds: ['f3'] });
  });

  it('will not redraft over the applicant’s edits', async () => {
    const ws = await draftedWorkspace();
    editSegment(ws, 'answer', 'answer-1', 'My own words.');
    expect(() => setDraft(ws, 'answer', [{ kind: 'claim', text: 'New.', factIds: ['f1'] }])).toThrow(/your edits/);
  });

  it('joins paragraphs and counts words against the form limit', async () => {
    const ws = await draftedWorkspace();
    expect(documentText(ws.application.documents.letter)).toMatch(/^Dear Graphcore team,\n\nOn my final-year/);
    expect(documentStats(ws, 'answer')).toMatchObject({ wordLimit: 300, overLimit: false });
    ws.application.documents.answer.segments[0].text = 'word '.repeat(301);
    expect(documentStats(ws, 'answer').overLimit).toBe(true);
  });
});
