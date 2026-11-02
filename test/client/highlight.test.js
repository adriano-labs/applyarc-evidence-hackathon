import { describe, expect, it } from 'vitest';
import { highlightParts } from '../../client/src/lib/highlight.js';

describe('highlightParts', () => {
  it('splits a text into plain and highlighted parts for each quote it contains', () => {
    const text = 'We used Redis for the queue. It took us three days.';
    expect(highlightParts(text, [{ id: 'f1', quote: 'Redis for the queue', status: 'confirmed' }, { id: 'f2', quote: 'three days', status: 'proposed' }])).toEqual([
      { text: 'We used ' },
      { text: 'Redis for the queue', factId: 'f1', status: 'confirmed' },
      { text: '. It took us ' },
      { text: 'three days', factId: 'f2', status: 'proposed' },
      { text: '.' },
    ]);
  });

  it('finds a quote across line breaks and runs of spaces, as the app’s verbatim rule does', () => {
    const text = 'Took us\n three  days.';
    const parts = highlightParts(text, [{ id: 'f1', quote: 'us three days', status: 'confirmed' }]);
    expect(parts).toEqual([{ text: 'Took ' }, { text: 'us\n three  days', factId: 'f1', status: 'confirmed' }, { text: '.' }]);
  });

  it('keeps the first of two overlapping quotes and ignores quotes that are not there', () => {
    const parts = highlightParts('abc def ghi', [{ id: 'a', quote: 'abc def', status: 'confirmed' }, { id: 'b', quote: 'def ghi', status: 'confirmed' }, { id: 'c', quote: 'xyz', status: 'confirmed' }]);
    expect(parts).toEqual([{ text: 'abc def', factId: 'a', status: 'confirmed' }, { text: ' ghi' }]);
  });

  it('returns the whole text as one part when there are no quotes', () => {
    expect(highlightParts('plain', [])).toEqual([{ text: 'plain' }]);
    expect(highlightParts('', [])).toEqual([]);
  });
});

describe('highlightParts dashes', () => {
  it('matches a plain hyphen in a quote against an en or em dash in the text, as the app normalises them', () => {
    const parts = highlightParts('Sept 2025 – March 2026.', [{ id: 'f1', quote: 'Sept 2025 - March 2026', status: 'confirmed' }]);
    expect(parts[0]).toEqual({ text: 'Sept 2025 – March 2026', factId: 'f1', status: 'confirmed' });
  });
});
