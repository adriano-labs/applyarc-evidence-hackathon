// The export pack: exactly the approved revisions, labelled NOT SUBMITTED,
// with the portal tasks the applicant still has to do themselves.
import { citationNumbers, referencesFor } from './citations.js';
import { documentStats, documentText } from './documents.js';
import { refuse } from './errors.js';
import { approvalState } from './review.js';
import { DOC_IDS, formDocument, sourceReadinessBlock } from './workspace.js';
import { pendingSourceConflict } from './sourceConflicts.js';

export const NOT_SUBMITTED = 'NOT SUBMITTED';

export function exportBlockers(ws) {
  const conflict = pendingSourceConflict(ws);
  if (conflict) return [conflict];
  const readiness = sourceReadinessBlock(ws);
  if (readiness) return [readiness];
  if (ws.application.repair) return ['Finish reviewing the changes first.'];
  return DOC_IDS.filter((id) => approvalState(ws, id) !== 'approved').map(
    (id) => `Approve the current ${formDocument(ws, id).title.toLowerCase()}.`,
  );
}

export function buildExport(ws, now = new Date().toISOString()) {
  const blockers = exportBlockers(ws);
  if (blockers.length) refuse('not-approved', blockers[0], { blockers });
  const { form } = ws.application;
  const numbers = citationNumbers(ws);
  const documents = DOC_IDS.map((id) => {
    const doc = ws.application.documents[id];
    const { title, fieldId, required } = formDocument(ws, id);
    const { words, wordLimit, unanswered, leftOut, ownWords } = documentStats(ws, id);
    return {
      id, title, fieldId, ...(required === false ? { required: false } : {}), revision: doc.revision, approvedAt: ws.application.approvals[id].at,
      words, wordLimit, text: documentText(doc), references: referencesFor(ws, doc, numbers),
      sentences: (doc.segments ?? []).map((s) => ({ text: s.text, refs: (s.factIds ?? []).map((id) => numbers[id]), startsParagraph: Boolean(s.startsParagraph), ...(s.author === 'user' ? { own: true } : {}) })),
      ownWords, notAnswered: [...unanswered, ...leftOut].map((r) => r.text),
    };
  });
  const record = { id: `e${ws.application.exports.length + 1}`, at: now, revisions: Object.fromEntries(documents.map((d) => [d.id, d.revision])) };
  ws.application.exports.push(record);
  return {
    status: NOT_SUBMITTED,
    notice: form.portalStatus === 'unknown'
      ? 'Prepared with ApplyArc Evidence. Nothing has been submitted. The complete employer form has not been checked. The cover letter is optional; check every required field and upload before submitting yourself.'
      : 'Prepared with ApplyArc Evidence. Nothing has been submitted. Paste each document into the employer’s form yourself and finish the steps below on the employer’s site.',
    exportId: record.id,
    createdAt: now,
    application: { company: form.company, role: form.role, url: form.url, snapshotFetchedAt: form.snapshot?.fetchedAt ?? null,
      ...(form.snapshot?.source === 'applicant-pasted' ? { source: 'applicant-pasted', portalStatus: 'unknown' } : {}) },
    documents,
    portalTasks: form.portalTasks,
    applicant: ws.applicant.name,
  };
}
