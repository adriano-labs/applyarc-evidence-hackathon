import { describe, expect, it } from 'vitest';
import { changeFact, coverage, decideFact, proposeFacts } from '../../server/domain/facts.js';
import { workspaceWithNotes } from '../helpers.js';

describe('facts', () => {
  it('admits only facts that quote the applicant verbatim', () => {
    const { ws, source } = workspaceWithNotes();
    const result = proposeFacts(ws, source.id, [
      { statement: 'The runner queued jobs on Kubernetes.', quote: 'the runner queued them on Kubernetes', requirementIds: ['tech'] },
      { statement: 'Ellie led the team.', quote: 'I led the team of four', requirementIds: ['contribution'] },
    ]);
    expect(result.accepted).toEqual(['f1']);
    expect(result.refused).toEqual([{ quote: 'I led the team of four', reason: 'The quote is not in the applicant’s own words.' }]);
    expect(ws.applicant.facts[0]).toMatchObject({ id: 'f1', status: 'proposed', sourceId: source.id });
  });

  it('refuses a statement with a number its quote does not have', () => {
    const { ws, source } = workspaceWithNotes();
    const { accepted, refused } = proposeFacts(ws, source.id, [
      { statement: '200 students used it.', quote: '140 students used it in the spring term' },
    ]);
    expect(accepted).toEqual([]);
    expect(refused[0].reason).toMatch(/number/);
  });

  it('ignores a duplicate of an existing fact and unknown requirements', () => {
    const { ws, source } = workspaceWithNotes();
    const p = { statement: 'Redis held the queue.', quote: 'Redis for the queue', requirementIds: ['tech', 'nonsense'] };
    proposeFacts(ws, source.id, [p]);
    expect(proposeFacts(ws, source.id, [p]).refused[0].reason).toMatch(/Duplicate/);
    expect(ws.application.coverage).toEqual({ tech: ['f1'] });
  });

  it('lets the applicant confirm or reject a proposed fact once', () => {
    const { ws, source } = workspaceWithNotes();
    proposeFacts(ws, source.id, [{ statement: 'Redis held the queue.', quote: 'Redis for the queue' }]);
    expect(decideFact(ws, 'f1', 'confirm').status).toBe('confirmed');
    expect(() => decideFact(ws, 'f1', 'reject')).toThrow(/already been decided/);
  });

  it('covers a personal requirement only with a first-person fact', () => {
    const { ws, source } = workspaceWithNotes();
    proposeFacts(ws, source.id, [
      { statement: 'The team fixed the crash in three days.', quote: 'Took us three days.', requirementIds: ['contribution', 'problem'] },
    ]);
    decideFact(ws, 'f1', 'confirm');
    const byId = Object.fromEntries(coverage(ws).map((r) => [r.id, r]));
    expect(byId.problem.covered).toBe(true);
    expect(byId.contribution.covered).toBe(false);
  });

  it('does not count a proposed or rejected fact as coverage', () => {
    const { ws, source } = workspaceWithNotes();
    proposeFacts(ws, source.id, [{ statement: 'Redis held the queue.', quote: 'Redis for the queue', requirementIds: ['tech'] }]);
    expect(coverage(ws).find((r) => r.id === 'tech').covered).toBe(false);
    decideFact(ws, 'f1', 'reject');
    expect(coverage(ws).find((r) => r.id === 'tech').covered).toBe(false);
  });

  it('changes a confirmed fact into the applicant’s new words and keeps the old wording', () => {
    const { ws, source } = workspaceWithNotes();
    proposeFacts(ws, source.id, [{ statement: 'Redis held the queue.', quote: 'Redis for the queue' }]);
    decideFact(ws, 'f1', 'confirm');
    const fact = changeFact(ws, 'f1', 'We moved the queue from Redis to Postgres in week 6.');
    expect(fact).toMatchObject({ quote: 'We moved the queue from Redis to Postgres in week 6.', sourceId: 's2' });
    expect(fact.history).toEqual([expect.objectContaining({ quote: 'Redis for the queue', sourceId: source.id })]);
    expect(ws.applicant.sources[1]).toMatchObject({ kind: 'correction' });
    expect(() => changeFact(ws, 'f1', 'We moved the queue from Redis to Postgres in week 6.')).toThrow(/same/);
  });
});
