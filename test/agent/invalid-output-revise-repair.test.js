import { describe, expect, it, vi } from 'vitest';
import { repairDocuments } from '../../server/agent/repairFlow.js';
import { actions } from '../../server/flows.js';
import { draftedWorkspace } from '../helpers.js';

const correction = 'My teammate Sam wrote the Helm change; I tested it on two lab nodes.';
const unsupported = 'Sam wrote the Helm change that mounted the memory-backed emptyDir; I tested it.';
const rewrite = (segmentId, text, factIds = ['f3']) => ({ segmentId, text, factIds });
const decision = (claim, verdict = 'supported', reason = 'The corrected fact supports this.') => ({ id: claim.id, verdict, reason });

async function setup() {
  const ws = await draftedWorkspace();
  for (const docId of ['answer', 'letter']) actions.approve(ws, { docId, docRevision: ws.application.documents[docId].revision });
  actions.changeFact(ws, { factId: 'f3', text: correction });
  return ws;
}

describe('rewording invalid output in repair', () => {
  it('skips rewording on invalid-output and continues with candidates unchanged', async () => {
    const ws = await setup();
    const emit = vi.fn();
    const agent = {
      provider: { id: 'meta-test-double' },
      repair: vi.fn(async () => ({ rewrites: [rewrite('answer-3', unsupported)] })),
      revise: vi.fn().mockRejectedValue(Object.assign(new Error('bad'), { code: 'invalid-output' })),
      review: vi.fn(async ({ claims }) => ({ decisions: claims.map((c) => c.kind === 'retention' ? decision(c) : decision(c, 'uncertain', 'No quote connects Sam to the emptyDir mount.')) })),
    };
    const result = await repairDocuments(ws, agent, emit);
    expect(emit).toHaveBeenCalledWith({ type: 'stage', label: 'The rewording step sent an answer that could not be read; going on without it' });
    expect(result.repair.items.find((i) => i.segmentId === 'answer-3')).toMatchObject({ status: 'needs-review', after: null });
  });
});
