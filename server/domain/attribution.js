// Who did what, in the applicant's own words. Each clause of the notes is given
// the doer it names: the applicant ("I", "myself", "my part"), their team ("we",
// "our", "my team", "four of us") or someone else ("my teammate Sam", "they",
// "head office"); "it", "this" and "there" name a thing, not a doer. A clause
// that names no one takes the doer of the clause before it in its sentence, then
// the first doer its paragraph names, then the first one the notes name, and is
// the applicant's own when the notes name no one at all.
import { normalise } from './text.js';

const LEAD = 6; // a clause names its doer within its first few words
const SELF = new Set(['i', "i'm", "i've", "i'd", "i'll", 'myself']);
const TEAM = new Set(['we', "we're", "we've", "we'd", "we'll", 'us', 'our', 'ours', 'ourselves']);
const OTHER = new Set(['they', "they're", "they've", 'he', "he's", 'she', "she's"]);
const THING = new Set(['it', "it's", 'this', 'that', 'these', 'those', 'there']);
export const GROUP = /^(team|teams|teammates|team-mates|group|class|classmates|cohort|squad|crew|staff|department)$/;
export const PERSON = /^(teammate|team-mate|colleague|colleagues|manager|boss|supervisor|lecturer|tutor|mentor|partner|friend|friends|client|customer|director)$/;
const MY_PART = /^(part|role|job|task|bit|contribution|responsibility|share|piece)$/;
// A heading the applicant writes about themselves ("Learned:", "Why Graphcore:", "Course:").
const SELF_LABEL = /^(learned|learnt|lessons?( learned| learnt)?|takeaways?|why\b.*|my part|my role|courses?|training|education|about me|skills?)$/i;
const NOT_NAMES = new Set(['the', 'a', 'an', 'in', 'on', 'at', 'for', 'with', 'from', 'by', 'after', 'before', 'during', 'then', 'so', 'and', 'but']);
const IRREGULAR_PAST = new Set(['built', 'led', 'ran', 'wrote', 'made', 'set', 'cut', 'grew', 'won', 'took', 'began', 'chose', 'drove', 'got', 'gave', 'kept', 'put', 'sold', 'spent', 'taught', 'brought', 'bought', 'found', 'held', 'met', 'paid', 'sent', 'stood', 'threw', 'understood', 'went', 'did', 'saw', 'knew', 'thought', 'told', 'became', 'came', 'left', 'lost', 'read', 'shot', 'showed', 'spoke', 'wore']);
const NOT_PAST = new Set(['need', 'speed', 'seed', 'feed', 'bed', 'red', 'shed', 'hundred', 'based', 'used', 'self-taught']);

export const isPast = (word) => IRREGULAR_PAST.has(word) || (/^[a-z-]{3,}ed$/.test(word) && !NOT_PAST.has(word));

// Words with their surrounding punctuation trimmed ("I/O" and "store's" stay whole).
export function tokens(text) {
  return normalise(text)
    .split(' ')
    .map((raw) => raw.replace(/^[^A-Za-z0-9']+|[^A-Za-z0-9']+$/g, ''))
    .filter(Boolean)
    .map((raw) => ({ raw, lower: raw.toLowerCase() }));
}

// The doer a clause names in its first words, or null when it names none.
function namedDoer(clause) {
  const label = clause.match(/^([A-Za-z][\w ,'&-]{0,40}):\s+/)?.[1] ?? '';
  const words = tokens(clause.slice(label ? label.length + 1 : 0)).slice(0, LEAD);
  for (let i = 0; i < words.length; i += 1) {
    const { raw, lower } = words[i];
    const next = words[i + 1]?.lower ?? '';
    if (i === 0 && THING.has(lower)) return 'thing';
    if (SELF.has(lower)) return 'self';
    if (TEAM.has(lower)) return 'team';
    if (OTHER.has(lower)) return 'other';
    if (lower === 'my' && MY_PART.test(next)) return 'self';
    if ((lower === 'my' || lower === 'the') && GROUP.test(next)) return 'team';
    if (lower === 'the' && next === 'whole' && GROUP.test(words[i + 2]?.lower ?? '')) return 'team';
    if (lower === 'my' && PERSON.test(next)) return 'other';
    if (lower === 'head' && next === 'office') return 'other';
    if (/^[A-Z][a-z]+$/.test(raw) && !NOT_NAMES.has(lower) && isPast(next)) return 'other';
  }
  return SELF_LABEL.test(label.trim()) ? 'labelled' : null;
}

// A clause break: the end of a sentence, a semicolon, "but", or "and" before a new doer,
// except inside a joint doer ("four students and I", "my team and I").
const BREAK = /[.!?](?=\s|$)|;|,?\s+(?:but|whereas|while|although|though)\s+|(?<!\b(?:team|teams|teammates|team-mates|colleagues|group|classmates|people|students|others|friends|engineers|developers|members|us))(?:,?\s+and\s+)(?=(?:I|I'm|I've|we|We|our|Our|they|They|he|He|she|She)\b|(?:my|My) (?:team|teammate|colleague|colleagues|manager|boss|supervisor|lecturer|tutor|mentor|partner)\b|(?:the|The) (?:whole )?team\b)/g;

export function clausesIn(paragraph) {
  const clauses = [];
  let start = 0;
  let sentence = 0;
  for (const match of paragraph.matchAll(BREAK)) {
    clauses.push({ start, end: match.index, sentence });
    start = match.index + match[0].length;
    if (/^[.!?]/.test(match[0])) sentence += 1;
  }
  if (start < paragraph.length) clauses.push({ start, end: paragraph.length, sentence });
  return clauses
    .map((c) => ({ ...c, text: paragraph.slice(c.start, c.end).trim() }))
    .filter((c) => c.text)
    .map((c) => ({ ...c, named: namedDoer(c.text) }));
}

// A sentence under the applicant's own heading is theirs, but does not decide its paragraph.
const firstDoer = (clauses) => clauses.find((c) => c.named && c.named !== 'thing' && c.named !== 'labelled')?.named ?? null;

function resolve(clauses, fallback) {
  const own = firstDoer(clauses) ?? fallback;
  let previous = null;
  return clauses.map((c) => {
    const inherited = previous && previous.sentence === c.sentence && previous.doer !== 'thing' ? previous.doer : null;
    const named = c.named === 'labelled' ? 'self' : c.named;
    const doer = named ?? inherited ?? own;
    previous = { sentence: c.sentence, doer };
    return { ...c, doer, explicit: c.named === 'self' };
  });
}

const paragraphsOf = (source) => String(source ?? '').split(/\n\s*\n/).map(normalise).filter(Boolean);

// The clauses of a quote, each with its doer, read in the context of its source.
export function clausesOf(quote, source) {
  const q = normalise(quote);
  const paragraphs = paragraphsOf(source);
  const notes = paragraphs.map(clausesIn);
  const fallback = notes.map(firstDoer).find(Boolean) ?? 'self';
  let at = paragraphs.findIndex((p) => p.includes(q));
  let resolved;
  if (at >= 0) {
    resolved = resolve(notes[at], fallback);
  } else {
    // A quote the source cannot place (it never should): read it on its own.
    const own = clausesIn(q);
    resolved = resolve(own, fallback);
    at = -1;
  }
  const text = at >= 0 ? paragraphs[at] : q;
  const from = text.indexOf(q);
  const to = from + q.length;
  return resolved
    .filter((c) => c.end > from && c.start < to)
    .map((c) => ({ text: text.slice(Math.max(c.start, from), Math.min(c.end, to)).trim(), doer: c.doer, explicit: c.explicit }))
    .filter((c) => c.text);
}

// The applicant says in so many words that they did this ("I fixed it", "my part was").
export const saysSelf = (quote, source) => clausesOf(quote, source).some((c) => c.doer === 'self' && c.explicit);
