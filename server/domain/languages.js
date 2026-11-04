// The languages an applicant may speak or write in besides English. A source or fact
// with no language is English. Code reads number words and "I" only in English; in any
// other language only digits count, and who did it comes from the actor tag the
// applicant confirms with each fact.
import { refuse } from './errors.js';

export const ENGLISH = 'en';
export const ACTORS = ['self', 'team', 'other'];

// name: in English, for prompts and labels; native: in the language itself, for the chooser.
// asks: the app's own question when the model leaves a personal point unasked.
export const LANGUAGES = {
  'pt-PT': { name: 'Portuguese', native: 'Português', asks: (point) => `O formulário pede “${point}”: o que escreveria?` },
};

export const languageOf = (item) => item?.language ?? ENGLISH;
export const isEnglish = (item) => languageOf(item) === ENGLISH;
export const languageName = (code) => LANGUAGES[code]?.name ?? 'English';

// A language from a request: undefined when none was given, ENGLISH or a supported code otherwise.
export function checkLanguage(code) {
  if (code === undefined || code === null || code === '') return undefined;
  if (code !== ENGLISH && !LANGUAGES[code]) refuse('invalid', 'Choose English or one of the languages offered.');
  return code;
}

// The language of the applicant's latest own words (a correction takes its fact's language).
export function applicantLanguage(ws) {
  return languageOf(ws.applicant.sources.filter((s) => s.kind !== 'correction').at(-1));
}

// The client's list for the chooser: English first.
export const languageChoices = () => [{ code: ENGLISH, name: 'English', native: 'English' },
  ...Object.entries(LANGUAGES).map(([code, l]) => ({ code, name: l.name, native: l.native }))];

// A fact as the model reads it. A fact in another language also names its language and
// actor; an English fact is exactly { id, statement, quote }.
export const factForModel = ({ id, statement, quote, language, actor }) => ({ id, statement, quote, ...(language ? { language: languageName(language), actor } : {}) });
