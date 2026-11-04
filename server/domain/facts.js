// Facts: short statements the applicant confirms, each tied to an exact quote
// from something they wrote (their notes, an answer, or a correction).
import { refuse } from './errors.js';
import { saysSelf } from './attribution.js';
import { ACTORS, isEnglish, languageOf } from './languages.js';
import { isVerbatim, normalise, numbers } from './text.js';
import { addSource, findFact, findSource, nextId, requirements } from './workspace.js';

const MAX_STATEMENT = 280;

// The number rule. An English statement may state only the numbers its quote states,
// in digits or in words. A quote in another language is read for digits only: each
// number it writes in digits must stay in the English meaning; numbers it says in
// words are checked by the applicant, who confirms the meaning beside the quote.
function numberProblem(statement, quote, language) {
  const quoted = numbers(quote, language);
  if (language === 'en') return numbers(statement).some((n) => !quoted.includes(n)) ? 'The statement has a number the quote does not.' : null;
  const meant = numbers(statement);
  return quoted.some((n) => !meant.includes(n)) ? 'The English meaning drops a number the quote writes in digits.' : null;
}

function problemWith(ws, source, proposal) {
  const statement = proposal?.statement?.trim();
  if (!statement) return 'The statement is empty.';
  if (statement.length > MAX_STATEMENT) return 'The statement is too long.';
  if (!isVerbatim(proposal.quote, source.text)) return 'The quote is not in the applicant’s own words.';
  const numberRule = numberProblem(statement, proposal.quote, languageOf(source));
  if (numberRule) return numberRule;
  if (!isEnglish(source) && !ACTORS.includes(proposal.actor)) return 'Say who did it: the applicant, the team or someone else.';
  const quote = normalise(proposal.quote);
  if (ws.applicant.facts.some((f) => f.status !== 'rejected' && f.quote === quote)) return 'Duplicate of an existing fact.';
  return null;
}

function link(ws, factId, requirementIds) {
  for (const id of requirementIds) {
    const list = (ws.application.coverage[id] ??= []);
    if (!list.includes(factId)) list.push(factId);
  }
}

// A point the form wants stated directly (a values or understanding statement, marked
// "direct") is covered only by the applicant's answer to its own question, never by an
// example the model links from other words: the app asks her.
function linkable(ws, source, requirementId) {
  const requirement = requirements(ws).find((r) => r.id === requirementId);
  if (!requirement?.direct) return true;
  return ws.application.questions.some((q) => q.id === source?.questionId && q.requirementId === requirementId);
}

// Proposals come from the model; only those quoting the source verbatim enter
// the workspace, and they enter as "proposed" until the applicant decides.
export function proposeFacts(ws, sourceId, proposals) {
  const source = findSource(ws, sourceId);
  if (!source) refuse('invalid', 'That text is no longer in the workspace.');
  const known = new Set(requirements(ws).map((r) => r.id));
  const accepted = [];
  const refused = [];
  for (const proposal of proposals) {
    const reason = problemWith(ws, source, proposal);
    if (reason) {
      refused.push({ quote: String(proposal?.quote ?? ''), reason });
      continue;
    }
    const fact = {
      id: nextId('f', ws.applicant.facts),
      statement: proposal.statement.trim(),
      quote: normalise(proposal.quote),
      sourceId,
      status: 'proposed',
      history: [],
    };
    // In another language the statement is the English meaning, and the actor says who did it.
    if (!isEnglish(source)) Object.assign(fact, { language: source.language, actor: proposal.actor });
    ws.applicant.facts.push(fact);
    link(ws, fact.id, (proposal.requirementIds ?? []).filter((id) => known.has(id) && linkable(ws, source, id)));
    accepted.push(fact.id);
  }
  return { accepted, refused };
}

export function decideFact(ws, factId, decision) {
  const fact = findFact(ws, factId);
  if (!fact) refuse('invalid', 'That fact does not exist.');
  if (fact.status !== 'proposed') refuse('invalid', 'This fact has already been decided.');
  if (!['confirm', 'reject'].includes(decision)) refuse('invalid', 'Choose confirm or reject.');
  fact.status = decision === 'confirm' ? 'confirmed' : 'rejected';
  return fact;
}

// "Confirm the remaining": all or nothing, and only facts still waiting to be checked.
export function confirmFacts(ws, factIds = []) {
  if (factIds.some((id) => findFact(ws, id)?.status !== 'proposed')) refuse('invalid', 'Only facts waiting to be checked can be confirmed together.');
  for (const id of factIds) decideFact(ws, id, 'confirm');
  return { confirmed: factIds };
}

// A correction in another language keeps its English meaning and who did it.
function glossOf(fact, wording, { meaning, actor } = {}) {
  if (isEnglish(fact)) return { statement: wording };
  const statement = String(meaning ?? '').trim();
  if (!statement || statement.length > MAX_STATEMENT) refuse('invalid', 'Give the English meaning of your correction, under 280 characters.');
  if (!ACTORS.includes(actor)) refuse('invalid', 'Say who did it: you, your team or someone else.');
  const numberRule = numberProblem(statement, wording, fact.language);
  if (numberRule) refuse('invalid', numberRule);
  return { statement, actor };
}

// The applicant corrects a confirmed fact in their own words. The correction
// becomes the fact's new source; the old wording stays in its history.
export function changeFact(ws, factId, text, now = new Date().toISOString(), gloss = {}) {
  const fact = findFact(ws, factId);
  if (!fact || fact.status !== 'confirmed') refuse('invalid', 'Only a confirmed fact can be changed.');
  const wording = String(text ?? '').trim();
  if (!wording) refuse('invalid', 'Write the corrected fact in your own words.');
  if (wording.length > MAX_STATEMENT) refuse('invalid', 'Keep the fact under 280 characters.');
  if (normalise(wording) === fact.quote) refuse('invalid', 'That is the same as the current fact.');
  const english = glossOf(fact, wording, gloss);
  const source = addSource(ws, { kind: 'correction', text: wording, language: fact.language, now });
  fact.history.push({ statement: fact.statement, quote: fact.quote, sourceId: fact.sourceId, at: now, ...(fact.actor ? { actor: fact.actor } : {}) });
  Object.assign(fact, { ...english, quote: normalise(wording), sourceId: source.id });
  return fact;
}

// The applicant's own work: in English, a quote where they say "I" did it; in another
// language, a fact whose confirmed actor is the applicant.
export function isOwnWork(ws, fact) {
  if (!isEnglish(fact)) return fact.actor === 'self';
  return saysSelf(fact.quote, findSource(ws, fact.sourceId)?.text ?? fact.quote);
}

// For each requirement: the confirmed facts linked to it, and whether they
// cover it. A personal requirement ("your individual contribution") is covered
// only by the applicant's own work, so neither "we fixed it" nor "my team fixed
// it" counts as "I fixed it".
export function coverage(ws) {
  return requirements(ws).map((r) => {
    const facts = (ws.application.coverage[r.id] ?? [])
      .map((id) => findFact(ws, id))
      .filter((f) => f?.status === 'confirmed');
    const covered = facts.length > 0 && (!r.personal || facts.some((f) => isOwnWork(ws, f)));
    return { ...r, factIds: facts.map((f) => f.id), covered };
  });
}

export function linkFacts(ws, links) {
  const linked = [];
  const refused = [];
  const known = new Set(requirements(ws).map((r) => r.id));
  for (const entry of links ?? []) {
    const requirementId = entry?.requirementId;
    const factIds = entry?.factIds ?? [];
    for (const factId of factIds) {
      if (!known.has(requirementId)) {
        refused.push({ requirementId, factId, reason: 'Unknown requirement.' });
        continue;
      }
      const fact = findFact(ws, factId);
      if (!fact || fact.status !== 'confirmed') {
        refused.push({ requirementId, factId, reason: 'Only a confirmed fact can cover a requirement.' });
        continue;
      }
      if (!linkable(ws, findSource(ws, fact.sourceId), requirementId)) {
        refused.push({ requirementId, factId, reason: 'Only the applicant’s answer to its own question covers this point.' });
        continue;
      }
      const list = ws.application.coverage[requirementId] ?? [];
      if (list.includes(factId)) {
        continue;
      }
      link(ws, factId, [requirementId]);
      linked.push({ requirementId, factId });
    }
  }
  return { linked, refused };
}
