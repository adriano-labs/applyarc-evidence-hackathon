// The status line while a model step runs says what each tool call did in plain
// words; the receipts keep the exact tool names.
import { describe, expect, it } from 'vitest';
import { leftOutNotice, toolLine } from '../../client/src/flow.js';

describe('the status line while a step runs', () => {
  it('says what each tool call did, in plain words', () => {
    expect(toolLine('verify_quote', 'verbatim')).toBe('Checked a quote word for word against the notes');
    expect(toolLine('verify_quote', 'not verbatim')).toBe('Found a quote that is not word for word in the notes');
    expect(toolLine('word_count', '240 of 300')).toBe('Counted the words: 240 of 300');
    expect(toolLine('form_requirements', 'read')).toBe('Read what the form asks for');
  });

  it('falls back to the tool’s own name for a tool it does not know', () => {
    expect(toolLine('something_new', 'done')).toBe('something_new: done');
  });
});

describe('the notice after a draft that left sentences out', () => {
  it('says how many, in plain words, and that the applicant may add them back', () => {
    expect(leftOutNotice([])).toBeNull();
    expect(leftOutNotice([{ docId: 'letter', text: 'x', reason: 'r' }])).toBe('The review could not establish support for 1 sentence, so it was left out. Check the evidence before adding your own wording.');
    expect(leftOutNotice([{}, {}])).toBe('The review could not establish support for 2 sentences, so they were left out. Check the evidence before adding your own wording.');
  });
});
