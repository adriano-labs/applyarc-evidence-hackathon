// Before approving, the next step says plainly what the document still lacks: sentences
// in the applicant's own words that no fact checks, and requirements not answered.
import { describe, expect, it } from 'vitest';
import { packMarkdown, primaryAction } from '../../client/src/flow.js';

const ws = { application: { form: { documents: [{ id: 'answer', title: 'Project answer' }, { id: 'letter', title: 'Cover letter' }] }, documents: { answer: { revision: 2 } }, exports: [] }, applicant: { facts: [] } };
const view = (stats) => ({ next: 'approve', approvals: { answer: 'none', letter: 'none' }, stats: { answer: { words: 120, wordLimit: 300, overLimit: false, unanswered: [], leftOut: [], ownWords: 0, ...stats } } });

describe('the approve step', () => {
  it('warns about your own words and anything not answered before you approve', () => {
    const action = primaryAction(view({ ownWords: 1, leftOut: [{ id: 'goal', text: 'What you were trying to achieve' }] }), ws, 'answer');
    expect(action).toMatchObject({ id: 'approve:answer', warning: 'Before you approve: 1 sentence is in your own words and not checked against your facts. Not answered: What you were trying to achieve.' });
  });

  it('says nothing extra when the document is complete and fully cited', () => {
    expect(primaryAction(view({}), ws, 'answer').warning).toBeUndefined();
  });
});

describe('the pack', () => {
  it('says how many sentences are your own words and what is not answered', () => {
    const text = packMarkdown({ status: 'NOT SUBMITTED', application: { company: 'Graphcore', role: 'Engineer' }, createdAt: '2026-10-29T20:00:00.000Z',
      documents: [{ id: 'answer', title: 'Project answer', revision: 2, words: 120, wordLimit: 300, text: 'Hi.', references: [], ownWords: 2, notAnswered: ['What you were trying to achieve'] }], portalTasks: [] });
    expect(text).toContain('Your own words, not checked against your facts: 2 sentences.');
    expect(text).toContain('Not answered: What you were trying to achieve.');
  });
});

describe('the export stage', () => {
  it('keeps the pack one click away after it is closed', () => {
    const exported = { ...ws, application: { ...ws.application, exports: [{ id: 'e1' }] } };
    expect(primaryAction({ next: 'export' }, exported, 'answer')).toMatchObject({ id: 'next-application', secondary: { id: 'export', label: 'Open your pack' } });
  });
});
