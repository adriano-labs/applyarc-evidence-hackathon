import { describe, expect, it } from 'vitest';
import { activeSourceContext, holdSourceConflict, pendingSourceConflict } from '../server/domain/sourceConflicts.js';
import { addSource } from '../server/domain/workspace.js';
import { changeFact, decideFact, proposeFacts } from '../server/domain/facts.js';
import { answerQuestion, skipQuestion } from '../server/domain/questions.js';
import { actions } from '../server/flows.js';
import { workspaceWithNotes } from './helpers.js';

function setup() {
  const { ws, source } = workspaceWithNotes('We tested the update on an isolated practice network.');
  source.read = true;
  proposeFacts(ws, source.id, [{ statement: 'We tested a practice network.', quote: source.text, requirementIds: ['problem'] }]);
  decideFact(ws, 'f1', 'confirm');
  const added = addSource(ws, { kind: 'answer', text: 'I deployed the update to the production network.' });
  return { ws, source, added };
}

const conflict = (source, added) => ({
  quote: added.text, priorSourceId: source.id, priorQuote: source.text,
  question: 'Was your deployment on the isolated practice network or a real production network?',
});

describe('conflicting added evidence', () => {
  it('holds the added source, asks a grounded question and preserves confirmed facts', () => {
    const { ws, source, added } = setup();
    const before = structuredClone(ws.applicant.facts);
    const result = holdSourceConflict(ws, added, [conflict(source, added)]);
    expect(result).toMatchObject({ accepted: [], conflict: true });
    expect(ws.application.questions).toHaveLength(1);
    expect(ws.application.questions[0]).toMatchObject({ kind: 'source-conflict', status: 'open', text: conflict(source, added).question });
    expect(ws.application.questions[0].why).toContain(source.text);
    expect(ws.application.questions[0].why).toContain('Correct fact');
    expect(ws.applicant.facts).toEqual(before);
    expect(added).toMatchObject({ read: true, withheld: true });
    expect(activeSourceContext(ws, added).some((s) => s.id === added.id)).toBe(true);
    expect(pendingSourceConflict(ws)).toBeTruthy();
  });

  it('skipping leaves disputed details out of later context and removes the hold', () => {
    const { ws, source, added } = setup();
    holdSourceConflict(ws, added, [conflict(source, added)]);
    skipQuestion(ws, 'q1');
    const next = addSource(ws, { kind: 'notes', text: 'I also wrote the test plan.' });
    expect(activeSourceContext(ws, next).map((s) => s.id)).toEqual([source.id, next.id]);
    expect(pendingSourceConflict(ws)).toBeNull();
  });

  it('accepts a grounded question followed by a short clarification instruction', () => {
    const { ws, source, added } = setup();
    const question = "Was this a practice network or production? Clarify what 'deployed' means here.";
    expect(holdSourceConflict(ws, added, [{ ...conflict(source, added), question }])).toMatchObject({ conflict: true });
    expect(ws.application.questions[0].text).toBe(question);
  });

  it('keeps the hold until an answer is read, reusing the same question if it still conflicts', () => {
    const { ws, source, added } = setup();
    holdSourceConflict(ws, added, [conflict(source, added)]);
    const { source: answer } = answerQuestion(ws, 'q1', 'I really deployed to the production network.');
    expect(pendingSourceConflict(ws)).toBeTruthy();
    holdSourceConflict(ws, answer, [conflict(source, answer)]);
    expect(ws.application.questions).toHaveLength(1);
    expect(ws.application.questions[0]).toMatchObject({ id: 'q1', status: 'open' });
    const { source: clarified } = answerQuestion(ws, 'q1', 'I deployed to our isolated practice network, not a live network.');
    clarified.read = true;
    // The hold is gone; what is left is the applicant's decision on the earlier fact.
    expect(pendingSourceConflict(ws)).toMatch(/^Check the earlier fact your answer was about/);
    actions.settleConflict(ws, { questionId: 'q1', decision: 'keep' });
    expect(pendingSourceConflict(ws)).toBeNull();
  });

  it('excludes superseded quotes but keeps the explicit correction and unrelated source context', () => {
    const { ws, source, added } = setup();
    source.text += ' I wrote the rollback checklist.';
    changeFact(ws, 'f1', 'I deployed the update to a production network.');
    const context = activeSourceContext(ws, added);
    const previous = context.find((s) => s.id === source.id);
    expect(previous.text).not.toContain('isolated practice network');
    expect(previous.text).toContain('I wrote the rollback checklist.');
    expect(context.some((s) => s.kind === 'correction' && s.text.includes('production network'))).toBe(true);
    expect(() => holdSourceConflict(ws, added, [conflict(source, added)])).toThrow();
  });

  it.each([
    { priorSourceId: 'foreign' }, { priorQuote: 'We launched a spaceship.' }, { quote: 'I invented a new system.' },
    { question: 'Bad output' },
  ])('rejects an ungrounded or malformed conflict without mutation: %o', (patch) => {
    const { ws, source, added } = setup();
    const before = structuredClone(ws);
    expect(() => holdSourceConflict(ws, added, [{ ...conflict(source, added), ...patch }])).toThrow();
    expect(ws).toEqual(before);
  });

  it.each([null, {}, [null], [{}, {}]])('rejects malformed conflict envelopes without mutation: %o', (conflicts) => {
    const { ws, added } = setup();
    const before = structuredClone(ws);
    expect(() => holdSourceConflict(ws, added, conflicts)).toThrow();
    expect(ws).toEqual(before);
  });
});
