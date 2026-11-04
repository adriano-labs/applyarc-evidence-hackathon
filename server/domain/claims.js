// Lexical diagnostics for the labelled, fixed fixture. Shared words do not
// establish semantic support. Live drafts and repairs use the separate,
// evidence-bound review in evidenceReview.js before admission.
import { GROUP, PERSON, clausesIn, clausesOf, isPast, tokens } from './attribution.js';
import { normalise, numbers } from './text.js';

// Words a draft may not add: each needs the same word, or a listed equivalent, in a cited fact.
export const STRONG_WORDS = [
  [/\b(led|lead|leads|leading|leader|leadership|headed|spearhead(?:ed|ing)?)\b(?!\s+to\b)/i, /\b(led|lead|leads|leading|leader|leadership|headed|in charge)\b/i],
  [/\b(manag(?:e|ed|es|ing|er|ers|ement))\b/i, /\bmanag(?:e|ed|es|ing|er|ers|ement)\b/i],
  [/\b(supervis(?:e|ed|es|ing|or|ion)|oversaw|oversee(?:s|ing)?)\b/i, /\b(supervis\w*|oversaw|oversee\w*)\b/i],
  [/\b(owned|owner|ownership)\b/i, /\b(owned|owner|ownership)\b/i],
  [/\b(founded|founder|founding|co-?found(?:ed|er|ing))\b/i, /\b(founded|founder|founding|co-?found\w*)\b/i],
  [/\b(designed|designing|architected)\b/i, /\b(design\w*|architect\w*)\b/i],
  [/\b(single-handedly|solely|alone|unaided|independently|on my own|by myself)\b/i, /\b(single-handedly|solely|alone|unaided|independently|on my own|myself)\b/i],
  [/\b(won|wins|winning|winner|awards?|awarded|award-winning|prizes?)\b/i, /\b(won|win|wins|winning|winner|awards?|awarded|prizes?)\b/i],
  [/\b(promoted|promotion)\b/i, /\b(promoted|promotion)\b/i],
  [/\b(nominated|nomination)\b/i, /\b(nominated|nomination)\b/i],
  [/\b(recogni[sz]ed|recognition)\b/i, /\b(recogni[sz]ed|recognition)\b/i],
  [/\b(published|patents?|patented)\b/i, /\b(published|patents?|patented)\b/i],
  [/\b(certified|certification|certificate|accredited|accreditation)\b/i, /\b(certified|certification|certificate|accredited|accreditation)\b/i],
  [/\b(ranked|first-ever|record-breaking|nationally|internationally|national|international)\b/i, /\b(ranked|first-ever|record-breaking|nationally|internationally|national|international)\b/i],
];

const STOP = new Set(('a an the and or but if then so of to in on at by for with from into onto over under about after before during '
  + 'through between as than that this these those it its it\'s is are was were be been being am have has had having do does did done '
  + 'will would shall should can could may might must not no also very really just more most much many some any each every all both '
  + 'such there here where when while which who whom whose what why how i i\'m i\'ve i\'d i\'ll me my mine myself we we\'re we\'ve us our ours '
  + 'ourselves you your he him his she her hers herself himself they them their theirs themselves one up out off down again once even '
  + 'still yet too per cent percent via around about').split(' '));
const IRREGULAR = { built: 'build', led: 'lead', ran: 'run', wrote: 'write', written: 'write', made: 'make', took: 'take', grew: 'grow', grown: 'grow', won: 'win', went: 'go', gone: 'go', got: 'get', kept: 'keep', sent: 'send', spent: 'spend', taught: 'teach', found: 'find', chose: 'choose', chosen: 'choose', began: 'begin', begun: 'begin', brought: 'bring', bought: 'buy', sold: 'sell', met: 'meet', held: 'hold', gave: 'give', given: 'give', saw: 'see', seen: 'see', told: 'tell', thought: 'think', became: 'become', came: 'come', did: 'do', done: 'do', drove: 'drive', driven: 'drive', paid: 'pay', stood: 'stand', understood: 'understand', showed: 'show', shown: 'show', spoke: 'speak', left: 'leave', lost: 'lose', people: 'person', children: 'child' };

function stem(word) {
  let w = word.toLowerCase().replace(/'s$/, '');
  if (IRREGULAR[w]) return IRREGULAR[w];
  if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3);
  else if (w.length > 4 && (w.endsWith('ied') || w.endsWith('ies'))) w = `${w.slice(0, -3)}y`;
  else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
  return w;
}

// Two stems match when equal, or when one extends the other by a letter or two ("plan", "plann").
export const same = (a, b) => a === b || (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a)) && Math.abs(a.length - b.length) <= 2);

// Content-word stems in order, repeats kept; stems() is the same without repeats.
export function stemWords(text, skip = new Set()) {
  const words = normalise(text).toLowerCase().split(/[^a-z0-9']+/).filter(Boolean);
  return words.filter((w) => !STOP.has(w) && !skip.has(w)).map(stem);
}

export function stems(text, skip = new Set()) {
  return [...new Set(stemWords(text, skip))];
}

export const shared = (claimStems, text) => {
  const others = stems(text);
  return claimStems.filter((s) => others.some((o) => same(s, o))).length;
};

// "Four students and I built it", "including me", "as part of a team", "I worked on":
// the applicant counted among the doers, which the team's words support.
const JOINT = new RegExp([
  String.raw`\b(team|teammates|team-mates|colleagues|group|classmates|people|students|others|friends|engineers|developers|members|of us) and i\b`,
  String.raw`\bi and (my|our|the) (team|teammates|team-mates|colleagues|group|classmates)\b`,
  String.raw`\b(including|alongside|along with) me\b|\bme included\b`,
  String.raw`\b(as )?(a )?(part|member|one) of (a|the|our|my) (\w+ )?(team|group|squad|class|cohort)\b`,
  String.raw`\bone of (two|three|four|five|six|seven|eight|nine|ten|\d+) (students|people|engineers|developers|members)\b`,
  String.raw`\bi (worked on|worked in|worked with|was part of|was one of|took part in|contributed to|joined|helped)\b`,
].join('|'), 'i');
const SELF_WORDS = new Set(['i', "i'm", "i've", "i'd", "i'll", 'me', 'myself', 'mine']);
const TEAM_WORDS = new Set(['we', "we're", "we've", "we'd", "we'll", 'us', 'our', 'ours', 'ourselves']);
const LEADING = /^(\w+ly|also|then|later|eventually|finally|together|recently|previously)$/;

// Whose work a clause of a claim describes: the applicant's, the team's, or nobody's in particular.
function clauseDoer(clause, firstName) {
  if (JOINT.test(clause)) return 'team';
  const words = tokens(clause);
  if (words.some((w) => SELF_WORDS.has(w.lower))) return 'self';
  if (firstName && words.some((w) => w.raw === firstName)) return 'self';
  // "four of us built it, in my final year" is the team's: who did it outranks whose it was.
  if (words.some((w) => TEAM_WORDS.has(w.lower)) || /\b(the|our|my) (whole )?team\b/i.test(clause)) return 'team';
  if (words.some((w, i) => w.lower === 'my' && !PERSON.test(words[i + 1]?.lower ?? '') && !GROUP.test(words[i + 1]?.lower ?? ''))) return 'self';
  const lead = words.findIndex((w) => !LEADING.test(w.lower));
  const verb = words[lead]?.lower ?? '';
  const after = words[lead + 1]?.lower ?? '';
  if (isPast(verb) && !/^(in|on|by|with|for|from|at|to|as|into|onto)$/.test(after)) return 'self';
  return 'none';
}

const NOT_WHO = {
  team: 'a claim says "I" where its facts say "we"',
  other: 'a claim says "I" where its facts say someone else did it',
};

// The numbers a cited fact states. An English quote is read for digits and words; a
// quote in another language for digits only, joined by the numbers of the English
// meaning the applicant confirmed beside it.
const factNumbers = (c) => [...numbers(c.quote, c.language ?? 'en'), ...(c.language ? numbers(c.meaning ?? '') : [])];

// A number, in digits or in words, that no cited fact states. Deterministic, so the
// live review runs it first too: the model reviewer once accepted "a team of three" from "me + 2".
// cited: [{ quote, language?, meaning? }]
export function statesNewNumber(text, cited, roleTitle = '') {
  const claim = normalise(text);
  const role = normalise(roleTitle);
  const quoted = new Set(cited.flatMap(factNumbers));
  return numbers(role ? claim.replace(role, ' ') : claim).some((n) => !quoted.has(n));
}

// These English word checks read a fact in another language through its confirmed
// English meaning and its confirmed actor, never its quote.
const englishOf = (c) => (c.language ? c.meaning ?? '' : c.quote);
const linesOf = (c) => (c.language ? [{ text: c.meaning ?? '', doer: c.actor, explicit: c.actor === 'self' }] : clausesOf(c.quote, c.source));

// cited: [{ quote, source, language?, meaning?, actor? }] for each fact the claim cites; source is the text the quote came from.
export function claimProblem(text, cited = [], { roleTitle = '', applicantName = '' } = {}) {
  const claim = normalise(text);
  const role = normalise(roleTitle);
  const firstName = normalise(applicantName).split(' ')[0] ?? '';
  const quotes = cited.map((c) => normalise(englishOf(c)));
  const claimStems = stems(role ? claim.replace(role, ' ') : claim, new Set(firstName ? [firstName.toLowerCase()] : []));
  const need = claimStems.length <= 3 ? 1 : 2;
  if (statesNewNumber(claim, cited, roleTitle)) return 'a claim states a number its facts do not';
  if (shared(claimStems, quotes.join(' ')) < Math.min(need, claimStems.length)) return 'a claim says something its facts do not';
  for (const [inClaim, inFacts] of STRONG_WORDS) {
    const word = claim.match(inClaim)?.[1];
    if (word && !quotes.some((q) => inFacts.test(q))) return `a claim says "${word.toLowerCase()}" where its facts do not`;
  }
  // Each part of the sentence about the applicant needs a line where the applicant says they did it.
  const lines = cited.flatMap(linesOf);
  for (const part of clausesIn(claim).filter((c) => clauseDoer(c.text, firstName) === 'self')) {
    const partStems = stems(part.text, new Set(firstName ? [firstName.toLowerCase()] : []));
    const enough = Math.min(partStems.length <= 3 ? 1 : 2, partStems.length);
    const scored = lines.map((l) => ({ ...l, score: shared(partStems, l.text) }));
    if (scored.some((l) => l.doer === 'self' && l.score >= enough)) continue;
    const best = scored.filter((l) => l.doer !== 'self').sort((a, b) => b.score - a.score)[0];
    return NOT_WHO[best?.doer] ?? 'a claim says "I" where its facts do not say who did it';
  }
  return null;
}

// The facts a sentence cites, as quotes with the text each came from; a fact in another
// language also carries its language, its confirmed English meaning and its actor.
export function citedFacts(ws, factIds, confirmedMap) {
  const sources = new Map((ws?.applicant?.sources ?? []).map((s) => [s.id, s.text]));
  return factIds.map((id) => confirmedMap.get(id)).filter(Boolean).map((f) => ({
    quote: f.quote, source: sources.get(f.sourceId) ?? f.quote,
    ...(f.language ? { language: f.language, meaning: f.statement, actor: f.actor } : {}),
  }));
}

export const checkContext = (ws) => ({ roleTitle: ws?.application?.form?.role ?? '', applicantName: ws?.applicant?.name ?? '' });
