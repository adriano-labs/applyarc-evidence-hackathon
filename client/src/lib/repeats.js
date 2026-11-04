// Words Voice Transcribe wrote twice in a row ("Eu Eu trabalho", "noite foram noite foram"): one to
// three words, in any language and any case. They are shown to the applicant and removed only when
// she taps to remove them. Unicode lookarounds, not \b: \b is ASCII-only in JavaScript, so it misses "não não".
const REPEAT = /(?<![\p{L}\p{N}])(\p{L}+(?:\s+\p{L}+){0,2})(?:\s+\1)+(?![\p{L}\p{N}])/giu;

// Each run of repeated words, as it stands in the text ("Eu Eu").
export const repeatedWords = (text) => [...String(text ?? '').matchAll(REPEAT)].map((m) => m[0]);

// The text with each run kept once, as first written ("Eu Eu trabalho" → "Eu trabalho").
export const dropRepeats = (text) => String(text ?? '').replace(REPEAT, '$1');
