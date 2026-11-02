// Facts: short statements the applicant confirms, each tied to an exact quote
// from something they wrote (their notes, an answer, or a correction).
import { refuse } from './errors.js';
import { saysSelf } from './attribution.js';
import { isVerbatim, normalise, numbers } from './text.js';
import { addSource, findFact, findSource, nextId, requirements } from './workspace.js';

const MAX_STATEMENT = 280;

function problemWith(ws, source, proposal) {
  const statement = proposal?.statement?.trim();
  if (!statement) return 'The statement is empty.';
  if (statement.length > MAX_STATEMENT) return 'The statement is too long.';
  if (!isVerbatim(proposal.quote, source.text)) return 'The quote is not in the applicant’s own words.';
  const quoted = new Set(numbers(proposal.quote));
  if (numbers(statement).some((n) => !quoted.has(n))) return 'The statement has a number the quote does not.';
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
    ws.applicant.facts.push(fact);
    link(ws, fact.id, (proposal.requirementIds ?? []).filter((id) => known.has(id)));
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

// The applicant corrects a confirmed fact in their own words. The correction
// becomes the fact's new source; the old wording stays in its history.
export function changeFact(ws, factId, text, now = new Date().toISOString()) {
  const fact = findFact(ws, factId);
  if (!fact || fact.status !== 'confirmed') refuse('invalid', 'Only a confirmed fact can be changed.');
  const wording = String(text ?? '').trim();
  if (!wording) refuse('invalid', 'Write the corrected fact in your own words.');
  if (wording.length > MAX_STATEMENT) refuse('invalid', 'Keep the fact under 280 characters.');
  if (normalise(wording) === fact.quote) refuse('invalid', 'That is the same as the current fact.');
  const source = addSource(ws, { kind: 'correction', text: wording, now });
  fact.history.push({ statement: fact.statement, quote: fact.quote, sourceId: fact.sourceId, at: now });
  Object.assign(fact, { statement: wording, quote: normalise(wording), sourceId: source.id });
  return fact;
}

// For each requirement: the confirmed facts linked to it, and whether they
// cover it. A personal requirement ("your individual contribution") is covered
// only by a fact where the applicant says "I" did it, so neither "we fixed it"
// nor "my team fixed it" counts as "I fixed it".
export function coverage(ws) {
  const sources = new Map(ws.applicant.sources.map((s) => [s.id, s.text]));
  return requirements(ws).map((r) => {
    const facts = (ws.application.coverage[r.id] ?? [])
      .map((id) => findFact(ws, id))
      .filter((f) => f?.status === 'confirmed');
    const covered = facts.length > 0 && (!r.personal || facts.some((f) => saysSelf(f.quote, sources.get(f.sourceId) ?? f.quote)));
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
