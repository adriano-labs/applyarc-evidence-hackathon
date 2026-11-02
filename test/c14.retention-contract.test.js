// Contract tests for the bounded repair-review replacement. These are unit/mock
// orchestration tests, NOT evidence that a real model judges retention correctly.
import { describe, expect, it } from 'vitest';
import { createWorkspace, addSource } from '../server/domain/workspace.js';
import { repairDocuments } from '../server/agent/repairFlow.js';

const correction = 'Kai checked the rota. I tested the backup procedure and wrote the recovery guide.';
const paraphrase = 'I verified the backup process and authored the recovery instructions; Kai checked the rota.';
const omitted = 'Kai checked the rota, and I tested the backup procedure.';
const form = { company: 'Example Co', role: 'Support Engineer', documents: [
  { id: 'answer', wordLimit: 300, requirements: [] }, { id: 'letter', wordLimit: 400, requirements: [] },
] };
function setup(unchanged = []) {
  const ws = createWorkspace({ form: structuredClone(form), applicant: 'Casey' });
  const source = addSource(ws, { kind: 'correction', text: correction });
  ws.applicant.facts = [{ id: 'f1', quote: correction, statement: correction, status: 'confirmed', sourceId: source.id, history: [{ quote: 'I ran the project.' }] }];
  const before = 'I ran the project.';
  ws.application.documents = {
    answer: { revision: 1, segments: [{ id: 'answer-1', text: before, factIds: ['f1'], kind: 'claim', author: 'draft' }, ...unchanged] },
    letter: { revision: 1, segments: [] },
  };
  ws.application.approvals = { answer: null, letter: null };
  ws.application.repair = { factId: 'f1', status: 'awaiting-proposal', items: [{ id: 'c1', docId: 'answer', segmentId: 'answer-1', before, status: 'pending' }] };
  return ws;
}
const rewrite = (text) => ({ segmentId: 'answer-1', text, factIds: ['f1'] });
const ok = (claim) => ({ id: claim.id, verdict: 'supported', reason: claim.kind === 'retention' ? 'The applicant retains both corrected actions in this document.' : 'The sentence is supported.' });
const missing = (claim) => ({ id: claim.id, verdict: 'uncertain', reason: 'The applicant writing the recovery guide is missing from this document.' });
const retentionOf = (claims) => claims.filter((c) => c.kind === 'retention');
const textOf = (check) => check.document.map((s) => s.text).join(' ');
function model(first, reviews, second = []) {
  const calls = { review: [], revise: [] };
  return {
    calls,
    provider: { id: 'test-double' },
    repair: async () => ({ rewrites: [rewrite(first)] }),
    revise: async (request) => { calls.revise.push(structuredClone({ items: request.items, facts: request.facts })); return { rewrites: second.map(rewrite) }; },
    review: async ({ claims }) => {
      calls.review.push(structuredClone(claims));
      return reviews(claims, calls.review.length);
    },
  };
}
function checkPayload(claims, expectedText, unchangedText) {
  expect(new Set(claims.map((c) => c.id)).size).toBe(claims.length);
  const checks = retentionOf(claims);
  expect(checks).toHaveLength(1);
  expect(checks[0]).toMatchObject({ kind: 'retention', docId: 'answer', correctedFact: { id: 'f1', quote: correction } });
  expect(checks[0].document).toEqual(expect.arrayContaining([expect.objectContaining({ segmentId: 'answer-1', text: expectedText, factIds: ['f1'] })]));
  if (unchangedText) expect(textOf(checks[0])).toContain(unchangedText);
  return checks[0];
}

describe('retention is a separate, exact-document review contract', () => {
  it('batches the corrected fact and projected document with sentence support; accepts a supported paraphrase without revision', async () => {
    const manual = 'I enjoy making instructions easy to follow.';
    const ws = setup([{ id: 'answer-u1', text: manual, factIds: [], kind: 'claim', author: 'user' }]);
    const agent = model(paraphrase, (claims) => {
      checkPayload(claims, paraphrase, manual);
      return { decisions: claims.map(ok) };
    });
    await repairDocuments(ws, agent);
    expect(agent.calls.review).toHaveLength(1);
    expect(agent.calls.revise).toHaveLength(0);
    expect(ws.application.repair.items[0]).toMatchObject({ status: 'proposed', after: paraphrase });
    expect(ws.application.documents.answer.segments[1].text).toBe(manual);
    expect(ws.application.approvals).toEqual({ answer: null, letter: null });
  });

  it('does not let individual sentence support override uncertain document retention', async () => {
    const ws = setup();
    const agent = model(omitted, (claims, n) => {
      checkPayload(claims, n === 1 ? omitted : correction);
      return { decisions: claims.map((c) => c.kind === 'retention' ? missing(c) : ok(c)) };
    });
    await repairDocuments(ws, agent);
    expect(agent.calls.review.length).toBeGreaterThan(0);
    expect(agent.calls.revise).toHaveLength(1);
    expect(ws.application.repair.items[0].after).not.toBe(omitted);
    // The quote alternative also received an uncertain whole-document verdict.
    expect(ws.application.repair.items[0].after).toBeNull();
    expect(ws.application.approvals.answer).toBeNull();
  });

  it.each(['missing', 'duplicate'])('fails closed for a %s retention verdict', async (mode) => {
    const ws = setup();
    const agent = model(paraphrase, (claims) => {
      const check = checkPayload(claims, paraphrase);
      const decisions = claims.map(ok);
      return { decisions: mode === 'missing' ? decisions.filter((d) => d.id !== check.id) : [...decisions, ok(check)] };
    });
    await repairDocuments(ws, agent);
    expect(agent.calls.review.length).toBeGreaterThan(0);
    expect(ws.application.repair.items[0]).toMatchObject({ status: 'needs-review', after: null });
    expect(ws.application.approvals.answer).toBeNull();
  });

  it('reviews the new projected document after revision instead of reusing the old retention decision', async () => {
    const oldUntouched = 'I wrote the recovery guide.';
    const ws = setup([{ id: 'answer-u1', text: oldUntouched, factIds: ['f1'], kind: 'claim', author: 'draft' }]);
    const first = 'I independently tested the backup procedure.';
    const second = 'I tested the backup procedure.';
    const agent = model(first, (claims, n) => {
      const check = checkPayload(claims, n === 1 ? first : second);
      if (n === 1) {
        expect(textOf(check)).toContain(oldUntouched);
        return { decisions: claims.map((c) => c.kind === 'retention' ? ok(c) : { id: c.id, verdict: 'uncertain', reason: 'Independently is unsupported.' }) };
      }
      expect(textOf(check)).not.toContain(oldUntouched);
      expect(textOf(check)).toContain('Kai checked the rota.');
      return { decisions: claims.map((c) => c.kind === 'retention' ? missing(c) : ok(c)) };
    }, [second]);
    const revise = agent.revise;
    agent.revise = async (request) => {
      // Controlled change between the two review snapshots. No real concurrent write.
      ws.application.documents.answer.segments[1].text = 'Kai checked the rota.';
      return revise(request);
    };
    await repairDocuments(ws, agent);
    expect(agent.calls.review).toHaveLength(2);
    expect(agent.calls.revise).toHaveLength(1);
    expect(ws.application.repair.items[0].after).not.toBe(second);
    expect([null, correction]).toContain(ws.application.repair.items[0].after);
  });

  it('does not use a retained result after untouched document text changed while its review was running', async () => {
    const oldUntouched = 'I wrote the recovery guide.';
    const ws = setup([{ id: 'answer-u1', text: oldUntouched, factIds: ['f1'], kind: 'claim', author: 'draft' }]);
    const agent = model(omitted, (claims) => {
      checkPayload(claims, omitted, oldUntouched);
      // The returned verdict applies to the snapshot the agent saw, not this new text.
      ws.application.documents.answer.segments[1].text = 'Kai checked the rota.';
      return { decisions: claims.map(ok) };
    });
    let error;
    try { await repairDocuments(ws, agent); } catch (caught) { error = caught; }
    // Refusing the stale transaction or leaving explicit needs-review is acceptable.
    expect(agent.calls.review.length).toBeGreaterThan(0);
    if (error) expect(error.code ?? '').toMatch(/stale|invalid|changed|review/);
    else expect(ws.application.repair.items[0].after).not.toBe(omitted);
    expect(ws.application.approvals.answer).toBeNull();
  });
});
