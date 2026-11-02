import { describe, expect, it, vi } from 'vitest';
import { decideFact, proposeFacts } from '../server/domain/facts.js';
import { agentActions } from '../server/flows.js';
import { workspaceWithNotes } from './helpers.js';

describe('the check step', () => {
  it('links existing facts first, and asks only about what is still uncovered', async () => {
    const ws = teamOnly();
    const agent = {
      clarify: vi.fn(async () => ({
        coverage: [{ requirementId: 'goal', factIds: ['f1'] }],
        questions: [
          { requirementId: 'goal', question: 'What was the aim?', why: 'x' },
          { requirementId: 'contribution', question: 'What did you do yourself?', why: 'The form asks.' },
        ],
      })),
    };
    const result = await agentActions.check(ws, {}, agent, () => {});
    expect(result.linked).toEqual([{ requirementId: 'goal', factId: 'f1' }]);
    expect(ws.application.questions.map((q) => q.requirementId)).toEqual(['contribution']);
    expect(result.refused.map((r) => r.requirementId)).toEqual(['goal']);
  });

  const APP_QUESTION = 'The form asks for "Your individual contribution, if you worked as part of a team": what would you write?';
  const APP_WHY = 'The app asks this itself: the form wants it in your own words, and none of your confirmed facts says it in the first person.';
  // Team-only project facts, plus Ellie's own "Why Graphcore" line, which covers the
  // letter's personal requirement: only "your individual contribution" is a personal gap.
  const teamOnly = () => {
    const { ws, source } = workspaceWithNotes();
    proposeFacts(ws, source.id, [
      { statement: 'Built a GPU job runner.', quote: 'We built a self-service GPU job runner', requirementIds: [] },
      { statement: 'Prefers infrastructure work.', quote: 'I liked the infrastructure side of the project more than the machine learning side', requirementIds: ['motivation'] },
    ]);
    decideFact(ws, 'f1', 'confirm');
    decideFact(ws, 'f2', 'confirm');
    return ws;
  };
  const appQuestions = (ws) => ws.application.questions.filter((q) => q.askedBy === 'app');

  it('asks a personal requirement itself when the model leaves it out, and says so', async () => {
    const ws = teamOnly();
    const result = await agentActions.check(ws, {}, { clarify: async () => ({ coverage: [], questions: [] }) }, () => {});
    expect(appQuestions(ws)).toEqual([{ id: 'q1', requirementId: 'contribution', text: APP_QUESTION, why: APP_WHY, status: 'open', askedBy: 'app' }]);
    expect(result.added).toEqual(['q1']);
  });

  it('asks it too when the model only links a team fact, or its question is refused', async () => {
    const linked = teamOnly();
    await agentActions.check(linked, {}, { clarify: async () => ({ coverage: [{ requirementId: 'contribution', factIds: ['f1'] }], questions: [] }) }, () => {});
    expect(appQuestions(linked).map((q) => q.requirementId)).toEqual(['contribution']);
    const refused = teamOnly();
    const result = await agentActions.check(refused, {}, { clarify: async () => ({ coverage: [], questions: [{ requirementId: 'contribution', question: 'Tell me what you did.' }] }) }, () => {});
    expect(result.refused.map((r) => r.requirementId)).toEqual(['contribution']);
    expect(appQuestions(refused).map((q) => q.requirementId)).toEqual(['contribution']);
  });

  it('marks the model’s own questions, and adds nothing when the model asked', async () => {
    const ws = teamOnly();
    await agentActions.check(ws, {}, { clarify: async () => ({ coverage: [], questions: [{ requirementId: 'contribution', question: 'What did you do yourself?', why: 'The form asks.' }] }) }, () => {});
    expect(ws.application.questions.map((q) => [q.requirementId, q.askedBy])).toEqual([['contribution', 'model']]);
  });

  it('leaves a requirement that is not personal to the model’s judgement', async () => {
    const ws = teamOnly();
    await agentActions.check(ws, {}, { clarify: async () => ({ coverage: [], questions: [] }) }, () => {});
    expect(ws.application.questions.map((q) => q.requirementId)).toEqual(['contribution']);
  });

  it('says how many requirements will be left out when there is nothing left to ask', async () => {
    const ws = teamOnly();
    ws.application.checked = ['goal', 'tech', 'decision', 'problem', 'contribution', 'evidence'];
    const labels = [];
    const clarify = vi.fn();
    const result = await agentActions.check(ws, {}, { clarify }, (e) => labels.push(e.label));
    expect(result.modelCalled).toBe(false);
    expect(clarify).not.toHaveBeenCalled();
    expect(labels).toEqual(['No question needed: 6 requirements will be left out of the drafts']);
  });
});
