// Review authority for one exact projected document and its current evidence.
// This binds a fallible semantic verdict; it does not infer meaning from stems.
import { reviewKey } from '../agent/evidenceReview.js';
import { languageName } from './languages.js';
import { DOC_IDS, findFact } from './workspace.js';

export function retentionChecks(ws, rewrites) {
  const repair = ws.application.repair;
  if (!repair) return [];
  const fact = findFact(ws, repair.factId);
  const bySegment = new Map(rewrites.map((r) => [r.segmentId, r]));
  return DOC_IDS.filter((docId) => repair.items.some((i) => i.docId === docId && bySegment.has(i.segmentId))).map((docId) => {
    const allowed = new Set(repair.items.filter((i) => i.docId === docId).map((i) => i.segmentId));
    const document = ws.application.documents[docId].segments.map((s) => {
      const value = allowed.has(s.id) && bySegment.has(s.id) ? bySegment.get(s.id) : s;
      return { segmentId: s.id, text: value.text, factIds: [...(value.factIds ?? [])] };
    });
    const correctedFact = { id: fact.id, quote: fact.quote, ...(fact.language ? { language: languageName(fact.language) } : {}) };
    const changedSegmentIds = [...allowed].filter((id) => bySegment.has(id));
    const factIds = [...new Set([fact.id, ...document.flatMap((s) => s.factIds)])];
    const key = JSON.stringify(['retention', docId, correctedFact, document, changedSegmentIds, reviewKey(ws, { text: '', factIds })]);
    return { key, kind: 'retention', docId, correctedFact, document, changedSegmentIds };
  });
}

export function retentionProblems(ws, rewrites, review) {
  const problems = new Map();
  if (!review) return problems; // The explicit local fixture route has no model verdict.
  for (const check of retentionChecks(ws, rewrites)) {
    const decision = review.get(check.key);
    if (decision?.verdict === 'supported') continue;
    const reason = decision?.reason || 'This document needs a new retention review against the corrected fact.';
    for (const item of ws.application.repair.items.filter((i) => i.docId === check.docId)) problems.set(item.segmentId, reason);
  }
  return problems;
}
