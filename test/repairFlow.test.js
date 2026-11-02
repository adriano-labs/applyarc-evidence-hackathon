import { describe, expect, it, vi } from 'vitest';
import { repairDocuments } from '../server/agent/repairFlow.js';
import { actions } from '../server/flows.js';
import { draftedWorkspace } from './helpers.js';

const correction = 'My teammate Sam wrote the Helm change; I tested it on two lab nodes.';
const unsupported = 'Sam wrote the Helm change that mounted the memory-backed emptyDir; I tested it.';
const supported = 'Sam wrote the Helm change; I tested it on two lab nodes.';
const rewrite = (segmentId, text, factIds = ['f3']) => ({ segmentId, text, factIds });
const decision = (claim, verdict = 'supported', reason = 'The corrected fact supports this.') => ({ id: claim.id, verdict, reason });

async function setup({ manual = false } = {}) {
  const ws = await draftedWorkspace();
  if (manual) actions.edit(ws, { docId: 'letter', segmentId: 'letter-2', text: 'My carefully edited sentence about the Helm change.' });
  for (const docId of ['answer', 'letter']) actions.approve(ws, { docId, docRevision: ws.application.documents[docId].revision });
  actions.changeFact(ws, { factId: 'f3', text: correction });
  return ws;
}

function agentFor(first, second = []) {
  return {
    provider: { id: 'meta-test-double' },
    repair: vi.fn(async () => ({ rewrites: first })),
    revise: vi.fn(async () => ({ rewrites: second })),
    review: vi.fn(async ({ claims }) => ({ decisions: claims.map((c) => c.text === unsupported
      ? decision(c, 'uncertain', 'No quote connects Sam to the emptyDir mount.') : decision(c)) })),
  };
}

describe('one bounded repair improvement', () => {
  it('revises only a rejected proposal, reviews its replacement, and leaves the accepted first proposal untouched', async () => {
    const ws = await setup({ manual: true });
    const docs = structuredClone(ws.application.documents);
    const approvals = structuredClone(ws.application.approvals);
    const goodFirst = rewrite('letter-2', 'I tested the Helm change on two lab nodes after Sam wrote it.');
    const agent = agentFor([rewrite('answer-3', unsupported, ['f3', 'f2']), goodFirst], [rewrite('answer-3', supported)]);
    const result = await repairDocuments(ws, agent);
    expect(agent.revise).toHaveBeenCalledTimes(1);
    expect(agent.revise.mock.calls[0][0].items).toEqual([{ segmentId: 'answer-3', text: unsupported, factIds: ['f3', 'f2'], reason: 'No quote connects Sam to the emptyDir mount.' }]);
    expect(agent.revise.mock.calls[0][0].facts.find((f) => f.id === 'f3').quote).toBe(correction);
    expect(agent.review).toHaveBeenCalledTimes(2);
    expect(agent.review.mock.calls[1][0].claims.filter((c) => c.kind !== 'retention').map((c) => c.text)).toEqual([supported]);
    expect(result.repair.items.find((i) => i.segmentId === 'answer-3')).toMatchObject({ status: 'proposed', after: supported });
    expect(result.repair.items.find((i) => i.segmentId === 'letter-2')).toMatchObject({ status: 'conflict', after: goodFirst.text, decision: null });
    expect(ws.application.documents).toEqual(docs);
    expect(ws.application.approvals).toEqual(approvals);
    expect(approvals).toEqual({ answer: null, letter: null });
  });

  it('stops after one failed replacement and keeps the manual decision boundary when every document alternative is refused', async () => {
    const ws = await setup({ manual: true });
    const stillUnsupported = 'Sam independently designed the system.';
    const agent = agentFor([rewrite('answer-3', unsupported), rewrite('letter-2', unsupported)], [rewrite('answer-3', stillUnsupported), rewrite('letter-2', stillUnsupported)]);
    agent.review.mockImplementation(async ({ claims }) => ({ decisions: claims.map((c) => decision(c, 'uncertain', 'The cited fact does not establish this relationship.')) }));
    const result = await repairDocuments(ws, agent);
    expect(agent.revise).toHaveBeenCalledTimes(1);
    expect(agent.review).toHaveBeenCalledTimes(2);
    // The second batch also reviewed the quote alternative. Verbatim support
    // cannot override its refused document verdict and there is no third call.
    expect(result.repair.items.find((i) => i.segmentId === 'answer-3')).toMatchObject({ status: 'needs-review', after: null });
    expect(result.repair.items.find((i) => i.segmentId === 'letter-2')).toMatchObject({ status: 'conflict', after: null, decision: null });
  });

  it.each([
    ['missing', []],
    ['duplicate', [rewrite('answer-3', supported), rewrite('answer-3', 'Different wording.'), rewrite('answer-3', supported)]],
    ['duplicate with malformed value', [rewrite('answer-3', supported), { segmentId: 'answer-3', text: null }]],
    ['foreign', [rewrite('answer-1', supported)]],
    ['malformed', [{ segmentId: 'answer-3', text: supported, factIds: 'f3' }]],
  ])('fails closed for %s replacement IDs or shape', async (_label, replacements) => {
    const ws = await setup();
    const agent = agentFor([rewrite('answer-3', unsupported)], replacements);
    const result = await repairDocuments(ws, agent);
    expect(result.repair.items.find((i) => i.segmentId === 'answer-3')).toMatchObject({ status: 'needs-review', after: null });
    expect(agent.review).toHaveBeenCalledTimes(1);
    expect(agent.revise).toHaveBeenCalledTimes(1);
  });

  it('ignores an attempt to rewrite a successful first proposal', async () => {
    const ws = await setup();
    const firstLetter = 'I tested the Helm change on two lab nodes after Sam wrote it.';
    const agent = agentFor([rewrite('answer-3', unsupported), rewrite('letter-2', firstLetter)], [rewrite('answer-3', supported), rewrite('letter-2', 'Injected extra change.')]);
    const result = await repairDocuments(ws, agent);
    expect(result.repair.items.find((i) => i.segmentId === 'letter-2').after).toBe(firstLetter);
    expect(agent.review.mock.calls[1][0].claims.filter((c) => c.kind !== 'retention').map((c) => c.text)).toEqual([supported]);
  });

  it('reuses an accepted exact-key verdict across segments without risking the accepted original', async () => {
    const ws = await setup({ manual: true });
    const docs = structuredClone(ws.application.documents);
    const agent = agentFor([rewrite('answer-3', unsupported), rewrite('letter-2', supported)], [rewrite('answer-3', supported)]);
    agent.review.mockImplementationOnce(async ({ claims }) => ({ decisions: claims.map((c) => c.text === unsupported
      ? decision(c, 'uncertain', 'The claimed relationship is not in the evidence.') : decision(c)) }));
    agent.review.mockImplementationOnce(async ({ claims }) => {
      expect(claims.every((c) => c.kind === 'retention')).toBe(true);
      return { decisions: claims.map((c) => decision(c)) };
    });
    const result = await repairDocuments(ws, agent);
    expect(agent.review).toHaveBeenCalledTimes(2);
    expect(agent.review.mock.calls[1][0].claims.every((c) => c.kind === 'retention')).toBe(true);
    expect(result.repair.items.find((i) => i.segmentId === 'answer-3')).toMatchObject({ status: 'proposed', after: supported });
    expect(result.repair.items.find((i) => i.segmentId === 'letter-2')).toMatchObject({ status: 'conflict', after: supported });
    expect(ws.application.documents).toEqual(docs);
  });

  it('reuses a rejected exact-key verdict when that wording moves to another segment', async () => {
    const ws = await setup({ manual: true });
    // Keeps her corrected action, so only the review can refuse it.
    const otherRejected = 'I independently designed the entire system and tested it on two lab nodes.';
    const agent = agentFor([rewrite('answer-3', unsupported), rewrite('letter-2', otherRejected)], [rewrite('answer-3', otherRejected)]);
    agent.review.mockImplementationOnce(async ({ claims }) => ({ decisions: claims.map((c) => c.kind === 'retention' ? decision(c) : decision(c, 'uncertain', 'This wording is unsupported.')) }));
    agent.review.mockImplementationOnce(async ({ claims }) => ({ decisions: claims.map((c) => decision(c)) }));
    const result = await repairDocuments(ws, agent);
    expect(agent.review).toHaveBeenCalledTimes(2);
    expect(agent.review.mock.calls[1][0].claims.every((c) => c.kind === 'retention')).toBe(true);
    expect(result.repair.items.find((i) => i.segmentId === 'answer-3')).toMatchObject({ status: 'needs-review', after: null, reason: 'This wording is unsupported.' });
    expect(result.repair.items.find((i) => i.segmentId === 'letter-2')).toMatchObject({ status: 'conflict', after: null });
  });

  it('rejects duplicate initial IDs instead of letting the last value win', async () => {
    const ws = await setup();
    const agent = agentFor([rewrite('answer-3', unsupported), rewrite('answer-3', supported), rewrite('answer-3', supported)]);
    const result = await repairDocuments(ws, agent);
    expect(result.repair.items.find((i) => i.segmentId === 'answer-3')).toMatchObject({ status: 'needs-review', after: null });
    expect(agent.revise).not.toHaveBeenCalled();
    expect(agent.review).not.toHaveBeenCalled();
  });

  it('does not admit an initial valid proposal when its duplicate is malformed', async () => {
    const ws = await setup();
    const agent = agentFor([{ segmentId: 'answer-3', text: null }, rewrite('answer-3', supported)]);
    const result = await repairDocuments(ws, agent);
    expect(result.repair.items.find((i) => i.segmentId === 'answer-3').after).toBeNull();
    expect(agent.review).not.toHaveBeenCalled();
    expect(agent.revise).not.toHaveBeenCalled();
  });

  it('does not re-review an unchanged rejected claim just to seek a different verdict', async () => {
    const ws = await setup();
    const first = rewrite('answer-3', unsupported);
    const agent = agentFor([first], [first]);
    const result = await repairDocuments(ws, agent);
    expect(agent.revise).toHaveBeenCalledTimes(1);
    expect(agent.review).toHaveBeenCalledTimes(1);
    expect(result.repair.items.find((i) => i.segmentId === 'answer-3').after).toBeNull();
  });

  it('does not retry when first proposals pass or the agent has no revise function', async () => {
    const ws = await setup();
    const agent = agentFor([rewrite('answer-3', supported), rewrite('letter-2', supported)]);
    await repairDocuments(ws, agent);
    expect(agent.revise).not.toHaveBeenCalled();
    const legacy = agentFor([rewrite('answer-3', unsupported)]);
    delete legacy.revise;
    const result = await repairDocuments(await setup(), legacy);
    expect(result.repair.items.find((i) => i.segmentId === 'answer-3').status).toBe('needs-review');
  });

  it('strips a model-supplied kind so a factual rewrite cannot bypass review as a frame', async () => {
    const ws = await setup();
    const agent = agentFor([{ ...rewrite('answer-3', unsupported), kind: 'frame' }]);
    delete agent.revise;
    const result = await repairDocuments(ws, agent);
    expect(agent.review).toHaveBeenCalledTimes(1);
    expect(result.repair.items.find((i) => i.segmentId === 'answer-3').status).toBe('needs-review');
  });

  it('does not let a failed retry partially mutate the open repair or documents', async () => {
    const ws = await setup();
    const before = structuredClone(ws);
    const agent = agentFor([rewrite('answer-3', unsupported)]);
    agent.revise.mockRejectedValue(new Error('Model unavailable'));
    await expect(repairDocuments(ws, agent)).rejects.toThrow('Model unavailable');
    expect(ws).toEqual(before);
  });

  it('retains fixture compatibility without asking for a new review or revision', async () => {
    const ws = await setup();
    const agent = { provider: { id: 'fixture' }, repair: vi.fn(async () => ({ rewrites: [rewrite('answer-3', supported)] })) };
    const result = await repairDocuments(ws, agent);
    expect(result.repair.items.find((i) => i.segmentId === 'answer-3')).toMatchObject({ after: supported, status: 'proposed' });
  });

  it('refuses without a pending repair before calling a model', async () => {
    const ws = await draftedWorkspace();
    const agent = agentFor([]);
    await expect(repairDocuments(ws, agent)).rejects.toThrow('There are no changes waiting for a rewrite.');
    expect(agent.repair).not.toHaveBeenCalled();
  });
});
