// Words Voice Transcribe wrote twice in a row: found in any language and case, kept once on removal.
import { describe, expect, it } from 'vitest';
import { dropRepeats, repeatedWords } from '../../client/src/lib/repeats.js';

// The opening of Ana's voice note as Muse Voice Transcribe heard it in the 3 Nov judge run.
const HEARD = 'Chamome Ana. Eu Eu trabalho há três anos num lar em Leeds. No No fim do turno, escrevo as daily notes em inglês e assino a folha da da medicação.';

describe('repeated words', () => {
  it('finds each run, as it stands, and keeps the first of each', () => {
    expect(repeatedWords(HEARD)).toEqual(['Eu Eu', 'No No', 'da da']);
    expect(dropRepeats(HEARD)).toBe('Chamome Ana. Eu trabalho há três anos num lar em Leeds. No fim do turno, escrevo as daily notes em inglês e assino a folha da medicação.');
  });

  it('matches whole words with accents, in any case, and a word said three times', () => {
    expect(repeatedWords('Não não, foram dois anos.')).toEqual(['Não não']);
    expect(dropRepeats('foi foi foi assim')).toBe('foi assim');
    expect(repeatedWords('a amiga da dama')).toEqual([]);
    expect(repeatedWords('18 18 residentes')).toEqual([]);
  });

  // Two-word stutters from the 4 Nov live run, which the one-word pattern let through to the pack.
  it('finds a run of two or three words said twice', () => {
    expect(repeatedWords('para cada pessoa poder pessoa poder apontar')).toEqual(['pessoa poder pessoa poder']);
    expect(dropRepeats('Os turnos da noite foram noite foram dois anos')).toBe('Os turnos da noite foram dois anos');
    // Four words or more are left for her to fix by hand.
    expect(repeatedWords('dois mil e vinte dois mil e vinte e três')).toEqual([]);
    expect(dropRepeats('em dois mil dois mil e vinte')).toBe('em dois mil e vinte');
    expect(repeatedWords('cada cada pessoa')).toEqual(['cada cada']);
  });

  it('leaves text without repeats exactly as it was', () => {
    const text = 'Eu trabalho há três anos num lar em Leeds.';
    expect(repeatedWords(text)).toEqual([]);
    expect(dropRepeats(text)).toBe(text);
    expect(repeatedWords(undefined)).toEqual([]);
  });
});
