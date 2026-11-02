import { describe, expect, it } from 'vitest';
import { diffLines } from '../../client/src/lib/diff.js';

const marks = (runs) => runs.filter((r) => r.changed).map((r) => r.text);
const text = (runs) => runs.map((r) => r.text).join('');

describe('diffLines', () => {
  it('returns each sentence as one unchanged run when nothing changed', () => {
    expect(diffLines('I wrote it.', 'I wrote it.')).toEqual({ was: [{ text: 'I wrote it.', changed: false }], now: [{ text: 'I wrote it.', changed: false }] });
  });

  it('marks the removed words in the old line and the added words in the new one', () => {
    const { was, now } = diffLines('I wrote the Helm change.', 'Sam wrote the Helm change.');
    expect(marks(was)).toEqual(['I']);
    expect(marks(now)).toEqual(['Sam']);
  });

  it('gives back both sentences exactly, spaces and line breaks included', () => {
    const pairs = [
      ['When jobs started dying in week 9, I traced the failures through dmesg and wrote the Helm change that fixed them.', 'When jobs started dying in week 9, I diagnosed it, then tested the fix my teammate Sam wrote.'],
      ['In week 9,  jobs started\ndying at random.', 'In week 9, jobs began dying at random, even tiny ones.'],
      ['I wrote the fix, in three days.', 'I tested the fix Sam wrote.'],
    ];
    for (const [a, b] of pairs) {
      const { was, now } = diffLines(a, b);
      expect(text(was)).toBe(a);
      expect(text(now)).toBe(b);
    }
  });

  it('marks a changed phrase as one run, the spaces inside it included', () => {
    const { was, now } = diffLines('a b c', 'x y c');
    expect(was).toEqual([{ text: 'a b', changed: true }, { text: ' c', changed: false }]);
    expect(now).toEqual([{ text: 'x y', changed: true }, { text: ' c', changed: false }]);
  });

  it('never yields empty runs or two neighbours with the same flag', () => {
    for (const runs of Object.values(diffLines('a b c d e', 'a x c y e'))) {
      expect(runs.every((r) => r.text.length > 0)).toBe(true);
      expect(runs.every((r, i) => i === 0 || r.changed !== runs[i - 1].changed)).toBe(true);
    }
  });

  it('handles empty sentences', () => {
    expect(diffLines('', 'New text')).toEqual({ was: [], now: [{ text: 'New text', changed: true }] });
    expect(diffLines('Old text', '')).toEqual({ was: [{ text: 'Old text', changed: true }], now: [] });
    expect(diffLines('', '')).toEqual({ was: [], now: [] });
  });
});
