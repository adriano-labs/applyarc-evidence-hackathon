// Plain-text rules shared by facts, documents and checks.

const SMART = [[/[‘’′]/g, "'"], [/[“”″]/g, '"'], [/[–—]/g, '-']];

// Typographic quotes and dashes count as their plain forms, runs of
// whitespace as one space. Case and wording must match exactly.
export function normalise(text) {
  let out = String(text ?? '');
  for (const [pattern, plain] of SMART) out = out.replace(pattern, plain);
  return out.replace(/\s+/g, ' ').trim();
}

export function isVerbatim(quote, source) {
  const q = normalise(quote);
  return q.length >= 3 && normalise(source).includes(q);
}

export function wordCount(text) {
  return normalise(text).split(' ').filter(Boolean).length;
}

const NUMBER_WORDS = {
  two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const SCALES = { dozen: 12, hundred: 100, thousand: 1000, million: 1000000 };
const WORD = `(?:${Object.keys(NUMBER_WORDS).join('|')}|${Object.keys(SCALES).join('|')})`;
// "one" and "a" count only inside a number ("one hundred", "twenty-one"), never alone.
const NUMBER_PHRASE = new RegExp(`\\b(?:(?:a|one|${WORD})(?:[\\s-]+(?:and[\\s-]+)?))*${WORD}(?:[\\s-]+one)?\\b`, 'g');

function phraseValue(phrase) {
  let total = 0;
  let current = 0;
  for (const word of phrase.split(/[\s-]+/)) {
    if (word === 'and') continue;
    if (word === 'a' || word === 'one') current += 1;
    else if (NUMBER_WORDS[word]) current += NUMBER_WORDS[word];
    else if (word === 'dozen' || word === 'hundred') current = (current || 1) * SCALES[word];
    else if (SCALES[word]) { total += (current || 1) * SCALES[word]; current = 0; }
  }
  return total + current;
}

// Every number a text states, in digits or in words, as plain digits ("2,100" is
// "2100", "twelve" is "12"); a percentage keeps its "%", however it is written.
// Digits inside a word ("k3s") are part of a name, not a number.
export function numbers(text) {
  const lower = normalise(text).toLowerCase().replace(NUMBER_PHRASE, (phrase) => ` ${phraseValue(phrase)} `);
  const found = lower.replace(/(\d),(?=\d{3}\b)/g, '$1').matchAll(/(?<![a-z0-9.])(\d+(?:\.\d+)?)(\s*(?:%|per\s*cent\b|percent\b))?/g);
  return [...found].map((m) => m[1] + (m[2] ? '%' : ''));
}
