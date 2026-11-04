import { refuse } from './errors.js';
import { ACTORS } from './languages.js';
import { isVerbatim, normalise } from './text.js';
import { DOC_IDS, findSource, nextId } from './workspace.js';

const PENDING = 'Clarify the conflicting details, or skip them to keep your saved work. To change an earlier fact, use Correct fact.';
const INVALID = 'The source check could not ground its question in your words. Nothing was changed. Try again.';

// Corrections replace their earlier quote, not the rest of the original notes, and a
// fact the applicant removed after a conflict is no longer evidence either.
function sourceHistory(ws, source) {
  const facts = ws.applicant.facts.filter((f) => f.status === 'confirmed' || (f.status === 'rejected' && f.history?.at(-1)?.removed));
  return facts.flatMap((f) => f.history ?? []).filter((h) => h.sourceId === source.id);
}

export function currentSourceText(ws, source) {
  let text = normalise(source.text);
  for (const old of sourceHistory(ws, source)) {
    const quote = normalise(old.quote);
    if (quote) text = text.replaceAll(quote, old.removed ? '[Removed by the applicant]' : '[Superseded by the applicant’s explicit correction]');
  }
  return text;
}

function removalRanges(text, history) {
  const intervals = [];
  for (const old of history) {
    const quote = normalise(old.quote);
    if (!quote) continue;
    for (let at = text.indexOf(quote); at !== -1; at = text.indexOf(quote, at + 1)) {
      intervals.push([at, at + quote.length]);
    }
  }
  const merged = [];
  for (const [start, end] of intervals.sort((a, b) => a[0] - b[0])) {
    const previous = merged.at(-1);
    if (previous && start <= previous[1]) previous[1] = Math.max(previous[1], end);
    else merged.push([start, end]);
  }
  return merged;
}

// A gap stays a boundary: never turn text on either side into a new sentence.
export function currentSourcePassages(ws, source) {
  const text = normalise(source.text);
  const passages = [];
  let cursor = 0;
  for (const [start, end] of removalRanges(text, sourceHistory(ws, source))) {
    const passage = text.slice(cursor, start).trim();
    if (passage) passages.push(passage);
    cursor = end;
  }
  const tail = text.slice(cursor).trim();
  if (tail) passages.push(tail);
  return passages;
}

// Material explicitly left out after a conflict must not become evidence later.
export function activeSourceContext(ws, currentSource) {
  return ws.applicant.sources
    .filter((s) => s.id === currentSource.id || (!s.withheld && (s.read || s.kind === 'correction')))
    .map((s) => ({ id: s.id, kind: s.kind, text: currentSourceText(ws, s) }));
}

function validatedConflict(ws, source, conflicts) {
  if (!Array.isArray(conflicts) || conflicts.length !== 1) refuse('invalid-conflict', INVALID);
  const c = conflicts[0];
  const prior = activeSourceContext(ws, source).find((s) => s.id === c?.priorSourceId);
  if (!prior || typeof c?.question !== 'string' || !isVerbatim(c.quote, source.text)
    || !isVerbatim(c.priorQuote, prior.text) || !c.question.includes('?') || c.question.trim().length > 300
    || (source.language && !glossed(c))) {
    refuse('invalid-conflict', INVALID);
  }
  return c;
}

// In another language the question comes with its English, and the new words with their English meaning and actor.
const glossed = (c) => typeof c.english === 'string' && c.english.includes('?') && c.english.trim().length <= 300
  && typeof c.meaning === 'string' && c.meaning.trim() && c.meaning.trim().length <= 280 && ACTORS.includes(c.actor);

export function holdSourceConflict(ws, source, conflicts) {
  if (conflicts === undefined || (Array.isArray(conflicts) && conflicts.length === 0)) return null;
  const c = validatedConflict(ws, source, conflicts);
  const questions = ws.application.questions;
  const parent = questions.find((q) => q.id === source.questionId);
  const question = parent?.kind === 'source-conflict' ? parent : {
    id: nextId('q', questions), kind: 'source-conflict',
    ...(parent?.requirementId ? { requirementId: parent.requirementId } : {}),
  };
  Object.assign(question, {
    text: c.question.trim(), status: 'open', conflictSourceId: source.id,
    priorSourceId: c.priorSourceId, quote: c.quote, priorQuote: c.priorQuote,
    why: `Earlier: “${c.priorQuote}” Added: “${c.quote}” Your saved work is unchanged. These added details are held back. Skip to leave them out, or use Correct fact to change an earlier fact.`,
    ...(source.language ? { language: source.language, english: c.english.trim(), meaning: c.meaning.trim(), actor: c.actor } : {}),
  });
  delete question.sourceId;
  if (question !== parent) questions.push(question);
  Object.assign(source, { read: true, withheld: true });
  return { accepted: [], refused: [], conflict: true, questionId: question.id };
}

// A conflict question not yet answered, or whose answer is not yet read.
export function heldSourceConflict(ws) {
  const unresolved = ws.application.questions.some((q) => q.kind === 'source-conflict'
    && (q.status === 'open' || (q.status === 'answered' && !findSource(ws, q.sourceId)?.read)));
  return unresolved ? PENDING : null;
}

// That, or an earlier fact still waiting for the applicant's decision.
export function pendingSourceConflict(ws) {
  return heldSourceConflict(ws) ?? unsettledConflicts(ws)[0] ?? null;
}

export const citedInDrafts = (ws, factId) => DOC_IDS.some((id) => ws.application.documents?.[id]?.segments.some((s) => s.factIds.includes(factId)));

// After the applicant answers a conflict, each earlier confirmed fact it was about
// is theirs to correct, keep or remove; nothing replaces it silently (seen in set 4:
// the old broader fact stayed confirmed beside the narrower answer). The earlier
// quote can span several facts when the notes were split, so each one is asked about.
export function conflictedFacts(ws, question) {
  if (question?.kind !== 'source-conflict' || question.status !== 'answered' || question.settled) return [];
  if (!findSource(ws, question.sourceId)?.read) return [];
  const prior = normalise(question.priorQuote);
  return ws.applicant.facts.filter((f) => f.status === 'confirmed' && f.sourceId === question.priorSourceId
    && !question.kept?.includes(f.id) && prior && (normalise(f.quote).includes(prior) || prior.includes(normalise(f.quote))));
}

export function unsettledConflicts(ws) {
  return ws.application.questions.flatMap((q) => conflictedFacts(ws, q))
    .map((f) => `Check the earlier fact your answer was about: “${f.quote}”${/[.!?]$/.test(f.quote) ? '' : '.'} ${citedInDrafts(ws, f.id) ? 'Keep it or correct it.' : 'Keep it, correct it or remove it.'}`);
}
