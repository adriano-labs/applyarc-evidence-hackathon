import { describe, expect, it, vi } from 'vitest';
import { draftOne } from '../../server/agent/draftFlow.js';
import { draftedWorkspace } from '../helpers.js';

const good = { kind: 'claim', text: 'We chose Kubernetes Jobs.', factIds: ['f1'], startsParagraph: true };
const bad = { kind: 'claim', text: 'I deployed the production service.', factIds: ['f1'], startsParagraph: true };

async function blank() {
  const ws = await draftedWorkspace();
  ws.application.documents = { answer: null, letter: null };
  ws.application.coverage = { decision: ['f1'] };
  return ws;
}
const argsFor = (ws) => ({ form: ws.application.form, doc: ws.application.form.documents[0], docId: 'answer', facts: ws.applicant.facts, coverage: [], applicant: ws.applicant.name });
const noEvents = () => {};

describe('rewording that is unreadable or cut short in draft', () => {
  it.each([
    ['invalid-output', 'The rewording step sent an answer that could not be read; going on without it'],
    ['incomplete', 'The rewording step was cut short; going on without it'],
  ])('skips rewording on %s and continues without it', async (code, label) => {
    const ws = await blank();
    const emit = vi.fn();
    const agent = {
      provider: { id: 'meta-test-double' },
      draft: vi.fn().mockResolvedValue({ segments: [good, bad] }),
      revise: vi.fn().mockRejectedValue(Object.assign(new Error('bad'), { code })),
      review: vi.fn(async ({ claims }) => ({ decisions: claims.map((claim) => ({ id: claim.id, verdict: claim.text.includes('production') ? 'contradicted' : 'supported', reason: 'The evidence does not say this.' })) })),
    };
    const dropped = await draftOne(ws, 'answer', argsFor(ws), agent, emit);
    expect(emit).toHaveBeenCalledWith({ type: 'stage', decision: true, label });
    expect(ws.application.documents.answer.segments.map((s) => s.text)).toEqual([good.text]);
    expect(dropped.some((d) => d.text === bad.text)).toBe(true);
  });
});
