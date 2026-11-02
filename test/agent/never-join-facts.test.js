import { describe, expect, it } from 'vitest';
import { draftPrompt } from '../../server/agent/prompts.js';
import { reviewPrompt } from '../../server/agent/evidenceReview.js';

describe('joining facts without support', () => {
  it('tells the draft prompt never to join facts to imply unstated place, time or cause', () => {
    const doc = { id: 'answer', title: 'Why this role', wordLimit: 250 };
    const prompt = draftPrompt({ doc, facts: [], coverage: [], applicant: 'A', company: 'B', role: 'C' });
    expect(prompt).toContain('- Never join two facts into one sentence in a way that implies something neither says, such as where or when something happened or that one caused the other.');
  });

  it('tells the evidence review to mark joined facts implying unstated place, time or cause as uncertain', () => {
    const prompt = reviewPrompt([]);
    expect(prompt).toContain('A claim that joins facts so that it implies a place, time or cause that no cited quote states is uncertain, with the reason "joining implies something the facts do not say".');
  });
});
