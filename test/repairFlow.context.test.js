// A repair sees the documents around the sentences it rewrites, and the applicant's
// corrected part is judged across the whole document: an action an unchanged
// sentence already states is not forced into a rewrite, and her corrected words
// stand in at most once per document. Held-out set 2 (29 Oct): a repair repeated
// "I cut the test batch" in both documents because it saw only the cited sentences.
import { describe, expect, it, vi } from 'vitest';
import { repairDocuments } from '../server/agent/repairFlow.js';
import { rewriteProblems } from '../server/domain/repair.js';
import { retentionChecks } from '../server/domain/retention.js';
import { actions } from '../server/flows.js';
import { draftedWorkspace } from './helpers.js';

const correction = 'My teammate Sam wrote the Helm change; I tested it on two lab nodes.';
const rewrite = (segmentId, text, factIds = ['f3']) => ({ segmentId, text, factIds });
const supportAll = (claims) => ({ decisions: claims.map((c) => c.kind === 'retention' && !c.document.map((s) => s.text).join(' ').includes('I tested it on two lab nodes')
  ? { id: c.id, verdict: 'uncertain', reason: 'The document drops the applicant testing the change on two lab nodes.' }
  : { id: c.id, verdict: 'supported', reason: 'Supported.' }) });
const extraClaim = (id, text, factIds) => ({ id, kind: 'claim', text, factIds, startsParagraph: false, author: 'draft' });

async function corrected(extra) {
  const ws = await draftedWorkspace();
  if (extra) ws.application.documents.answer.segments.push(extra);
  for (const docId of ['answer', 'letter']) actions.approve(ws, { docId, docRevision: ws.application.documents[docId].revision });
  actions.changeFact(ws, { factId: 'f3', text: correction });
  return ws;
}
const agentFor = (rewrites, review = supportAll) => ({
  provider: { id: 'meta-test-double' },
  repair: vi.fn(async () => ({ rewrites })),
  revise: vi.fn(async () => ({ rewrites: [] })),
  review: vi.fn(async ({ claims }) => review(claims)),
});
const itemOf = (repair, segmentId) => repair.items.find((i) => i.segmentId === segmentId);

describe('a repair with the documents around it', () => {
  it('is given every sentence of each affected document, read-only', async () => {
    const ws = await corrected();
    const sentences = (docId) => ws.application.documents[docId].segments.map((s) => ({ segmentId: s.id, text: s.text }));
    const expected = [{ docId: 'answer', sentences: sentences('answer') }, { docId: 'letter', sentences: sentences('letter') }];
    const fixed = 'Sam wrote the Helm change, and I tested it on two lab nodes.';
    const agent = agentFor([rewrite('answer-3', fixed), rewrite('letter-2', fixed)]);
    await repairDocuments(ws, agent);
    expect(agent.repair.mock.calls[0][0].documents).toEqual(expected);
  });

  it('does not force her corrected part into a rewrite when an unchanged sentence of that document already says it', async () => {
    const ws = await corrected(extraClaim('answer-4', 'I tested it on two lab nodes.', ['f2']));
    const proposals = [rewrite('answer-3', 'Sam wrote the Helm change.'), rewrite('letter-2', 'Sam wrote the Helm change.')];
    const checks = retentionChecks(ws, proposals);
    expect(checks.find((c) => c.docId === 'answer').document.map((s) => s.text)).toContain('I tested it on two lab nodes.');
    const review = new Map(checks.map((c) => [c.key, { verdict: c.docId === 'answer' ? 'supported' : 'uncertain', reason: 'The letter omits the action.' }]));
    const problems = rewriteProblems(ws, proposals, review);
    expect(problems.has('answer-3')).toBe(false);
    expect(problems.has('letter-2')).toBe(true);
  });

  it('stands her corrected words in at most once per document', async () => {
    const ws = await corrected(extraClaim('answer-4', 'I wrote the notes for the Helm change.', ['f3']));
    const agent = agentFor([rewrite('answer-3', 'Sam wrote the Helm change.'), rewrite('answer-4', 'Sam wrote the notes.'), rewrite('letter-2', 'Sam wrote the Helm change.')]);
    const { repair } = await repairDocuments(ws, agent);
    expect(itemOf(repair, 'answer-3')).toMatchObject({ status: 'proposed', after: correction });
    expect(repair.items.filter((i) => i.docId === 'answer' && i.after === correction)).toHaveLength(1);
    expect(itemOf(repair, 'letter-2')).toMatchObject({ status: 'proposed', after: correction });
  });

  it('stands her corrected words in when the review says a rewrite drops her part', async () => {
    const ws = await corrected();
    const vague = 'I helped Sam with the Helm change.';
    const agent = agentFor([rewrite('answer-3', vague), rewrite('letter-2', 'Sam wrote the Helm change; I tested it on two lab nodes.')], (claims) => ({
      decisions: claims.map((c) => ((c.text === vague || (c.kind === 'retention' && c.docId === 'answer' && !c.document.some((s) => s.text === correction)))
        ? { id: c.id, verdict: 'uncertain', reason: 'Drops the applicant\'s own part.' }
        : { id: c.id, verdict: 'supported', reason: 'Supported.' })),
    }));
    const { repair } = await repairDocuments(ws, agent);
    expect(agent.revise).toHaveBeenCalledTimes(1);
    expect(itemOf(repair, 'answer-3')).toMatchObject({ status: 'proposed', after: correction });
    expect(itemOf(repair, 'letter-2')).toMatchObject({ status: 'proposed', after: 'Sam wrote the Helm change; I tested it on two lab nodes.' });
  });
});
