// A held note can become a correction only through the applicant's explicit choice.
import { changeFact } from './facts.js';
import { refuse } from './errors.js';
import { startRepair } from './repair.js';
import { normalise } from './text.js';
import { findSource } from './workspace.js';

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
  const matches = ws.applicant.facts.filter((fact) => fact.status === 'confirmed'
    && fact.sourceId === question.priorSourceId && prior
    && (normalise(fact.quote).includes(prior) || prior.includes(normalise(fact.quote))));
  if (matches.length !== 1) return [];
  const fact = matches[0];
  return [{ questionId: question.id, sourceId: source.id, factId: fact.id, before: fact.quote, text: source.text }];
}

export function resolveSourceConflict(ws, { questionId, sourceId, factId, text } = {}) {
  const offer = sourceCorrections(ws).find((item) => item.questionId === questionId
    && item.sourceId === sourceId && item.factId === factId);
  if (!offer) refuse('stale-conflict', 'This correction is no longer ready. Check the current question first.');
  const fact = changeFact(ws, factId, text);
  const question = ws.application.questions.find((q) => q.id === questionId);
  Object.assign(question, { status: 'answered', settled: true, sourceId: fact.sourceId, resolution: 'corrected' });
  findSource(ws, fact.sourceId).read = true;
  return { fact, repair: startRepair(ws, factId) };
}
