import { expect, it, vi } from 'vitest';
import { agentActions } from '../server/flows.js';
import { changeFact } from '../server/domain/facts.js';
import { applyRepair, decideItem, startRepair } from '../server/domain/repair.js';
import { approve, approvalState } from '../server/domain/review.js';
import { buildExport } from '../server/domain/exportPack.js';
import { draftedWorkspace } from './helpers.js';

const unsafe = 'I deployed Kubernetes to production.';
const draft = { segments: [
  { kind: 'claim', text: 'We chose Kubernetes Jobs.', factIds: ['f1'], startsParagraph: true },
  { kind: 'claim', text: unsafe, factIds: ['f1'], startsParagraph: true },
] };
const review = ({ claims }) => ({ decisions: claims.map((c) => ({ id: c.id, verdict: c.text === unsafe ? 'uncertain' : 'supported', reason: c.text === unsafe ? 'Choosing a tool is not evidence of deploying it.' : 'Supported by the quote.' })) });

it('requires a separate semantic decision before admitting live draft sentences and keeps safe content', async () => {
  const ws = await draftedWorkspace();
  ws.application.documents = { answer: null, letter: null };
  const agent = { provider: { id: 'meta' }, draft: vi.fn(async () => draft), review: vi.fn(review) };
  const result = await agentActions.draft(ws, {}, agent, () => {});
  expect(agent.review).toHaveBeenCalled();
  expect(ws.application.documents.answer.segments.map((s) => s.text)).toEqual(['We chose Kubernetes Jobs.']);
  expect(result.dropped.some((d) => d.text === unsafe && /not evidence/.test(d.reason))).toBe(true);
});

it('accepts a faithful paraphrase despite no shared stems, after separate semantic review', async () => {
  const ws = await draftedWorkspace();
  ws.application.documents = { answer: null, letter: null };
  ws.applicant.facts[0].quote = 'I resolved the defect.';
  ws.applicant.sources.find((s) => s.id === ws.applicant.facts[0].sourceId).text = 'I resolved the defect.';
  const result = await agentActions.draft(ws, {}, { provider: { id: 'meta' }, review, draft: async () => ({ segments: [{ kind: 'claim', text: 'I fixed the bug.', factIds: ['f1'] }] }) }, () => {});
  expect(result.dropped).toEqual([]);
  expect(ws.application.documents.answer.segments[0].text).toBe('I fixed the bug.');
});

it('never offers rejected model wording; a complete confirmed quote may be offered without changing the saved documents', async () => {
  const ws = await draftedWorkspace();
  const documents = structuredClone(ws.application.documents);
  const correction = 'Sam wrote the Helm change. I tested the Helm change.';
  changeFact(ws, 'f3', correction);
  startRepair(ws, 'f3');
  const agent = { provider: { id: 'meta' }, repair: async () => ({ rewrites: ws.application.repair.items.map((i) => ({ segmentId: i.segmentId, text: 'I wrote the Helm change.', factIds: ['f3'] })) }), review: async ({ claims }) => ({ decisions: claims.map((c) => ({ id: c.id, verdict: 'contradicted', reason: 'Sam wrote it; the applicant tested it.' })) }) };
  await agentActions.repair(ws, {}, agent, () => {});
  // The mock rejects both the invented sentence and document retention. A full-quote
  // fallback is a different proposal, not permission to admit that rejected sentence.
  for (const item of ws.application.repair.items) {
    expect(item.after).not.toBe('I wrote the Helm change.');
    if (item.after === null) expect(item.status).toBe('needs-review');
    else expect(item).toMatchObject({ after: correction, afterFactIds: ['f3'], status: 'proposed', decision: null });
  }
  expect(ws.application.documents).toEqual(documents);
  for (const id of ['answer', 'letter']) expect(approvalState(ws, id)).not.toBe('approved');
});

it('a live provider with no review implementation cannot silently use the fixture checker', async () => {
  const ws = await draftedWorkspace();
  ws.application.documents = { answer: null, letter: null };
  await expect(agentActions.draft(ws, {}, { provider: { id: 'meta' }, draft: async () => draft }, () => {})).rejects.toThrow();
  expect(ws.application.documents.answer).toBeNull();
});

it('keeping wording after a fact correction still resets approval and records it as the applicant’s choice', async () => {
  const ws = await draftedWorkspace();
  const originalText = ws.application.documents.answer.segments[2].text;
  for (const id of ['answer', 'letter']) approve(ws, id, ws.application.documents[id].revision);
  changeFact(ws, 'f3', 'Sam wrote the Helm change. I tested the Helm change.');
  startRepair(ws, 'f3');
  const agent = { provider: { id: 'meta' }, repair: async () => ({ rewrites: ws.application.repair.items.map((i) => ({ segmentId: i.segmentId, text: 'I wrote the Helm change.', factIds: ['f3'] })) }), review: async ({ claims }) => ({ decisions: claims.map((c) => ({ id: c.id, verdict: 'contradicted', reason: 'Sam wrote it; the applicant tested it.' })) }) };
  await agentActions.repair(ws, {}, agent, () => {});
  // A valid whole-quote fallback has no rejection reason; it still needs the applicant's decision.
  expect(ws.application.repair.items.every((i) => i.after !== 'I wrote the Helm change.')).toBe(true);
  expect(ws.application.documents.answer.segments[2].text).toBe(originalText);
  for (const id of ['answer', 'letter']) expect(approvalState(ws, id)).not.toBe('approved');
  for (const i of ws.application.repair.items) decideItem(ws, i.id, 'keep');
  applyRepair(ws);
  for (const id of ['answer', 'letter']) expect(approvalState(ws, id)).not.toBe('approved');
  expect(ws.application.documents.answer.segments[2].author).toBe('user');
  expect(ws.application.documents.answer.segments[2].text).toBe(originalText);
  expect(ws.application.documents.answer.segments[2].factIds).not.toContain('f3');
  expect(() => buildExport(ws)).toThrow();
});
