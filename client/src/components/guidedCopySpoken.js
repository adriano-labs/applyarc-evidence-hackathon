// The walk-through's words for a sample who speaks another language (Ana): her words stay hers,
// and each English meaning is hers to confirm. Ellie's and Marcus's copy stays in guidedCopy.js.
// A step with no entry here (deciding about an earlier fact) uses the shared copy.
import { pronouns } from '../flow.js';
import { languageName } from '../lib/language.js';

const NAMES = { Wonder: 'Muse Wonder', 'Spark Open': 'Muse Spark Open' };

// Step 1: her words as Voice Transcribe heard them, or her written note, said plainly.
function notesCopy(name, p, lang, { isMeta, spoken, minutes }) {
  const reads = isMeta ? 'Meta reads them' : 'The app reads them';
  if (!isMeta) return { h1: `${name}’s notes, in ${lang}`, why: `${reads} and keeps every fact tied to ${p.possessive} exact ${lang}.`, expect: 'Hand-written fixture, not a live model: the same steps run from stored outputs, and you decide every one. Her written note is used here (typed, not spoken).' };
  if (!spoken) return { h1: `${name}’s notes, in ${lang}`, why: `${reads} and keeps every fact tied to ${p.possessive} exact ${lang}.`, expect: `${p.Possessive} written note is used here (typed, not spoken).` };
  const time = minutes ? ` (about ${minutes} minutes in all in our live runs)` : '';
  return { h1: `${name}’s words, as Meta heard them`, why: `Muse Voice Transcribe wrote them down. ${reads} and keeps every fact tied to ${p.possessive} exact ${lang}.`, expect: `Meta’s models hear, read, ask, write, check and repair${time}, and you decide every step. Watch each step in “What Meta did” below.` };
}

// The key moment: said once by voice on the live model, or typed (the fixture's hand-written rewrites).
function changeCopy(name, p, { who, voice }) {
  const h1 = 'Facts change. Watch what happens.';
  if (who === 'The fixture') return { h1, why: 'Correct one fact. Only the sentences that cite it reopen; the fixture stands in with hand-written rewrites. Nothing else changes, and you decide each one.' };
  if (!voice) return null;
  return { h1, why: `${name} remembers something. ${p.subject[0].toUpperCase()}${p.subject.slice(1)} says it once; ${NAMES[who] ?? who} reads it against ${p.possessive} confirmed facts, flags the contradiction itself and asks ${p.object} which is right. Only the sentences that cite that fact reopen, and you decide each rewrite.` };
}

export function spokenCopy(stepKey, { sample, isMeta, factCount, busy, who, voice, spoken }) {
  const name = sample.name;
  const p = pronouns(sample.possessive);
  const lang = languageName(sample.language);
  const docs = sample.form?.documents ?? [];
  const title = (docs[0]?.title ?? 'answer').toLowerCase();
  const employer = sample.employerShort ?? sample.form?.company ?? 'the employer';
  const copy = {
    notes: () => notesCopy(name, p, lang, { isMeta, spoken, minutes: sample.minutes }),
    facts: () => ({ h1: `${isMeta ? 'Meta found' : 'Found'} ${factCount} facts in ${name}’s own words`, why: `Check each one is right. Only facts you confirm can be used in ${p.possessive} application.` }),
    check: () => ({ h1: 'Checking what the form still needs', why: `The app compares ${p.possessive} facts with ${employer}’s ${docs[0]?.requirements?.length ?? ''} points, and asks only if something is missing.`.replace('’s  points', '’s points') }),
    question: () => ({ h1: `One thing ${p.possessive} words don’t say`, why: `The form asks what ${p.subject} understands and does ${p.reflexive}, so the app asks for the missing detail, in ${p.possessive} language.` }),
    draft: () => ({ h1: busy?.name === 'draft' ? `Writing ${p.possessive} application` : `Ready to write ${p.possessive} application`, why: 'Every factual sentence will cite the facts it uses.' }),
    answer: () => ({ h1: `${p.Possessive} ${title}, in English, with ${p.possessive} ${lang} beside it`, why: `Tap a number: ${p.possessive} exact words, and what they mean.` }),
    change: () => changeCopy(name, p, { who, voice }),
    finish: () => ({ h1: `Done: ${p.possessive} ${title} and letter, in English, from ${p.possessive} own words`, why: `Copy them into ${employer}’s form yourself. Nothing has been sent.` }),
  };
  return copy[stepKey]?.() ?? null;
}
