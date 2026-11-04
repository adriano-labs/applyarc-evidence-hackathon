// The Evidence Pass and the draft's head line for words in another language: her Portuguese first,
// the English meaning labelled a working translation, who did it, and what drafted the English.
// An English pass keeps every byte it had.
import { describe, expect, it } from 'vitest';
import { evidencePassHtml } from '../../client/src/lib/evidencePass.js';
import { draftedFromLine } from '../../client/src/lib/spokenLines.js';

const pack = (refs) => ({
  applicant: 'Ana',
  application: { company: 'North Yorkshire Council', role: 'Care and Support Worker' },
  documents: [{ id: 'answer', title: 'Supporting evidence', sentences: [{ text: 'I made cards with photos of the food.', refs: [1], startsParagraph: true }], references: refs }],
});
const PT = { n: 1, statement: 'I made cards with photos of the food.', quote: 'Eu fiz cartões com fotografias da comida.', from: 'notes', language: 'pt-PT', actor: 'self', spoken: true };

describe('a bilingual Evidence Pass', () => {
  it('shows her words, their working translation and who did it, and says so in the intro and footer', () => {
    const html = evidencePassHtml(pack([PT]), { drafter: 'Meta Muse Wonder 1.0' });
    expect(html).toContain('<q lang="pt-PT">Eu fiz cartões com fotografias da comida.</q> <span class="meaning">In English (working translation): I made cards with photos of the food.</span> <span class="from">From Ana’s voice note · Ana did this</span>');
    expect(html).toContain('Every cited sentence links to Ana’s own words, which Ana confirmed. Ana spoke in Portuguese; each English meaning is a working translation Ana confirmed, not a certified one.');
    expect(html).toContain('These sentences were drafted with AI (Meta Muse Wonder 1.0) from words Ana spoke in Portuguese; Ana confirmed each English meaning, and Ana approved this exact version.');
    expect(html).toContain('It is not a reference check or an assessment of Ana.');
    expect(html).toContain('.meaning {');
  });

  it('keeps an English pass exactly as it was: no meaning line, no style for it, no language sentence', () => {
    const html = evidencePassHtml(pack([{ n: 1, statement: 'Ana made cards.', quote: 'I made cards', from: 'notes' }]), { drafter: 'Meta Muse Wonder 1.0' });
    expect(html).toContain('<li id="answer-ref-1" class="ref"><q>I made cards</q> <span class="from">From Ana’s notes</span></li>');
    expect(html).not.toMatch(/working translation|\.meaning|spoke in|wrote in/);
    expect(html).toContain('These sentences were drafted with AI (Meta Muse Wonder 1.0) from Ana’s confirmed words, and Ana approved this exact version.');
  });
});

describe('the drafting line on the document head', () => {
  const ws = (spoken) => ({
    applicant: { name: 'Ana', sources: [{ id: 's1', kind: 'notes', ...(spoken ? { spoken: true } : {}) }], facts: [{ id: 'f1', language: 'pt-PT', actor: 'self' }, { id: 'f2' }] },
  });
  const doc = { segments: [{ factIds: ['f1'] }] };
  const receipts = [{ flow: 'draft', model: 'muse-wonder-1.0', provider: 'meta', isMeta: true }];

  it('names the model, the language and who confirmed the meanings', () => {
    expect(draftedFromLine(ws(true), doc, receipts)).toBe('Drafted with Muse Wonder from words spoken in Portuguese; Ana confirmed each English meaning.');
    expect(draftedFromLine(ws(false), doc, [{ flow: 'draft', model: 'fixture', provider: 'fixture' }])).toBe('Written by the hand-written fixture from words written in Portuguese; Ana confirmed each English meaning.');
  });

  it('says nothing for a document that cites only English facts', () => {
    expect(draftedFromLine(ws(true), { segments: [{ factIds: ['f2'] }] }, receipts)).toBeNull();
  });
});
