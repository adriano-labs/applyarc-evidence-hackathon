import { expect, it, vi } from 'vitest';
import { actions } from '../server/flows.js';
import { repairDocuments } from '../server/agent/repairFlow.js';
import { draftedWorkspace } from './helpers.js';

const correction = 'My teammate Sam wrote the Helm change; I tested it on two lab nodes.';
const omitted = 'Sam wrote the Helm change.';
const kept = 'Sam wrote the Helm change, and I tested it on two lab nodes.';
async function setup() {
  const ws = await draftedWorkspace();
  actions.edit(ws, { docId: 'letter', segmentId: 'letter-2', text: 'My own careful sentence about testing.' });
  actions.changeFact(ws, { factId: 'f3', text: correction });
  return ws;
}
const support = (c) => ({ id: c.id, verdict: 'supported', reason: 'Supported by the corrected quote.' });
function model(review) {
  return {
    provider: { id: 'test-double' },
    repair: async () => ({ rewrites: [{ segmentId: 'answer-3', text: omitted, factIds: ['f3'] }, { segmentId: 'letter-2', text: kept, factIds: ['f3'] }] }),
    revise: vi.fn(async () => ({ rewrites: [] })),
    review: vi.fn(review),
  };
}

it('fallback in one document does not replace another document’s proposal or manual conflict', async () => {
  const ws = await setup();
  const documents = structuredClone(ws.application.documents);
  const agent = model(async ({ claims }) => ({ decisions: claims.map((c) => c.kind === 'retention' && c.docId === 'answer'
    && !c.document.some((s) => s.text === correction)
    ? { id: c.id, verdict: 'uncertain', reason: 'The answer omits the applicant testing it.' } : support(c)) }));
  const { repair } = await repairDocuments(ws, agent);
  expect(repair.items.find((i) => i.docId === 'answer')).toMatchObject({ status: 'proposed', after: correction });
  expect(repair.items.find((i) => i.docId === 'letter')).toMatchObject({ status: 'conflict', after: kept, decision: null });
  expect(ws.application.documents).toEqual(documents);
  expect(ws.application.approvals).toEqual({ answer: null, letter: null });
  expect(agent.review).toHaveBeenCalledTimes(2);
  expect(agent.review.mock.calls[1][0].claims).toEqual(expect.arrayContaining([
    expect.objectContaining({ docId: 'answer', document: expect.arrayContaining([expect.objectContaining({ text: correction })]) }),
  ]));
  expect(agent.revise).toHaveBeenCalledTimes(1);
  expect(agent.revise.mock.calls[0][0].items.map((i) => i.segmentId)).toEqual(['answer-3']);
});

it('malformed retention leaves manual conflict status intact and never invents fallback authority', async () => {
  const ws = await setup();
  const documents = structuredClone(ws.application.documents);
  const agent = model(async ({ claims }) => ({ decisions: claims.filter((c) => c.kind !== 'retention').map(support) }));
  const { repair } = await repairDocuments(ws, agent);
  expect(repair.items.find((i) => i.docId === 'answer')).toMatchObject({ status: 'needs-review', after: null });
  expect(repair.items.find((i) => i.docId === 'letter')).toMatchObject({ status: 'conflict', after: null, decision: null });
  expect(ws.application.documents).toEqual(documents);
  expect(agent.review).toHaveBeenCalledTimes(1);
  expect(agent.revise).not.toHaveBeenCalled();
});
