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

  // 2 Nov UI: compatible team detail was wrongly held. The old static assertion
  // encoded that policy bug; this checks the revised prompt contract, not model behaviour.
  it('permits compatible personal detail while retaining authorship, denial and uncertainty rails (prompt contract)', () => {
    const prompt = extractPrompt({ source: { text: 'I planned the themes.' }, question: { text: 'What did you do yourself?', requirementId: 'contribution' } });
    expect(prompt).toContain('A team, shared, or unattributed account does not exclude the applicant.');
    expect(prompt).toContain("A later explicit statement of the applicant's personal contribution can add detail while leaving the earlier account intact; extract only that stated contribution and never infer sole ownership.");
    expect(prompt).toContain('Naming another contributor does not by itself establish exclusive authorship.');
    expect(prompt).toContain('Still ask when the accounts contradict exclusive authorship or an explicit denial of involvement, or when new uncertainty undermines a previously asserted personal contribution or scope.');
    expect(prompt).toContain('Do not invent joint work or an unstated distinction to reconcile incompatible accounts.');
    expect(prompt).toContain('A practice exercise versus real production, or a design/model versus completed building work, can need clarification; these are examples, not banned words.');
    expect(prompt).not.toContain('that is a conflict: ask whether they did it themselves.');
  });

  it('links only an action, not a lesson, a liking or a wish, to what the applicant did', () => {
    const rule = 'A fact answers a requirement about what the applicant did only when it says they did something; what they learned, liked or want answers a learning or motivation requirement instead.';
    expect(extractPrompt({ source: { text: 'I learned to watch body language.' } })).toContain(rule);
    expect(clarifyPrompt({ askable: [], facts: [], notes: [] })).toContain(rule);
  });
});
