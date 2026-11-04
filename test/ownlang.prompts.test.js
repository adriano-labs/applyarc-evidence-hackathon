// Own language: what each step tells the model. English prompts and schemas are byte for byte
// what they were at the base commit (hashes taken there on these inputs), so Ellie's runs and
// their cache are unchanged. In another language one block goes just before the data, the same
// on every call, and the reviewer reads her original words, never the English gloss.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { clarifyPrompt, draftPrompt, extractPrompt, INSTRUCTIONS, repairPrompt } from '../server/agent/prompts.js';
import { reviewClaims, reviewPrompt } from '../server/agent/evidenceReview.js';
import { clarifySchema, draftSchema, extractSchema, repairSchema } from '../server/agent/schemas.js';
import { confirmFacts, proposeFacts } from '../server/domain/facts.js';
import { addSource, createWorkspace } from '../server/domain/workspace.js';
import { fromRoot } from '../server/paths.js';

const sha = (s) => createHash('sha256').update(typeof s === 'string' ? s : JSON.stringify(s)).digest('hex');
const gc = JSON.parse(readFileSync(fromRoot('fixtures', 'graphcore-form-2026-10-26.json'), 'utf8'));
const notes = readFileSync(fromRoot('fixtures', 'ellie-notes.md'), 'utf8');
const facts = [{ id: 'f1', statement: 'We built a GPU job runner.', quote: 'We built a self-service GPU job runner' }, { id: 'f2', statement: 'I wrote the Helm change.', quote: 'I wrote the Helm change' }];
const coverageFor = gc.documents[0].requirements.map((r, i) => ({ ...r, docId: 'answer', covered: i < 2, factIds: i < 2 ? ['f1'] : [] }));
const source = { id: 's1', kind: 'notes', text: notes };

describe('English prompts and schemas, unchanged from the base commit', () => {
  it('has the same bytes', () => {
    expect({
      INSTRUCTIONS: sha(INSTRUCTIONS),
      extract: sha(extractPrompt({ source, evidence: [source] })),
      clarify: sha(clarifyPrompt({ askable: [{ id: 'contribution', text: 'Your individual contribution', personal: true }], facts, notes: [notes] })),
      draftAnswer: sha(draftPrompt({ doc: gc.documents[0], facts, coverage: coverageFor, applicant: 'Ellie', company: 'Graphcore', role: gc.role })),
      repair: sha(repairPrompt({ fact: { id: 'f2', statement: 'Sam wrote it.', quote: 'Sam wrote it.', history: [{ statement: 'I wrote it.', quote: 'I wrote it.' }] }, items: [{ segmentId: 'answer-1', docId: 'answer', before: 'I wrote it.', factIds: ['f2'] }], facts, documents: [] })),
      review: sha(reviewPrompt([{ id: 'c1', text: 'I wrote the Helm change.', evidence: [{ from: 'the applicant’s notes', quote: 'I wrote the Helm change', sourcePassages: ['I wrote the Helm change.'] }] }])),
      extractSchema: sha(extractSchema(['goal', 'contribution'], ['s1', 's2'])),
      clarifySchema: sha(clarifySchema(['contribution'], ['f1', 'f2'])),
    }).toEqual({
      INSTRUCTIONS: 'e737b0b16fe25fed222ab07813a803e6fe1dc778856bba158bec56f9f48f1be5',
      extract: '252487531c5ef952225c3cf3413084be50cdb4a57d6609cac03dc297e8b39cbb',
      clarify: 'b2ab047b35b586ee2f150f60eeebc63e7a1ff79154090027a1e3c6c955a90c3a',
      draftAnswer: '330d7e283a9d9b1ed2cbfdd29383ad7c9771e29e04ec957e8f805924fd8666d8',
      repair: '070f6a6f5d4286a68fad39493531526dd3b26917eacf7a4cb280eac136289467',
      review: 'd35ce048422850042a8805c00a0b88f964204ecf3dbda5912a42698c6166b25b',
      extractSchema: '6efec84eccca429e83eea205844cb0f6b46b4316e72c0973b82379c8aa6631a3',
      clarifySchema: '03ca4db73e162f5a6af38fa49c7f932a75e3138487c101b2e37f3147c0239336',
    });
  });
});

describe('prompts in another language', () => {
  const pt = { id: 's1', kind: 'notes', text: 'Fiz três anos de noites.', language: 'pt-PT' };

  it('asks extraction for her exact words, an English meaning and who did it, just before the data', () => {
    const prompt = extractPrompt({ source: pt, evidence: [pt] });
    const block = 'The applicant spoke Portuguese. Copy each quote exactly as they said it, in Portuguese';
    expect(prompt).toContain(block);
    expect(prompt).toContain('When one sentence says what the team did and what the applicant did, return two facts, each quoting only its own clause.');
    // Live, 3 Nov: her notes' meanings came back as "Applicant has worked…", and one lost its number.
    expect(prompt).toContain('Write each statement in English, in the applicant\'s own person as they said it ("I" where they did it, "we" where the team did, never "the applicant")');
    expect(prompt).toContain('keeping every number, written in digits.');
    expect(prompt.indexOf(block)).toBeLessThan(prompt.indexOf('<active_source_context>'));
    expect(prompt.slice(0, prompt.indexOf(block))).toBe(extractPrompt({ source: { ...pt, language: undefined }, evidence: [pt] }).slice(0, prompt.indexOf(block)));
    expect(extractPrompt({ source: pt, evidence: [pt] })).toBe(prompt);
  });

  it('asks the form check’s question in her language with the English beneath', () => {
    expect(clarifyPrompt({ askable: [], facts: [], notes: [], language: 'pt-PT' })).toContain('Write each question in Portuguese, in plain words, and the same question in English in english.');
  });

  it('tells drafting and repair to translate faithfully from her quote, never embellish', () => {
    const ptFacts = [{ id: 'f1', statement: 'I did three years of nights.', quote: 'Fiz três anos de noites.', language: 'Portuguese', actor: 'self' }];
    const rule = 'translate faithfully from the quote: keep who did it, every number and the scope, and never embellish';
    expect(draftPrompt({ doc: gc.documents[0], facts: ptFacts, coverage: [] })).toContain(rule);
    const fact = { ...ptFacts[0], history: [{ statement: 'x', quote: 'y' }] };
    expect(repairPrompt({ fact, items: [], facts: ptFacts })).toContain(rule);
    expect(repairPrompt({ fact, items: [], facts: ptFacts })).toContain('"language": "Portuguese"');
  });

  it('gives the bilingual schemas an actor enum and the English fields', () => {
    const schema = extractSchema(['rota'], ['s1'], true);
    expect(schema.properties.facts.items.properties.actor).toEqual({ type: 'string', enum: ['self', 'team', 'other'] });
    expect(schema.properties.facts.items.required).toEqual(['quote', 'statement', 'actor', 'requirementIds']);
    expect(schema.properties.conflicts.items.required).toEqual(['quote', 'priorSourceId', 'priorQuote', 'question', 'english', 'meaning', 'actor']);
    expect(clarifySchema(['rota'], ['f1'], true).properties.questions.items.required).toEqual(['requirementId', 'question', 'english', 'why']);
    expect(draftSchema(['f1']).properties.segments.items.properties.factIds.items.enum).toEqual(['f1']);
    expect(repairSchema(['answer-1'], ['f1']).properties.rewrites.items.properties.segmentId.enum).toEqual(['answer-1']);
  });

  it('sends the reviewer her original words marked with their language, never the English meaning', async () => {
    const ws = createWorkspace({ form: structuredClone(gc), applicant: 'Ana' });
    const s = addSource(ws, { kind: 'notes', text: 'Fiz três anos de noites, e também fins de semana.', language: 'pt-PT' });
    s.read = true;
    proposeFacts(ws, s.id, [{ statement: 'I did three years of nights, and weekends too.', quote: 'Fiz três anos de noites, e também fins de semana.', actor: 'self', requirementIds: [] }]);
    confirmFacts(ws, ['f1']);
    const review = vi.fn(async ({ claims }) => ({ decisions: claims.map((c) => ({ id: c.id, verdict: 'supported', reason: 'ok' })) }));
    const agent = { provider: { id: 'meta' }, review };
    const stages = [];
    const verdicts = await reviewClaims(ws, [
      { kind: 'claim', text: 'I worked nights for three years, and weekends too.', factIds: ['f1'] },
      { kind: 'claim', text: 'I worked nights for four years.', factIds: ['f1'] },
    ], agent, (e) => stages.push(e.label));
    expect(stages).toEqual(['Checking each sentence against your Portuguese words']);
    const [{ claims }] = review.mock.calls[0];
    expect(claims).toHaveLength(1); // "four" was refused by code before any model read it
    expect(claims[0].evidence).toEqual([{ from: 'the applicant’s notes', quote: 'Fiz três anos de noites, e também fins de semana.', sourcePassages: ['Fiz três anos de noites, e também fins de semana.'], language: 'Portuguese' }]);
    expect(JSON.stringify(claims)).not.toContain('I did three years of nights');
    expect(reviewPrompt(claims)).toContain('Judge each English claim against that original-language quote itself, for meaning, actor and numbers; no English gloss is given.');
    expect([...verdicts.values()]).toEqual([null, 'It states a number that none of its cited facts states.']);
  });
});
