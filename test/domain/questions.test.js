import { describe, expect, it } from 'vitest';
import { decideFact, proposeFacts } from '../../server/domain/facts.js';
import { addQuestions, answerQuestion, askableRequirements, skipQuestion } from '../../server/domain/questions.js';
import { workspaceWithNotes } from '../helpers.js';

function withTeamFacts() {
  const { ws, source } = workspaceWithNotes();
  proposeFacts(ws, source.id, [
    { statement: 'The team fixed the crash in three days.', quote: 'Took us three days.', requirementIds: ['problem', 'contribution'] },
  ]);
  decideFact(ws, 'f1', 'confirm');
  return ws;
}

const ask = (requirementId, question = 'What did you do yourself?') => ({ requirementId, question, why: 'The form asks.' });

describe('questions', () => {
  it('lists the requirements no confirmed fact covers', () => {
    const ws = withTeamFacts();
    const ids = askableRequirements(ws).map((r) => r.id);
    expect(ids).toContain('contribution');
    expect(ids).not.toContain('problem');
  });

  it('adds one question per uncovered requirement and refuses the rest', () => {
    const ws = withTeamFacts();
    const { added, refused } = addQuestions(ws, [ask('contribution'), ask('contribution', 'Again?'), ask('problem')]);
    expect(added).toEqual(['q1']);
    expect(refused.map((r) => r.requirementId)).toEqual(['contribution', 'problem']);
  });

  it('never asks about a requirement twice, even after a skip', () => {
    const ws = withTeamFacts();
    addQuestions(ws, [ask('contribution')]);
    skipQuestion(ws, 'q1');
    expect(askableRequirements(ws).map((r) => r.id)).not.toContain('contribution');
    expect(addQuestions(ws, [ask('contribution')]).added).toEqual([]);
  });

  it('refuses a question that is not a short question', () => {
    const ws = withTeamFacts();
    expect(addQuestions(ws, [ask('contribution', 'Tell me more.')]).refused[0].reason).toMatch(/question/);
  });

  it('stores the answer as the applicant’s own source', () => {
    const ws = withTeamFacts();
    addQuestions(ws, [ask('contribution')]);
    const { question, source } = answerQuestion(ws, 'q1', 'I found the /dev/shm problem by reading dmesg.');
    expect(question).toMatchObject({ status: 'answered', sourceId: source.id });
    expect(source).toMatchObject({ kind: 'answer', questionId: 'q1' });
    expect(() => answerQuestion(ws, 'q1', 'again')).toThrow(/already/);
  });
});
