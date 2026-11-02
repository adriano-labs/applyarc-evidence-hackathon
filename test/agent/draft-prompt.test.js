// The draft prompt states the evidence check's own rules, and a refused draft comes
// back with how to fix each kind of problem, not only what was wrong (Marcus, live, 27 Oct:
// two tries in a row wrote "I" for work his notes say "we" did).
import { describe, expect, it } from 'vitest';
import { draftPrompt, repairPrompt } from '../../server/agent/prompts.js';
import { reviewPrompt } from '../../server/agent/evidenceReview.js';

const doc = { id: 'answer', title: 'Why this role', wordLimit: 250, question: 'Why do you want this role?' };
const prompt = (problems) => draftPrompt({ doc, facts: [], coverage: [], applicant: 'Marcus', company: 'Harbourline', role: 'Marketing Assistant', problems });

describe('the draft prompt', () => {
  it('says whose work a sentence may claim, as the evidence check does', () => {
    expect(prompt()).toContain('A sentence about the applicant ("I", "me", "my …", their name, or a sentence with no subject) must cite a fact where the applicant says "I" did that same thing. A fact that says "we", "our", "my team" or names someone else supports only a sentence that says so ("four of us built …", "Sam wrote …, and I tested it").');
    expect(prompt()).not.toContain('"my" or "me"');
  });

  it('says which words and numbers it may never add', () => {
    expect(prompt()).toContain('Never write "led", "managed", "supervised", "owned", "founded", "designed", "single-handedly", or an award, prize, promotion or ranking, unless a cited fact says it. State numbers, in digits or in words, only as the facts state them.');
  });

  // 29 Oct held-out runs on Modal and Baseten: letters that described only the team's
  // work although a confirmed fact said what the applicant did themselves.
  it('asks the letter to show what the applicant did themselves', () => {
    const letter = draftPrompt({ doc: { id: 'letter', title: 'Cover letter', wordLimit: 400, question: 'Cover letter' }, facts: [], coverage: [], applicant: 'Marcus', company: 'Harbourline', role: 'Marketing Assistant' });
    expect(letter).toContain('In the paragraphs of relevant work, include what the applicant did themselves wherever a confirmed fact says so, not only the team\'s work.');
  });

  // Same runs: answers said one thing twice because a note and a later correction both stated it.
  it('says a point that two facts share only once', () => {
    expect(prompt()).toContain('When two facts say the same thing, say it once and cite both.');
  });

  // 29 Oct held-out runs: answers that opened mid-story ("We timed each stop and cut the route…").
  it('opens the answer by setting the scene', () => {
    expect(prompt()).toContain('Its first sentence names the project, where it happened and when (a placement, job, course or event), so a reader who knows nothing else understands what the project was.');
  });

  it('tells a refused draft how to fix each kind of problem', () => {
    const p = prompt(['Sentence 3: a claim says "I" where its facts say "we"']);
    expect(p).toContain('Fix exactly these and keep everything else: Sentence 3: a claim says "I" where its facts say "we".');
    expect(p).toContain('To fix them, say only what each sentence\'s facts say: where they say "we", write "we"; where someone else did it, say so; leave out any number, title or achievement they do not state.');
    expect(p).not.toContain('cite a fact in which the applicant says "I"');
  });
});

// 29 Oct held-out runs: a correction's rewrite dropped "and the tests for it" and
// "Imogen corrected nine of them". The repair keeps every part the new fact states,
// and the review, which judges meaning against the quote, refuses a rewrite that drops it.
describe('a correction keeps what the applicant did', () => {
  it('tells the repair to keep each part the new fact states', () => {
    const fact = { id: 'f3', statement: 'Sam found it; I tested the fix.', quote: 'Sam found it; I tested the fix.', history: [{ statement: 'I found and fixed it.', quote: 'I found and fixed it.' }] };
    expect(repairPrompt({ fact, items: [], facts: [] })).toContain('Keep each thing the new fact says the applicant did, and each name and number it states, wherever the sentence covered that ground; drop only what the correction overturns.');
  });

  it('checks sentence support separately from whole-document retention', () => {
    expect(reviewPrompt([])).toContain('Sentence support does not require one sentence to repeat every contribution: retention checks assess omissions across the whole projected document.');
    expect(reviewPrompt([])).toContain("A teammate's action cannot cover a missing applicant action.");
    expect(reviewPrompt([])).toContain("a claim that keeps wording the correction overturned is contradicted");
  });
});

// Held-out set 2 (29 Oct): a requirement with no linked fact was left out of the
// answer although a confirmed fact said it, because the prompt said not to mention it.
describe('a requirement with no linked fact', () => {
  it('may be answered from a confirmed fact that states it, and the gap is never filled', () => {
    const text = draftPrompt({ doc, facts: [], applicant: 'Marcus', company: 'Harbourline', role: 'Marketing Assistant',
      coverage: [{ id: 'goal', text: 'What you were trying to achieve', covered: false, factIds: [] }, { id: 'tech', text: 'The main tools you used', covered: false, factIds: [] }] });
    expect(text).toContain('- These requirements have no fact linked to them yet: What you were trying to achieve; The main tools you used. Answer one only where a confirmed fact below states it; never fill the gap with anything the facts do not say.');
    expect(text).not.toContain('Do not mention them');
  });
});

// Held-out set 2 (29 Oct): a repair repeated a sentence the document already had.
describe('the repair prompt', () => {
  it('shows the documents around the listed sentences, for context only', () => {
    const fact = { id: 'f3', statement: 'Sam wrote it; I tested it.', quote: 'Sam wrote it; I tested it.', history: [{ statement: 'I wrote it.', quote: 'I wrote it.' }] };
    const items = [{ segmentId: 'answer-2', docId: 'answer', before: 'I wrote it.', factIds: ['f3'] }];
    const documents = [{ docId: 'answer', sentences: [{ segmentId: 'answer-1', text: 'We chose Jobs.' }, { segmentId: 'answer-2', text: 'I wrote it.' }] }];
    const text = repairPrompt({ fact, items, facts: [], documents });
    expect(text).toContain('Read the documents around the listed sentences for context only: never repeat what another sentence already says, and rewrite only the listed sentences.');
    expect(text).toContain(`<documents_now>\n${JSON.stringify(documents, null, 2)}\n</documents_now>`);
  });
});
