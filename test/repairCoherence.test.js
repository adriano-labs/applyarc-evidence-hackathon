// Contract/orchestration checks, not proof that a live model detects every
// context problem. The actual writing still needs a real-model evaluation.
import { describe, expect, it, vi } from 'vitest';
import { actions } from '../server/flows.js';
import { repairDocuments } from '../server/agent/repairFlow.js';
import { draftedWorkspace } from './helpers.js';

const correction = 'Sam wrote the Helm patch. I reproduced the failure, tested his fix and wrote the incident notes.';
const context = 'The pods failed because /dev/shm was only 64 MB.';
const complete = `${context} ${correction}`;
const rewrite = (segmentId, text, factIds = ['f3']) => ({ segmentId, text, factIds });
const supported = (c) => ({ id: c.id, verdict: 'supported', reason: 'Supported and readable in this document.' });
const incomplete = (c) => ({ id: c.id, verdict: 'uncertain', reason: 'The repaired letter says the failure without introducing what failed in that letter.' });

async function setup({ letterContext = false, manual = false } = {}) {
  const ws = await draftedWorkspace();
  if (letterContext) ws.application.documents.letter.segments.splice(1, 0, {
    id: 'letter-context', kind: 'claim', text: context, factIds: ['f2'], author: 'draft', startsParagraph: true,
  });
  if (manual) actions.edit(ws, { docId: 'answer', segmentId: 'answer-1', text: 'I value explaining technical trade-offs clearly.' });
  actions.changeFact(ws, { factId: 'f3', text: correction });
  return ws;
}

function agentFor({ first = correction, second = [], review } = {}) {
  return {
    provider: { id: 'meta-test-double' },
    repair: vi.fn(async () => ({ rewrites: [rewrite('answer-3', correction), rewrite('letter-2', first)] })),
    revise: vi.fn(async () => ({ rewrites: second })),
    review: vi.fn(async ({ claims }) => ({ decisions: claims.map(review ?? supported) })),
  };
}
const letterItem = (ws) => ws.application.repair.items.find((i) => i.docId === 'letter');
const textOf = (c) => c.document.map((s) => s.text).join(' ');

describe('each repaired document stands on its own', () => {
  it('does not turn an incoherent exact quote into an approved fallback', async () => {
    const ws = await setup();
    const before = structuredClone(ws.application.documents);
    const agent = agentFor({ review: (c) => c.kind === 'retention' && c.docId === 'letter' ? incomplete(c) : supported(c) });
    await repairDocuments(ws, agent);
    expect(letterItem(ws)).toMatchObject({ status: 'needs-review', after: null });
    expect(agent.revise).toHaveBeenCalledTimes(1);
    expect(agent.review.mock.calls.length).toBeLessThanOrEqual(2);
    expect(ws.application.documents).toEqual(before);
    expect(ws.application.approvals.letter).toBeNull();
  });

  it('gives the bounded revision document context and admits only the newly reviewed coherent projection', async () => {
    const ws = await setup({ manual: true });
    const before = structuredClone(ws.application.documents);
    const agent = agentFor({
      second: [rewrite('letter-2', complete, ['f2', 'f3'])],
      review: (c) => c.kind === 'retention' && c.docId === 'letter' && !textOf(c).includes(context) ? incomplete(c) : supported(c),
    });
    await repairDocuments(ws, agent);
    expect(agent.revise.mock.calls[0][0].documents).toEqual(expect.arrayContaining([
      expect.objectContaining({ docId: 'letter', sentences: expect.arrayContaining([expect.objectContaining({ segmentId: 'letter-2', text: correction })]) }),
    ]));
    expect(letterItem(ws)).toMatchObject({ status: 'proposed', after: complete, afterFactIds: ['f2', 'f3'] });
    expect(agent.review).toHaveBeenCalledTimes(2);
    expect(ws.application.documents).toEqual(before);
    expect(ws.application.approvals).toEqual({ answer: null, letter: null });
  });

  it('accepts a coherent first projection with one review and no optional revision', async () => {
    const ws = await setup({ letterContext: true });
    const agent = agentFor();
    await repairDocuments(ws, agent);
    expect(letterItem(ws)).toMatchObject({ status: 'proposed', after: correction });
    expect(agent.revise).not.toHaveBeenCalled();
    expect(agent.review).toHaveBeenCalledTimes(1);
  });

  it('uses a corrected-quote fallback only after its exact projected document was reviewed in the existing second batch', async () => {
    const ws = await setup({ letterContext: true });
    const omitted = 'Sam wrote the Helm patch.';
    const agent = agentFor({ first: omitted, review: (c) => c.kind === 'retention' && c.docId === 'letter' && !textOf(c).includes(correction)
      ? { id: c.id, verdict: 'uncertain', reason: 'The letter omits the applicant contributions.' } : supported(c) });
    await repairDocuments(ws, agent);
    expect(agent.review).toHaveBeenCalledTimes(2);
    const fallback = agent.review.mock.calls[1][0].claims.find((c) => c.kind === 'retention' && c.docId === 'letter' && textOf(c).includes(correction));
    expect(fallback).toBeDefined();
    expect(letterItem(ws)).toMatchObject({ status: 'proposed', after: correction });
  });

  it('does not let a missing fallback verdict reuse primary authority or change a manual document', async () => {
    const ws = await setup({ letterContext: true });
    actions.cancelRepair(ws);
    actions.edit(ws, { docId: 'letter', segmentId: 'letter-2', text: 'My own wording about this work.' });
    actions.changeFact(ws, { factId: 'f3', text: correction });
    const before = structuredClone(ws.application.documents);
    const agent = agentFor({ first: 'Sam wrote the Helm patch.' });
    agent.review.mockImplementation(async ({ claims }) => ({ decisions: claims
      .filter((c) => !(c.kind === 'retention' && c.docId === 'letter' && textOf(c).includes(correction)))
      .map((c) => c.kind === 'retention' && c.docId === 'letter' ? incomplete(c) : supported(c)) }));
    await repairDocuments(ws, agent);
    expect(letterItem(ws)).toMatchObject({ status: 'conflict', after: null, decision: null });
    expect(ws.application.documents).toEqual(before);
    expect(ws.application.approvals.letter).toBeNull();
  });
});
