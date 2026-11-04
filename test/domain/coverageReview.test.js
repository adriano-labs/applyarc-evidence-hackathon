import { describe, expect, it } from 'vitest';
import { changeFact, coverage, decideFact, linkFacts, proposeFacts } from '../../server/domain/facts.js';
import { unansweredRequirements } from '../../server/domain/completeness.js';
import { workspaceWithNotes } from '../helpers.js';

const tech = (ws) => coverage(ws).find((r) => r.id === 'tech');

describe('a corrected fact and the requirements it covered', () => {
  it('stops counting as coverage when a correction drops a detail, until it is linked again', () => {
    const { ws, source } = workspaceWithNotes();
    proposeFacts(ws, source.id, [{ statement: 'Redis held the queue.', quote: 'Redis for the queue', requirementIds: ['tech'] }]);
    decideFact(ws, 'f1', 'confirm');
    expect(tech(ws).covered).toBe(true);
    changeFact(ws, 'f1', 'I moved the queue to Postgres.');
    expect(tech(ws)).toMatchObject({ covered: false, needsReview: true, factIds: [] });
    expect(unansweredRequirements(ws, 'statement').some((r) => r.id === 'tech')).toBe(false);
    expect(linkFacts(ws, [{ requirementId: 'tech', factIds: ['f1'] }]).linked).toEqual([{ requirementId: 'tech', factId: 'f1' }]);
    expect(tech(ws).covered).toBe(true);
    expect(tech(ws).needsReview).toBeUndefined();
  });

  it('keeps a requirement covered by another unchanged fact', () => {
    const { ws, source } = workspaceWithNotes();
    proposeFacts(ws, source.id, [
      { statement: 'Redis held the queue.', quote: 'Redis for the queue', requirementIds: ['tech'] },
      { statement: 'The runner queued jobs on Kubernetes.', quote: 'the runner queued them on Kubernetes', requirementIds: ['tech'] },
    ]);
    decideFact(ws, 'f1', 'confirm');
    decideFact(ws, 'f2', 'confirm');
    changeFact(ws, 'f1', 'I moved the queue to Postgres.');
    expect(tech(ws)).toMatchObject({ covered: true, factIds: ['f2'] });
  });
});
