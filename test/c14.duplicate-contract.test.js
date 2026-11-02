import { describe, expect, it } from 'vitest';
import { createWorkspace, addSource } from '../server/domain/workspace.js';
import { reviewKey } from '../server/agent/evidenceReview.js';
import { draftProblems } from '../server/domain/documents.js';
import { draftOne } from '../server/agent/draftFlow.js';

const form = { company: 'Example Co', role: 'Support Engineer', documents: [
  { id: 'answer', wordLimit: 300, requirements: [{ id: 'contribution', text: 'What did you do?', personal: true }] },
  { id: 'letter', wordLimit: 400, requirements: [] },
] };
const claim = (text) => ({ kind: 'claim', text, factIds: ['f1'] });
function workspace(quote) {
  const ws = createWorkspace({ form: structuredClone(form), applicant: 'Casey' });
  const source = addSource(ws, { kind: 'notes', text: quote });
  ws.applicant.facts = [{ id: 'f1', quote, statement: quote, status: 'confirmed', sourceId: source.id, history: [] }];
  ws.application.coverage = { contribution: ['f1'] };
  return ws;
}
const support = async ({ claims }) => ({ decisions: claims.map((c) => ({ id: c.id, verdict: 'supported', reason: 'Follows the explicit source.' })) });
// Independently authored boundary cases, not evaluation/held-out cases.
describe('c14 independent regression contracts', () => {
  it('keeps the individual contribution after the team contribution, including the different count', async () => {
    const team = 'We tested the backup procedure using three recovery scenarios.';
    const own = 'I tested the backup procedure using two recovery scenarios.';
    const ws = workspace(`${team} ${own}`);
    const agent = {
      provider: { id: 'test-double' },
      draft: async () => ({ segments: [claim(team), claim(own)] }),
      review: support,
      revise: async () => ({ rewrites: [] }),
    };
    const dropped = await draftOne(ws, 'answer', { doc: form.documents[0], facts: ws.applicant.facts, form }, agent);
    expect(dropped).toEqual([]);
    expect(ws.application.documents.answer.segments.map((s) => s.text)).toEqual([team, own]);
  });

  it('keeps a supported sentence about the same action on two different dates', () => {
    const quote = 'I tested backups on Monday and tested backups on Friday.';
    const ws = workspace(quote);
    const segment = claim(quote);
    expect(draftProblems(ws, [segment], new Map([[reviewKey(ws, segment), null]]))).toEqual([]);
  });

});
