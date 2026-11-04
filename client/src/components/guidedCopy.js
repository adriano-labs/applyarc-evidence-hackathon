// The headline, the why line and, on the first step, what to expect, for each live step of the
// walk-through. Meta is credited only when Meta ran; the fixture is named as the fixture.
import { pronouns } from '../flow.js';
import { preparedBy } from '../lib/prepared.js';
import { family } from '../lib/trail.js';
import { spokenCopy } from './guidedCopySpoken.js';

const expectation = (isMeta) => (isMeta
  ? 'About five minutes on the live model: Meta’s agents read, ask, write, check and repair, and you decide every step. Watch each step in “What Meta did” below.'
  : 'Hand-written fixture, not a live model: the same steps run from stored outputs, and you decide every one. Watch each step in “What the model did” below.');

// `who` is what drafted the documents: Wonder, Spark, Meta, The model or The fixture.
const changeWhy = (who) => (who === 'The fixture'
  ? 'Correct one fact. Only the sentences that cite it reopen; the fixture stands in with hand-written rewrites. Nothing else changes, and you decide each one.'
  : `Correct one fact. Only the sentences that cite it reopen; ${who} proposes each rewrite and its own review checks them. Nothing else changes, and you decide each one.`);

// On a prepared workspace the key moment is one note the applicant adds; the live model reads it,
// flags the contradiction itself and offers the correction. The facts and drafts were saved earlier.
// `host`: the model this edition runs. Muse Spark Open read the note as new facts in 3 of 5 judge
// runs on 3 Nov, so there the words name it and say what happens then.
const preparedChange = (name, p, isMeta, prepared, host) => ({
  h1: 'Facts change. Watch what happens.',
  why: family(host).tag === 'Spark Open'
    ? `Add ${name}’s note. Muse Spark Open reads it against ${p.possessive} confirmed facts: it may flag the contradiction itself, or read the note as new facts, and then you correct the fact yourself. Only the sentences that cite that fact reopen, and you decide each rewrite.`
    : `Add ${name}’s note. ${isMeta ? 'Meta' : 'The model'} reads it against ${p.possessive} confirmed facts, flags the contradiction itself and offers the correction. Only the sentences that cite that fact reopen, and you decide each rewrite.`,
  expect: `${p.Possessive} facts and both drafts were ${preparedBy(prepared, host)}, before this visit. The correction and the repair run live now.`,
});

// `sample`: a sample who speaks another language (Ana) has her own words for each step.
export function stepCopy(stepKey, { sampleName, possessive, isMeta, factCount, busy, who, prepared = null, sample = null, voice = false, spoken = false, host }) {
  const p = pronouns(possessive);
  if (stepKey === 'change' && prepared) return preparedChange(sampleName, p, isMeta, prepared, host);
  const own = sample?.language ? spokenCopy(stepKey, { sample, isMeta, factCount, busy, who, voice, spoken }) : null;
  if (own) return own;
  const copy = {
    notes: { h1: `These are ${sampleName}’s rough notes`, why: `${isMeta ? 'Meta reads' : 'The app reads'} them and keeps every fact tied to ${p.possessive} exact words.`, expect: expectation(isMeta) },
    facts: { h1: `${isMeta ? 'Meta found' : 'Found'} ${factCount} facts in ${sampleName}’s own words`, why: `Check each one is right. Only facts you confirm can be used in ${p.possessive} answer.` },
    check: { h1: 'Checking what the form still needs', why: `The app compares ${p.possessive} facts with what the form asks for, and asks only if something is missing.` },
    question: { h1: `One thing ${p.possessive} notes don’t say`, why: `The form asks what ${p.subject} did ${p.reflexive}, so the app asks for the missing detail.` },
    decide: { h1: 'Is this earlier fact still right?', why: `${p.Possessive} answer was about a fact from ${p.possessive} notes. Keep it, correct it or remove it before the drafts are written.` },
    draft: { h1: busy?.name === 'draft' ? `Writing ${p.possessive} application` : `Ready to write ${p.possessive} answer`, why: 'Every factual sentence will cite the facts it uses.' },
    answer: { h1: `${p.Possessive} answer, with evidence beside it`, why: 'Tap a number to see the words it came from.' },
    change: { h1: 'Facts change. Watch what happens.', why: changeWhy(who) },
    finish: { h1: 'Done: two documents you can stand behind', why: 'Copy them into the employer’s form yourself.' },
  };
  return copy[stepKey] ?? copy.notes;
}
