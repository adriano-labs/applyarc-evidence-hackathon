// Give rejected repair wording one targeted chance to become useful. The
// domain still owns admission and the applicant still owns applying changes.
import { findSegment } from '../domain/documents.js';
import { refuse } from '../domain/errors.js';
import { proposeRewrites, rewriteProblems } from '../domain/repair.js';
import { confirmedFacts, DOC_IDS, findFact } from '../domain/workspace.js';
import { reviewClaims, reviewKey } from './evidenceReview.js';
import { retentionChecks } from '../domain/retention.js';

const factView = ({ id, statement, quote }) => ({ id, statement, quote });

function candidatesFor(rewrites, items) {
  const allowed = new Set(items.map((item) => item.segmentId));
  const seen = new Set();
  const candidates = new Map();
  const refused = [];
  for (const rewrite of Array.isArray(rewrites) ? rewrites : []) {
    const id = rewrite?.segmentId;
    if (!allowed.has(id)) {
      refused.push({ segmentId: id ?? null, reason: 'That sentence is not part of this repair.' });
      continue;
    }
    // Count malformed occurrences too; a later value must not win by default.
    if (seen.has(id)) {
      candidates.delete(id);
      refused.push({ segmentId: id, reason: 'The model returned more than one rewrite for this sentence.' });
      continue;
    }
    seen.add(id);
    if (typeof rewrite.text !== 'string' || !rewrite.text.trim() || !Array.isArray(rewrite.factIds)
      || !rewrite.factIds.every((factId) => typeof factId === 'string')) {
      refused.push({ segmentId: id, reason: 'The rewrite did not contain usable wording and fact references.' });
      continue;
    }
    candidates.set(id, { segmentId: id, text: rewrite.text, factIds: rewrite.factIds });
  }
  return { candidates, refused };
}

async function reviewRepairs(ws, candidates, agent, emit, previous = new Map(), fallback = new Map()) {
  const values = [...candidates.values(), ...fallback.values()];
  const pending = values.filter((p) => !previous.has(reviewKey(ws, p)));
  const checks = () => [...new Map([candidates, fallback].flatMap((set) => retentionChecks(ws, [...set.values()]))
    .map((c) => [c.key, c])).values()];
  const retentions = checks().filter((c) => !previous.has(c.key));
  const snapshot = JSON.stringify(checks().map((c) => c.key));
  const next = await reviewClaims(ws, pending, agent, emit, retentions);
  if (snapshot !== JSON.stringify(checks().map((c) => c.key))) refuse('stale-review', 'The document or evidence changed during review.');
  return next ? new Map([...previous, ...next]) : undefined;
}

function quoteFallback(ws, candidates, docIds) {
  const fallback = new Map(candidates);
  const fact = findFact(ws, ws.application.repair.factId);
  for (const docId of docIds) {
    const item = ws.application.repair.items.find((i) => i.docId === docId && candidates.has(i.segmentId));
    if (item) fallback.set(item.segmentId, { segmentId: item.segmentId, text: fact.quote, factIds: [fact.id] });
  }
  return fallback;
}

async function reviseRejected(ws, candidates, facts, agent, emit, review) {
  if (!review || typeof agent.revise !== 'function') return { candidates, review, refused: [] };
  if (retentionChecks(ws, [...candidates.values()]).some((c) => review.get(c.key)?.verdict === 'unverified')) return { candidates, review, refused: [] };
  const problems = rewriteProblems(ws, [...candidates.values()], review);
  const reasonFor = (p) => problems.get(p.segmentId) ?? review.get(reviewKey(ws, p));
  const items = [...candidates.values()].filter((p) => reasonFor(p) !== null).map((p) => ({
    ...p, reason: reasonFor(p) || 'The evidence review could not establish support.',
  }));
  if (!items.length) return { candidates, review, refused: [] };
  const checks = retentionChecks(ws, [...candidates.values()]);
  const fallbackDocs = checks.filter((c) => ['uncertain', 'contradicted'].includes(review.get(c.key)?.verdict)).map((c) => c.docId);
  const documents = checks.map((c) => ({ docId: c.docId, sentences: c.document }));
  emit({ type: 'stage', label: `Revising ${items.length} unsupported repair sentence${items.length === 1 ? '' : 's'}` });
  let response;
  try {
    response = await agent.revise({ items, facts, documents, emit });
  } catch (error) {
    if (error?.code !== 'invalid-output') throw error;
    emit({ type: 'stage', label: 'The rewording step sent an answer that could not be read; going on without it' });
    response = { rewrites: [] };
  }
  const replacements = candidatesFor(response?.rewrites, items);
  const next = new Map(candidates);
  for (const p of replacements.candidates.values()) next.set(p.segmentId, p);
  const fallback = quoteFallback(ws, next, fallbackDocs);
  // Review both exact projections together. Verbatim support cannot prove coherence.
  return { candidates: next, fallback, review: await reviewRepairs(ws, next, agent, emit, review, fallback), refused: replacements.refused };
}

// The fallback needs the real verdict for its own projected document. It never
// gets authority merely because the applicant's quote appears word for word.
function withOwnWords(ws, candidates, review, fallback) {
  if (!review || !fallback) return { candidates, review };
  const next = new Map(candidates);
  const alternatives = retentionChecks(ws, [...fallback.values()]);
  for (const check of retentionChecks(ws, [...candidates.values()])) {
    const alternative = alternatives.find((c) => c.docId === check.docId);
    if (review.get(check.key)?.verdict === 'supported' || review.get(alternative?.key)?.verdict !== 'supported') continue;
    for (const item of ws.application.repair.items.filter((i) => i.docId === check.docId)) {
      const value = fallback.get(item.segmentId);
      if (value && value !== candidates.get(item.segmentId) && review.get(reviewKey(ws, value)) === null) next.set(item.segmentId, value);
    }
  }
  return { candidates: next, review };
}

export async function repairDocuments(ws, agent, emit = () => {}) {
  const open = ws.application.repair;
  if (!open || open.status !== 'awaiting-proposal') refuse('invalid', 'There are no changes waiting for a rewrite.');
  const fact = findFact(ws, open.factId);
  const facts = confirmedFacts(ws).map(factView);
  const items = open.items.map((item) => ({ ...item, factIds: findSegment(ws, item.docId, item.segmentId).segment.factIds }));
  // Every sentence of each affected document, so the rewrite never repeats one.
  const documents = DOC_IDS.filter((docId) => items.some((i) => i.docId === docId)).map((docId) => ({
    docId, sentences: ws.application.documents[docId].segments.map((s) => ({ segmentId: s.id, text: s.text })),
  }));
  emit({ type: 'stage', label: 'Rewriting the sentences that cite the change' });
  const response = await agent.repair({
    form: ws.application.form, fact: { ...factView(fact), history: fact.history }, items, facts, documents, emit,
  });
  const first = candidatesFor(response?.rewrites, items);
  const review = await reviewRepairs(ws, first.candidates, agent, emit);
  const revised = await reviseRejected(ws, first.candidates, facts, agent, emit, review);
  const final = withOwnWords(ws, revised.candidates, revised.review, revised.fallback);
  const result = proposeRewrites(ws, [...final.candidates.values()], final.review);
  result.refused.push(...first.refused, ...revised.refused);
  return result;
}
