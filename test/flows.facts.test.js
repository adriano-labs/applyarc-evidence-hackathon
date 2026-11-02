import { describe, expect, it } from 'vitest';
import { proposeFacts } from '../server/domain/facts.js';
import { actions } from '../server/flows.js';
import { workspaceWithNotes } from './helpers.js';

describe('confirming the remaining facts at once', () => {
  it('confirms every listed proposed fact in one step', () => {
    const { ws, source } = workspaceWithNotes();
    proposeFacts(ws, source.id, [
      { statement: 'Built a GPU runner.', quote: 'We built a self-service GPU job runner', requirementIds: [] },
      { statement: 'Used Redis.', quote: 'Redis for the queue', requirementIds: [] },
    ]);
    expect(actions.confirmFacts(ws, { factIds: ['f1', 'f2'] })).toEqual({ confirmed: ['f1', 'f2'] });
    expect(ws.applicant.facts.map((f) => f.status)).toEqual(['confirmed', 'confirmed']);
  });

  it('refuses a fact that is not waiting to be checked, and changes nothing', () => {
    const { ws, source } = workspaceWithNotes();
    proposeFacts(ws, source.id, [
      { statement: 'Built a GPU runner.', quote: 'We built a self-service GPU job runner', requirementIds: [] },
      { statement: 'Used Redis.', quote: 'Redis for the queue', requirementIds: [] },
    ]);
    actions.decideFact(ws, { factId: 'f2', decision: 'reject' });
    expect(() => actions.confirmFacts(ws, { factIds: ['f1', 'f2'] })).toThrow('Only facts waiting to be checked can be confirmed together.');
    expect(ws.applicant.facts.map((f) => f.status)).toEqual(['proposed', 'rejected']);
  });
});
