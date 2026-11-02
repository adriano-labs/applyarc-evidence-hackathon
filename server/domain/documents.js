// The two documents (project answer and cover letter) as lists of segments.
// A claim segment cites at least one confirmed fact; a frame segment (a
// greeting, the role line, a closing line or a sign-off) cites none and goes
// before or after the claims, never between them.
import { STRONG_WORDS, checkContext, citedFacts, claimProblem } from './claims.js';
import { refuse } from './errors.js';
import { normalise, numbers, wordCount } from './text.js';
import { confirmedFacts, DOC_IDS, formDocument } from './workspace.js';
import { frameOptions } from './frames.js';
import { reviewKey } from '../agent/evidenceReview.js';
import { pendingSourceConflict } from './sourceConflicts.js';
import { unansweredRequirements } from './completeness.js';
import { coverage } from './facts.js';

const MAX_FRAME_WORDS = 25;

function checkDocId(docId) {
  if (!DOC_IDS.includes(docId)) refuse('invalid', 'Unknown document.');
}

// What still stops a draft. Empty when drafting may start.
export function draftBlockers(ws) {
  const { sources, facts } = ws.applicant;
  const blockers = [];
  const conflict = pendingSourceConflict(ws);
  if (conflict) blockers.push(conflict);
  if (!sources.some((s) => s.kind === 'notes')) blockers.push('Add your notes first.');
  if (facts.some((f) => f.status === 'proposed')) blockers.push('Confirm or reject every proposed fact.');
  if (ws.application.questions.some((q) => q.status === 'open')) blockers.push('Answer or skip the open question.');
  if (!facts.some((f) => f.status === 'confirmed')) blockers.push('Confirm at least one fact.');
  return blockers;
}

const ROLE_WORD = /\b(role|position|post|job title)\b/i;

// A frame says nothing about the applicant: a greeting or the role line before the
// claims, a closing line or a sign-off after them.
function frameProblem(text, index, claims, ws) {
  if (wordCount(text) > MAX_FRAME_WORDS) return 'a greeting or sign-off is short';
  const role = normalise(ws.application.form.role ?? '');
  if (ROLE_WORD.test(text) && (!role || !text.includes(role))) return 'a sentence that names the role must use its exact title';
  if (numbers(role ? text.replace(role, ' ') : text).length) return 'a greeting or sign-off states no numbers';
  if (STRONG_WORDS.some(([word]) => word.test(text))) return 'a greeting or sign-off makes no claims';
  const options = frameOptions({ ...ws.application.form, applicant: ws.applicant.name });
  const same = (value) => normalise(value).replace(/[,.!]$/, '') === text.replace(/[,.!]$/, '');
  const opening = options.openings.some(same);
  const closing = options.closings.some(same);
  if (!opening && !closing) return 'only a greeting, the role line, a closing line or a sign-off may cite no facts';
  if ((opening && index < claims.first) || (closing && index > claims.last)) return null;
  return 'a greeting or sign-off goes before or after the claims, not between them';
}

function segmentProblem(segment, index, claims, ws, confirmedMap, review) {
  const text = normalise(segment?.text);
  const factIds = segment?.factIds ?? [];
  if (!text) return 'empty sentence';
  if (factIds.some((id) => !confirmedMap.has(id))) return 'cites a fact that is not confirmed';
  if (segment.kind === 'frame') {
    if (factIds.length) return 'a greeting or sign-off cites no facts';
    return frameProblem(text, index, claims, ws);
  }
  if (segment.kind !== 'claim') return 'unknown segment kind';
  if (!factIds.length) return 'a claim must cite a fact';
  if (review) return review.has(reviewKey(ws, segment)) ? review.get(reviewKey(ws, segment)) : 'This wording needs a new evidence review.';
  return claimProblem(text, citedFacts(ws, factIds, confirmedMap), checkContext(ws));
}

// Another sentence of the document already has the same normalised text.
export function saidBefore(text, earlier) {
  const normalised = normalise(text).replace(/[.!?]+$/, '');
  return earlier.some((other) => normalise(other).replace(/[.!?]+$/, '') === normalised);
}

// A "them" sentence must not turn one person into a group (seen live: the notes
// said "One learner…", but the letter put "I asked them…" straight after
// "I supported four learners…").
const THEM = /\bthem\b|^(they|their)\b/i;
const beforeThem = (text) => text.split(/\b(?:them|they|their)\b/i)[0];

function oneBecomesMany(ws, segments, i) {
  const own = normalise(segments[i].text);
  if (!THEM.test(own)) return null;
  const cited = new Set(segments[i].factIds ?? []);
  const previous = segments.slice(0, i).filter((s) => s?.kind === 'claim').at(-1);
  const confirmed = ws.applicant.facts.filter((f) => f.status === 'confirmed');
  for (const fact of confirmed.filter((f) => cited.has(f.id) && THEM.test(normalise(f.quote)))) {
    // The one person is named in the quote itself ("One learner…, so I asked them…")
    // or in the fact just before it in the notes.
    let named = fact;
    let one = beforeThem(normalise(fact.quote)).match(/\bone\s+(\w+)/i)?.[1];
    if (!one) {
      const text = normalise(ws.applicant.sources.find((src) => src.id === fact.sourceId)?.text ?? '');
      const end = (f) => text.indexOf(normalise(f.quote)) + normalise(f.quote).length;
      named = confirmed.filter((f) => f.sourceId === fact.sourceId && f.id !== fact.id && text.includes(normalise(f.quote))
        && end(f) <= text.indexOf(normalise(fact.quote))).sort((x, y) => end(y) - end(x))[0];
      if (!named || cited.has(named.id) || previous?.factIds?.includes(named.id)) continue;
      one = normalise(named.quote).match(/\b(?:one|an?)\s+(\w+)/i)?.[1];
    }
    // The sentence names that one person itself ("the learner who…").
    if (!one || new RegExp(`\\b(?:one|an?|the|that)\\s+${one}\\b`, 'i').test(beforeThem(own))) continue;
    if (new RegExp(`\\b${one}s\\b`, 'i').test(`${previous?.text ?? ''} ${beforeThem(own)}`)) {
      return `turns one ${one} into several: say which one, as your notes do (“${named.quote}”)`;
    }
  }
  return null;
}

export function draftProblems(ws, segments, review) {
  const confirmed = new Map(confirmedFacts(ws).map((f) => [f.id, f]));
  const at = segments.map((s, i) => (s?.kind === 'claim' ? i : -1)).filter((i) => i >= 0);
  const claims = { first: at[0] ?? Infinity, last: at.at(-1) ?? -Infinity };
  return segments.map((s, i) => [i, segmentProblem(s, i, claims, ws, confirmed, review)
    ?? (s?.kind === 'claim' ? oneBecomesMany(ws, segments, i) : null)]).filter(([, p]) => p);
}

export function setDraft(ws, docId, segments, review) {
  checkDocId(docId);
  const blockers = draftBlockers(ws);
  if (blockers.length) refuse('not-ready', blockers[0], { blockers });
  const current = ws.application.documents[docId];
  if (current?.segments.some((s) => s.author === 'user')) {
    refuse('would-overwrite', 'This document has your edits; a new draft would replace them.');
  }
  const problems = draftProblems(ws, segments, review);
  if (!segments.length || problems.length) {
    refuse('invalid-draft', 'The draft did not pass the evidence check.', { problems });
  }
  const doc = {
    id: docId,
    revision: (current?.revision ?? 0) + 1,
    segments: segments.map((s, i) => ({
      id: `${docId}-${i + 1}`,
      kind: s.kind,
      text: normalise(s.text),
      factIds: [...new Set(s.factIds ?? [])],
      startsParagraph: i === 0 || Boolean(s.startsParagraph),
      author: 'draft',
    })),
  };
  ws.application.documents[docId] = doc;
  return doc;
}

export function findSegment(ws, docId, segmentId) {
  checkDocId(docId);
  const doc = ws.application.documents[docId];
  const segment = doc?.segments.find((s) => s.id === segmentId);
  if (!segment) refuse('invalid', 'That sentence no longer exists.');
  return { doc, segment };
}

// The applicant's own edit. The sentence keeps its citations and becomes
// theirs: a later repair must ask before touching it.
export function editSegment(ws, docId, segmentId, text) {
  if (ws.application.repair) refuse('repair-open', 'Finish reviewing the changes first.');
  const { doc, segment } = findSegment(ws, docId, segmentId);
  const wording = normalise(text);
  if (!wording) refuse('invalid', 'A sentence cannot be empty.');
  if (wording === segment.text) return doc;
  Object.assign(segment, { text: wording, author: 'user' });
  doc.revision += 1;
  return doc;
}

export function documentText(doc) {
  if (!doc) return '';
  return doc.segments
    .map((s, i) => (i > 0 && s.startsParagraph ? `\n\n${s.text}` : `${i > 0 ? ' ' : ''}${s.text}`))
    .join('');
}

export function documentStats(ws, docId) {
  const doc = ws.application.documents[docId];
  const { wordLimit } = formDocument(ws, docId);
  const words = wordCount(documentText(doc));
  const pick = ({ id, text }) => ({ id, text });
  const unanswered = doc ? unansweredRequirements(ws, docId).map(pick) : [];
  // Requirements no confirmed fact covers: asked about and skipped, or never answerable from the notes.
  const leftOut = doc ? coverage(ws).filter((r) => r.docId === docId && !r.covered).map(pick) : [];
  const ownWords = (doc?.segments ?? []).filter((s) => s.author === 'user').length;
  return { words, wordLimit, overLimit: words > wordLimit, unanswered, leftOut, ownWords };
}
