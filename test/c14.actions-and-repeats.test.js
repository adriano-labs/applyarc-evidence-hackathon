import { describe, expect, it } from 'vitest';
import { reviewKey } from '../server/agent/evidenceReview.js';
import { draftProblems } from '../server/domain/documents.js';
import { decideFact, proposeFacts } from '../server/domain/facts.js';
import { proposeRewrites } from '../server/domain/repair.js';
import { retentionChecks } from '../server/domain/retention.js';
import { workspaceWithNotes } from './helpers.js';

// 30 Oct contract migration: lexical overlap cannot prove semantic retention.
// These tests enforce exact review authority; real-model accuracy is evaluated separately.
const correction = 'Alex led the project. I tested backups and documented recovery.';
function retainedDocument() {
  const ws = {
    applicant: { facts: [{ id: 'f1', sourceId: 's1', status: 'confirmed', quote: correction, statement: correction }], sources: [{ id: 's1', kind: 'correction', text: correction }] },
    application: {
      repair: { factId: 'f1', status: 'awaiting-proposal', items: [{ id: 'c1', docId: 'answer', segmentId: 'answer-1', before: 'I led the project.', status: 'pending', after: null }] },
      documents: { answer: { segments: [{ id: 'answer-1', text: 'I led the project.', factIds: ['f1'] }, { id: 'answer-2', text: 'My personal closing sentence.', factIds: [], author: 'user' }] }, letter: { segments: [] } },
    },
  };
  const proposal = { segmentId: 'answer-1', text: 'I checked backups and wrote recovery instructions; Alex led the project.', factIds: ['f1'] };
  const check = retentionChecks(ws, [proposal])[0];
  const review = new Map([[reviewKey(ws, proposal), null], [check.key, { verdict: 'supported', reason: 'Both corrected actions remain.' }]]);
  return { ws, proposal, review, check };
}
const resultItem = (ws, proposal, review) => proposeRewrites(ws, [proposal], review).repair.items[0];

describe('domain admission requires the exact document retention verdict', () => {
  it('refuses a sentence-only support verdict', () => {
    const { ws, proposal } = retainedDocument();
    expect(resultItem(ws, proposal, new Map([[reviewKey(ws, proposal), null]]))).toMatchObject({ status: 'needs-review', after: null });
  });
  it('accepts the same reviewed document and preserves manual text', () => {
    const { ws, proposal, review } = retainedDocument();
    expect(resultItem(ws, proposal, review)).toMatchObject({ status: 'proposed', after: proposal.text });
    expect(ws.application.documents.answer.segments[1].text).toBe('My personal closing sentence.');
  });
  it.each([
    ['rewrite wording', (ws, p) => { p.text += ' I worked alone.'; }],
    ['unchanged document wording', (ws) => { ws.application.documents.answer.segments[1].text = 'Different manual closing.'; }],
    ['corrected quote', (ws) => { ws.applicant.facts[0].quote = 'Alex led the project. I only watched.'; }],
    ['fact status', (ws) => { ws.applicant.facts[0].status = 'rejected'; }],
    ['source text', (ws) => { ws.applicant.sources[0].text = 'That earlier note was wrong.'; }],
    ['source withheld', (ws) => { ws.applicant.sources[0].withheld = true; }],
  ])('refuses authority after %s changes', (_label, mutate) => {
    const { ws, proposal, review } = retainedDocument();
    mutate(ws, proposal);
    expect(resultItem(ws, proposal, review)).toMatchObject({ status: 'needs-review', after: null });
  });
  it('does not transfer retention authority between documents', () => {
    const { ws, proposal, review, check } = retainedDocument();
    const other = JSON.parse(check.key); other[1] = 'letter';
    review.delete(check.key);
    review.set(JSON.stringify(other), { verdict: 'supported', reason: 'The other document was reviewed.' });
    expect(resultItem(ws, proposal, review)).toMatchObject({ status: 'needs-review', after: null });
  });
});

// Seen in the graded runs: two near-identical letter sentences (office lighting)
// and one sentence saying the same thing twice (care home).
const notes = [
  'Kemble Brook Electrical takes on adult apprentices and pairs each one with the same electrician for their first year.',
  'Marcus, the activities coordinator, led the sessions and chose what we did each week.',
  'He led the weekly activity sessions there.',
  'Our team of three set up the lounge and handed out the quiz sheets.',
  'I set up the lounge.',
].join('\n\n');

function draftWorkspace() {
  const { ws, source } = workspaceWithNotes(notes);
  const quotes = notes.split('\n\n');
  proposeFacts(ws, source.id, quotes.map((quote) => ({ statement: quote, quote, requirementIds: ['evidence'] })));
  for (const f of ws.applicant.facts) decideFact(ws, f.id, 'confirm');
  return ws;
}
const claim = (text, factIds) => ({ kind: 'claim', text, factIds });
const accepted = (ws, segments) => new Map(segments.map((s) => [reviewKey(ws, s), null]));
const problemsFor = (ws, segments) => new Map(draftProblems(ws, segments, accepted(ws, segments)));

describe('supported meaning is not rejected by repeated word pairs', () => {
  it('leaves stylistic repetition to writing review without rejecting supported facts', () => {
    const ws = draftWorkspace();
    const segments = [claim('Marcus, the activities coordinator, led the sessions and chose what we did each week, and he led the weekly activity sessions there.', ['f2', 'f3'])];
    expect(problemsFor(ws, segments).size).toBe(0);
  });

  it('accepts a team-then-me sentence that repeats a word pair (guitar, graded set 3)', () => {
    const ws = draftWorkspace();
    const segments = [claim("On Saturdays at a guitar repair shop our workshop team worked through a backlog of second-hand guitars that needed setting up before they could be sold, and the guitars I worked on were the shop's own practice guitars, not customer jobs.", ['f4', 'f5'])];
    expect(problemsFor(ws, segments).size).toBe(0);
  });

  it('accepts different claims that share a few words', () => {
    const ws = draftWorkspace();
    const segments = [
      claim('Our team of three set up the lounge and handed out the quiz sheets.', ['f4']),
      claim('I set up the lounge.', ['f5']),
    ];
    expect(problemsFor(ws, segments).size).toBe(0);
  });
});
