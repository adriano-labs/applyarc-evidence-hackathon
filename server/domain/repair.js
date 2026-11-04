// Cross-document repair. When a fact changes, only the sentences citing it are
// reopened. Drafted sentences get a proposed rewrite; a sentence the applicant
// edited is a conflict that needs their decision; a sentence with no usable
// rewrite asks for review. Nothing applies until the applicant says so.
import { checkContext, citedFacts, claimProblem } from './claims.js';
import { refuse } from './errors.js';
import { normalise } from './text.js';
import { confirmedFacts, DOC_IDS, findFact } from './workspace.js';
import { reviewKey } from '../agent/evidenceReview.js';

import { retentionProblems } from './retention.js';

function openRepair(ws, status) {
  const repair = ws.application.repair;
  if (!repair) refuse('invalid', 'There are no changes to review.');
  if (status && repair.status !== status) refuse('invalid', 'The changes are not ready for that step.');
  return repair;
}

export function startRepair(ws, factId, now = new Date().toISOString()) {
  if (ws.application.repair) refuse('repair-open', 'Finish reviewing the current changes first.');
  const items = [];
  for (const docId of DOC_IDS) {
    for (const s of ws.application.documents[docId]?.segments ?? []) {
      if (!s.factIds.includes(factId)) continue;
      const conflict = s.author === 'user';
      items.push({
        id: `c${items.length + 1}`,
        docId,
        segmentId: s.id,
        before: s.text,
        after: null,
        afterFactIds: null,
        status: conflict ? 'conflict' : 'pending',
        decision: null,
      });
    }
  }
  if (!items.length) return null;
  // Approval covers the evidence as well as wording. Even keeping the old
  // sentence after this correction requires a fresh decision to approve.
  for (const docId of new Set(items.map((i) => i.docId))) ws.application.approvals[docId] = null;
  ws.application.repair = { factId, startedAt: now, status: 'awaiting-proposal', items };
  return ws.application.repair;
}

function usableRewrite(ws, rewrite, confirmedMap, review) {
  const text = normalise(rewrite?.text);
  const factIds = [...new Set(rewrite?.factIds ?? [])];
  if (!text || !factIds.length || factIds.some((id) => !confirmedMap.has(id))) return null;
  if (review) {
    const key = reviewKey(ws, rewrite);
    if (!review.has(key) || review.get(key) !== null) return null;
  } else if (claimProblem(text, citedFacts(ws, factIds, confirmedMap), checkContext(ws))) return null;
  return { text, factIds };
}

// An accepted sentence is not proof that the complete corrected contribution remains.
export const rewriteProblems = retentionProblems;

// An unchanged rewrite is a sentence the corrected fact still supports: it keeps its citations.
const STILL_TRUE = 'Still true after the correction: the wording stays and keeps citing the corrected fact.';
const NO_REWRITE = 'No rewrite came back that the corrected fact supports, so this sentence may now be untrue. Check it against the corrected fact.';

// The model may rewrite only the reopened sentences; anything else is refused.
export function proposeRewrites(ws, rewrites, review) {
  const repair = openRepair(ws, 'awaiting-proposal');
  const confirmedMap = new Map(confirmedFacts(ws).map((f) => [f.id, f]));
  const bySegment = new Map(rewrites.map((r) => [r?.segmentId, r]));
  const refused = rewrites
    .filter((r) => !repair.items.some((i) => i.segmentId === r?.segmentId))
    .map((r) => ({ segmentId: r?.segmentId ?? null, reason: 'That sentence does not cite the changed fact.' }));
  const problems = rewriteProblems(ws, rewrites, review);
  for (const item of repair.items) {
    const rewrite = bySegment.get(item.segmentId);
    const usable = problems.has(item.segmentId) ? null : usableRewrite(ws, rewrite, confirmedMap, review);
    if (!usable) Object.assign(item, { after: null, afterFactIds: null, reason: problems.get(item.segmentId) ?? (rewrite && review
      ? review.get(reviewKey(ws, rewrite)) || 'The review could not establish support for this rewrite.'
      : NO_REWRITE) });
    else Object.assign(item, { after: usable.text, afterFactIds: usable.factIds, ...(usable.text === item.before ? { reason: STILL_TRUE } : {}) });
    if (item.status === 'pending') item.status = item.after ? 'proposed' : 'needs-review';
  }
  repair.status = 'review';
  return { repair, refused };
}

// take: use the proposed rewrite. keep: leave the sentence as it is.
// write: the applicant's own wording, which then counts as their edit.
export function decideItem(ws, itemId, decision, text) {
  const repair = openRepair(ws, 'review');
  const item = repair.items.find((i) => i.id === itemId);
  if (!item) refuse('invalid', 'That change does not exist.');
  if (decision === 'take' && !item.after) refuse('invalid', 'There is no proposed rewrite to take.');
  if (decision === 'write' && !normalise(text)) refuse('invalid', 'Write the sentence you want.');
  if (!['take', 'keep', 'write'].includes(decision)) refuse('invalid', 'Choose take, keep or write.');
  item.decision = decision;
  item.written = decision === 'write' ? normalise(text) : undefined;
  return item;
}

export function undecided(repair) {
  return repair.items.filter((i) => i.status !== 'proposed' && !i.decision);
}

function applyItem(ws, item, factId) {
  const decision = item.decision ?? 'take';
  const segment = ws.application.documents[item.docId].segments.find((s) => s.id === item.segmentId);
  if (decision === 'keep') {
    // Her own words stay exactly, but no longer cite the corrected fact, which no longer supports them.
    Object.assign(segment, { author: 'user', factIds: segment.factIds.filter((id) => id !== factId) });
    return false;
  }
  if (decision === 'write') Object.assign(segment, { text: item.written, author: 'user' });
  else Object.assign(segment, { text: item.after, factIds: item.afterFactIds, author: item.after === item.before ? segment.author : 'repair' });
  return true;
}

export function applyRepair(ws, now = new Date().toISOString()) {
  const repair = openRepair(ws, 'review');
  const waiting = undecided(repair);
  if (waiting.length) refuse('undecided', 'Decide every change marked “needs you” first.', { items: waiting.map((i) => i.id) });
  const changedDocs = new Set();
  const changedSegments = [];
  let kept = 0;
  for (const item of repair.items) {
    if (applyItem(ws, item, repair.factId)) {
      changedDocs.add(item.docId);
      // A still-true sentence gets its citations renewed, not rewritten.
      if (item.decision === 'write' || item.after !== item.before) changedSegments.push({ docId: item.docId, segmentId: item.segmentId });
    } else {
      kept += 1;
    }
  }
  for (const docId of changedDocs) ws.application.documents[docId].revision += 1;
  // What the correction reopened and what it left alone, so the finish can say so from saved state.
  const sentences = Object.values(ws.application.documents).reduce((n, doc) => n + (doc?.segments?.length ?? 0), 0);
  const summary = { factId: repair.factId, at: now, changed: changedSegments.length, kept, docs: [...changedDocs], changedSegments, reopened: repair.items.length, untouched: sentences - repair.items.length };
  ws.application.repair = null;
  ws.application.lastRepair = summary;
  return summary;
}

// Undo a correction before anything is applied: the fact gets its previous
// wording back, the correction text goes, and the documents never changed.
export function cancelRepair(ws) {
  const repair = ws.application.repair;
  if (!repair) refuse('invalid', 'There is no correction to undo.');
  const fact = findFact(ws, repair.factId);
  const previous = fact.history.pop();
  // The shortcut settled this question with the correction source. Undoing
  // that source must make its held note actionable again, not orphan the answer.
  for (const question of ws.application.questions) {
    if (question.kind !== 'source-conflict' || question.status !== 'answered'
      || question.resolution !== 'corrected' || question.sourceId !== fact.sourceId) continue;
    question.status = 'open';
    delete question.sourceId;
    delete question.settled;
    delete question.resolution;
  }
  ws.applicant.sources = ws.applicant.sources.filter((s) => !(s.id === fact.sourceId && s.kind === 'correction'));
  Object.assign(fact, { statement: previous.statement, quote: previous.quote, sourceId: previous.sourceId, ...(previous.actor ? { actor: previous.actor } : {}) });
  ws.application.repair = null;
  return fact;
}
