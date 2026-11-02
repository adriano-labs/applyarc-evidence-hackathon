import { describe, expect, it } from 'vitest';
import { approve } from '../../server/domain/review.js';
import { decideFact, proposeFacts } from '../../server/domain/facts.js';
import { addQuestions, askableRequirements, markChecked } from '../../server/domain/questions.js';
import { nextStep } from '../../server/domain/progress.js';
import { draftedWorkspace, form } from '../helpers.js';
import { createWorkspace } from '../../server/domain/workspace.js';
import { addSource } from '../../server/domain/workspace.js';

describe('next step', () => {
  it('walks from notes to export', async () => {
    const ws = createWorkspace({ form: structuredClone(form) });
    expect(nextStep(ws)).toBe('notes');
    const s = addSource(ws, { kind: 'notes', text: 'Took us three days. We used Redis for the queue.' });
    expect(nextStep(ws)).toBe('read');
    s.read = true;
    proposeFacts(ws, s.id, [{ statement: 'Redis held the queue.', quote: 'We used Redis for the queue.', requirementIds: ['tech'] }]);
    expect(nextStep(ws)).toBe('facts');
    decideFact(ws, 'f1', 'confirm');
    expect(nextStep(ws)).toBe('check');
    addQuestions(ws, [{ requirementId: 'contribution', question: 'What did you do?' }]);
    expect(nextStep(ws)).toBe('question');
  });

  it('never re-raises a requirement a check already looked at', async () => {
    const ws = await draftedWorkspace();
    ws.applicant.sources[0].read = false;
    const before = askableRequirements(ws).map((r) => r.id);
    expect(before.length).toBeGreaterThan(0);
    markChecked(ws, before);
    expect(askableRequirements(ws)).toEqual([]);
    expect(nextStep(ws)).toBe('read');
    for (const s of ws.applicant.sources) s.read = true;
    expect(nextStep(ws)).toBe('approve');
    approve(ws, 'answer', 1);
    approve(ws, 'letter', 1);
    expect(nextStep(ws)).toBe('export');
  });
});
