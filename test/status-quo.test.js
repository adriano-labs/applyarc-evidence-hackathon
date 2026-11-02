// The status-quo arm's message is fixed before any run: one plain request, as a job
// seeker would type it, with the same clarification the other arms receive.
import { describe, expect, it } from 'vitest';
import { statusQuoPrompt } from '../scripts/status-quo.mjs';

describe('statusQuoPrompt', () => {
  it('asks for both documents in one plain message, with nothing but what the person said', () => {
    const prompt = statusQuoPrompt({
      input: { role: 'Production Assistant', company: 'Linnet & Shaw', notes: 'Our team re-planned the jacket layout.', question: 'Tell us about a time you reduced waste.', wordLimit: 200 },
      clarificationAnswer: 'I measured a 30% drop in fabric waste.',
    });
    expect(prompt).toBe([
      "I'm applying for the Production Assistant role at Linnet & Shaw. Here are my notes about a project:",
      '',
      'Our team re-planned the jacket layout.',
      '',
      'What I did myself: I measured a 30% drop in fabric waste.',
      '',
      'Please write my answer to this application question, in no more than 200 words:',
      'Tell us about a time you reduced waste.',
      '',
      'Then write a cover letter for the role.',
    ].join('\n'));
  });
});
