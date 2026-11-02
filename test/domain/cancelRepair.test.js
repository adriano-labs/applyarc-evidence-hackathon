import { describe, expect, it } from 'vitest';
import { editSegment } from '../../server/domain/documents.js';
import { changeFact } from '../../server/domain/facts.js';
import { cancelRepair, decideItem, proposeRewrites, startRepair } from '../../server/domain/repair.js';
import { actions } from '../../server/flows.js';
import { draftedWorkspace } from '../helpers.js';

const CORRECTION = 'I found the /dev/shm problem by reading dmesg; my teammate Sam wrote the Helm change.';

describe('undoing a correction before it is applied', () => {
  it('puts the fact, its sources and both documents back exactly as they were', async () => {
    const ws = await draftedWorkspace();
    const before = structuredClone({ fact: ws.applicant.facts.find((f) => f.id === 'f3'), sources: ws.applicant.sources, documents: ws.application.documents });
    changeFact(ws, 'f3', CORRECTION);
    startRepair(ws, 'f3');
    proposeRewrites(ws, [{ segmentId: 'answer-3', text: 'I found the /dev/shm problem by reading dmesg; Sam wrote the Helm fix.', factIds: ['f3'] }]);
    decideItem(ws, 'c1', 'take');
    const fact = cancelRepair(ws);
    expect(fact).toEqual(before.fact);
    expect(ws.applicant.facts.find((f) => f.id === 'f3')).toEqual(before.fact);
    expect(ws.applicant.sources).toEqual(before.sources);
    expect(ws.application.documents).toEqual(before.documents);
    expect(ws.application.repair).toBeNull();
    expect(() => editSegment(ws, 'answer', 'answer-1', 'We chose Kubernetes Jobs over Slurm.')).not.toThrow();
  });

  it('works while the rewrite is still awaited, and through the action', async () => {
    const ws = await draftedWorkspace();
    actions.changeFact(ws, { factId: 'f3', text: CORRECTION });
    expect(ws.application.repair.status).toBe('awaiting-proposal');
    expect(actions.cancelRepair(ws).statement).toBe('Ellie found the problem and wrote the fix.');
    expect(ws.application.repair).toBeNull();
  });

  it('refuses when there is no correction waiting', async () => {
    const ws = await draftedWorkspace();
    expect(() => cancelRepair(ws)).toThrow('There is no correction to undo.');
  });
});
