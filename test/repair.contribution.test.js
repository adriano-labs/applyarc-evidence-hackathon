import { describe, expect, it, vi } from 'vitest';
import { repairDocuments } from '../server/agent/repairFlow.js';
import { reviewKey } from '../server/agent/evidenceReview.js';
import { repairPrompt } from '../server/agent/prompts.js';
import { decideFact, proposeFacts } from '../server/domain/facts.js';
import { setDraft } from '../server/domain/documents.js';
import { proposeRewrites } from '../server/domain/repair.js';
import { actions } from '../server/flows.js';
import { workspaceWithNotes } from './helpers.js';

// A correction that moves the lead role to someone else but still says what the
// applicant did. Seen live: the repair kept only "Jo led…" and lost her own part.
// The story is the community case; the form is the usual test form.
const notes = [
  'Our neighbourhood group held a weekend repair session. Volunteers welcomed visitors and kept a simple list of the items brought in.',
  'I learned to ask for help when a repair was outside my experience.',
  '',
  'I led the weekend repair session.',
].join('\n');
const correction = 'Jo led the weekend repair session. I welcomed visitors and recorded the items they brought.';
const herPart = 'I welcomed visitors and recorded the items they brought';
const dropped = 'Jo led the weekend repair session.';
const kept = 'Jo led the weekend repair session, and I welcomed visitors and recorded the items they brought.';
const rewrite = (segmentId, text) => ({ segmentId, text, factIds: ['f2'] });

function setup({ fixed = correction, letterCitesIt = false } = {}) {
  const { ws, source } = workspaceWithNotes(notes);
  proposeFacts(ws, source.id, [
    { statement: 'The group held a weekend repair session.', quote: 'Our neighbourhood group held a weekend repair session.', requirementIds: ['decision'] },
    { statement: 'Ellie led the weekend repair session.', quote: 'I led the weekend repair session.', requirementIds: ['contribution'] },
    { statement: 'Ellie learned to ask for help.', quote: 'I learned to ask for help when a repair was outside my experience.', requirementIds: ['evidence'] },
  ]);
  for (const id of ['f1', 'f2', 'f3']) decideFact(ws, id, 'confirm');
  setDraft(ws, 'answer', [
    { kind: 'claim', text: 'Our neighbourhood group held a weekend repair session.', factIds: ['f1'] },
    { kind: 'claim', text: 'I led the weekend repair session.', factIds: ['f2'] },
    { kind: 'claim', text: 'I learned to ask for help when a repair was outside my experience.', factIds: ['f3'] },
  ]);
  setDraft(ws, 'letter', [
    { kind: 'frame', text: 'Dear Graphcore team,' },
    letterCitesIt
      ? { kind: 'claim', text: 'I led the weekend repair session.', factIds: ['f2'], startsParagraph: true }
      : { kind: 'claim', text: 'Our neighbourhood group held a weekend repair session.', factIds: ['f1'], startsParagraph: true },
    { kind: 'frame', text: 'Yours sincerely, Ellie', startsParagraph: true },
  ]);
  actions.changeFact(ws, { factId: 'f2', text: fixed });
  return ws;
}

function agentFor(first, second = []) {
  return {
    provider: { id: 'meta-test-double' },
    repair: vi.fn(async () => ({ rewrites: first })),
    revise: vi.fn(async () => ({ rewrites: second })),
    review: vi.fn(async ({ claims }) => ({ decisions: claims.map((c) => c.kind === 'retention' && c.correctedFact.quote.includes(herPart) && !c.document.map((s) => s.text).join(' ').includes(herPart)
      ? { id: c.id, verdict: 'uncertain', reason: `The document drops ${herPart}.` }
      : { id: c.id, verdict: 'supported', reason: 'The corrected fact supports this.' }) })),
  };
}

const item = (ws, segmentId) => ws.application.repair.items.find((i) => i.segmentId === segmentId);
const reviewedTexts = (agent) => agent.review.mock.calls.flatMap(([input]) => input.claims.map((c) => c.text));

describe('a repair keeps what the applicant did', () => {
  it('sends a rewrite that drops her own part back for one revision after the retention review identifies the omission', async () => {
    const ws = setup();
    const agent = agentFor([rewrite('answer-2', dropped)], [rewrite('answer-2', kept)]);
    await repairDocuments(ws, agent);
    expect(agent.revise).toHaveBeenCalledTimes(1);
    const [{ items }] = agent.revise.mock.calls[0];
    expect(items.map((i) => i.segmentId)).toEqual(['answer-2']);
    expect(items[0].reason).toContain(herPart);
    // The model's retention decision, not a lexical proxy, identified this omission.
    expect(reviewedTexts(agent)).toContain(dropped);
    expect(item(ws, 'answer-2')).toMatchObject({ status: 'proposed', after: kept });
  });

  it('offers her corrected words as she wrote them when the revision still drops her part', async () => {
    const ws = setup();
    const agent = agentFor([rewrite('answer-2', dropped)], [rewrite('answer-2', 'Jo led the weekend repair session.')]);
    await repairDocuments(ws, agent);
    expect(item(ws, 'answer-2')).toMatchObject({ status: 'proposed', after: correction, afterFactIds: ['f2'] });
    // Her own words, word for word, need no model to agree.
    expect(reviewedTexts(agent)).not.toContain(correction);
  });

  it('accepts a rewrite without "I" when the corrected fact gives her no part', async () => {
    const ws = setup({ fixed: 'Jo led the weekend repair session.' });
    const agent = agentFor([rewrite('answer-2', 'Jo led the weekend repair session.')]);
    await repairDocuments(ws, agent);
    expect(agent.revise).not.toHaveBeenCalled();
    expect(item(ws, 'answer-2')).toMatchObject({ status: 'proposed', after: 'Jo led the weekend repair session.' });
  });

  it('checks each document: the letter may not lose her part because the answer kept it', async () => {
    const ws = setup({ letterCitesIt: true });
    const agent = agentFor(
      [rewrite('answer-2', kept), rewrite('letter-2', 'Jo led the weekend repair session.')],
      [rewrite('letter-2', 'Jo led the weekend repair session.')],
    );
    await repairDocuments(ws, agent);
    expect(item(ws, 'answer-2')).toMatchObject({ status: 'proposed', after: kept });
    expect(item(ws, 'letter-2')).toMatchObject({ status: 'proposed', after: correction });
  });

  it('keeps the rule in the domain: sentence support alone cannot admit a rewrite', () => {
    const ws = setup();
    const proposal = rewrite('answer-2', 'Jo led the weekend repair session.');
    const review = new Map([[reviewKey(ws, proposal), null]]);
    proposeRewrites(ws, [proposal], review);
    expect(item(ws, 'answer-2')).toMatchObject({ status: 'needs-review', after: null });
    expect(item(ws, 'answer-2').reason).toContain('new retention review');
  });
  it('tells the model to keep her part, in the first person', () => {
    const fact = { id: 'f2', statement: correction, quote: correction, history: [{ statement: 'Ellie led the weekend repair session.', quote: 'I led the weekend repair session.' }] };
    const prompt = repairPrompt({ fact, items: [], facts: [] });
    expect(prompt).toMatch(/keeps that part, in the first person/);
  });
});
