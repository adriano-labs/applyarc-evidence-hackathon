// A held note can become a correction only through the applicant's explicit choice.
import { shared, stems } from './claims.js';
import { changeFact } from './facts.js';
import { refuse } from './errors.js';
import { startRepair } from './repair.js';
import { citedInDrafts } from './sourceConflicts.js';
import { normalise } from './text.js';
import { findSource } from './workspace.js';

// The earlier quote can span several facts when the notes were split: offer the one the
// drafts cite that shares the most words with the note, and none on a tie. A fact the note
// repeats word for word is what it keeps, not what it overturns, so it is never offered.
function matchingFact(ws, matches, note) {
  const changed = matches.filter((fact) => !normalise(note).includes(normalise(fact.quote)));
  if (matches.length < 2) return changed[0] ?? null;
  const cited = changed.filter((fact) => citedInDrafts(ws, fact.id));
  const [best, next] = (cited.length ? cited : changed)
    .map((fact) => ({ fact, score: shared(stems(fact.quote), note) }))
    .sort((a, b) => b.score - a.score);
  return best?.score > (next?.score ?? 0) ? best.fact : null;
}

export function sourceCorrections(ws) {
  if (ws.application.repair) return [];
  const pending = ws.application.questions.filter((q) => q.status === 'open'
    || (q.kind === 'source-conflict' && q.status === 'answered' && !findSource(ws, q.sourceId)?.read));
  if (pending.length !== 1) return [];
  const question = pending[0];
  const source = findSource(ws, question.conflictSourceId);
  if (question.kind !== 'source-conflict' || question.status !== 'open' || question.settled
    || source?.read !== true || source.withheld !== true || !['notes', 'answer'].includes(source.kind)) return [];
  const prior = normalise(question.priorQuote ?? '');
  const fact = matchingFact(ws, ws.applicant.facts.filter((f) => f.status === 'confirmed'
    && f.sourceId === question.priorSourceId && prior
    && (normalise(f.quote).includes(prior) || prior.includes(normalise(f.quote)))), source.text);
  if (!fact) return [];
  // In another language the offer carries the new words' English meaning and actor, for the applicant to check.
  const gloss = question.meaning ? { meaning: question.meaning, actor: question.actor } : {};
  return [{ questionId: question.id, sourceId: source.id, factId: fact.id, before: fact.quote, text: source.text, ...gloss }];
}

export function resolveSourceConflict(ws, { questionId, sourceId, factId, text, meaning, actor } = {}) {
  const offer = sourceCorrections(ws).find((item) => item.questionId === questionId
    && item.sourceId === sourceId && item.factId === factId);
  if (!offer) refuse('stale-conflict', 'This correction is no longer ready. Check the current question first.');
  const fact = changeFact(ws, factId, text, undefined, { meaning: meaning ?? offer.meaning, actor: actor ?? offer.actor });
  const question = ws.application.questions.find((q) => q.id === questionId);
  Object.assign(question, { status: 'answered', settled: true, sourceId: fact.sourceId, resolution: 'corrected' });
  findSource(ws, fact.sourceId).read = true;
  return { fact, repair: startRepair(ws, factId) };
}
