// A reason for wanting the role or the employer is a fact, kept with the employer
// detail that makes it specific (live, 28 Oct: "Why Graphcore" lost "Graphcore builds
// both the hardware and the cloud platform…", leaving the letter's motivation generic).
import { describe, expect, it } from 'vitest';
import { clarifyPrompt, extractPrompt } from '../../server/agent/prompts.js';

describe('the extraction prompt', () => {
  it('keeps a reason for wanting the job together with what the applicant names about the employer', () => {
    const prompt = extractPrompt({ source: { text: 'Why Graphcore: I liked the infrastructure side, and Graphcore builds both the hardware and the cloud platform.' } });
    expect(prompt).toContain('A reason the applicant gives for wanting this role or this employer is a fact too. Keep what they say about the employer in the same quote ("I liked X, and Graphcore builds Y"): that detail is what makes the reason specific.');
  });

  // 29 Oct held-out run: an answer saying "I planned the themes" where the notes said
  // "our team planned the themes" was confirmed and drafted; the baseline asked first.
  it('treats "I did it" against notes that give it to the team or a named person as a question to ask', () => {
    const prompt = extractPrompt({ source: { text: 'I planned the themes.' }, question: { text: 'What did you do yourself?', requirementId: 'contribution' } });
    expect(prompt).toContain('If the new words say the applicant did something themselves that active_source_context gives to the team or to a named person ("we planned" or "Sam planned" before, "I planned" now), that is a conflict: ask whether they did it themselves.');
  });

  it('links only an action, not a lesson, a liking or a wish, to what the applicant did', () => {
    const rule = 'A fact answers a requirement about what the applicant did only when it says they did something; what they learned, liked or want answers a learning or motivation requirement instead.';
    expect(extractPrompt({ source: { text: 'I learned to watch body language.' } })).toContain(rule);
    expect(clarifyPrompt({ askable: [], facts: [], notes: [] })).toContain(rule);
  });
});
