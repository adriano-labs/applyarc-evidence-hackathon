import { describe, expect, it, vi } from 'vitest';
import { createModelAgent } from '../../server/agent/model.js';
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

// Live, 3 Nov: a cut-short rewording answer (incomplete) aborted the whole repair.
describe('rewording that is unreadable or cut short in repair', () => {
  it.each([
    ['invalid-output', 'The rewording step sent an answer that could not be read; going on without it'],
    ['incomplete', 'The rewording step was cut short; going on without it'],
  ])('skips rewording on %s and continues with candidates unchanged', async (code, label) => {
    const ws = await setup();
    const emit = vi.fn();
    const agent = {
      provider: { id: 'meta-test-double' },
      repair: vi.fn(async () => ({ rewrites: [rewrite('answer-3', unsupported)] })),
      revise: vi.fn().mockRejectedValue(Object.assign(new Error('bad'), { code })),
      review: vi.fn(async ({ claims }) => ({ decisions: claims.map((c) => c.kind === 'retention' ? decision(c) : decision(c, 'uncertain', 'No quote connects Sam to the emptyDir mount.')) })),
    };
    const result = await repairDocuments(ws, agent, emit);
    expect(emit).toHaveBeenCalledWith({ type: 'stage', decision: true, label });
    expect(result.repair.items.find((i) => i.segmentId === 'answer-3')).toMatchObject({ status: 'needs-review', after: null });
  });

  it('still fails on any other rewording error', async () => {
    const ws = await setup();
    const agent = {
      provider: { id: 'meta-test-double' },
      repair: vi.fn(async () => ({ rewrites: [rewrite('answer-3', unsupported)] })),
      revise: vi.fn().mockRejectedValue(Object.assign(new Error('busy'), { code: 'busy' })),
      review: vi.fn(async ({ claims }) => ({ decisions: claims.map((c) => c.kind === 'retention' ? decision(c) : decision(c, 'uncertain', 'No quote connects Sam to the emptyDir mount.')) })),
    };
    await expect(repairDocuments(ws, agent, vi.fn())).rejects.toMatchObject({ code: 'busy' });
  });

  it('gives rewording the same output budget as repair', async () => {
    const bodies = [];
    const transport = { respond: async (body) => {
      bodies.push(body);
      return { response: { output: [{ type: 'message', content: [{ type: 'output_text', text: '{"rewrites":[]}' }] }] }, usage: {}, costUsd: 0, requestId: 'test-only', attempts: 1, timings: { totalMs: 1 } };
    } };
    const agent = createModelAgent({ provider: { id: 'meta', model: 'muse-wonder-1.0', isMeta: true }, transport });
    const fact = { id: 'f1', statement: 'I tested it.', quote: 'I tested it.' };
    await agent.repair({ fact: { ...fact, history: [] }, items: [], facts: [fact], form: { documents: [] } });
    await agent.revise({ items: [], facts: [fact] });
    expect(bodies.map((b) => b.max_output_tokens)).toEqual([8000, 8000]);
  });
});
