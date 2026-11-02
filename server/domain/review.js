// Approval is for an exact revision. Any later change makes it stale.
import { documentStats } from './documents.js';
import { refuse } from './errors.js';
import { formDocument, sourceReadinessBlock } from './workspace.js';
import { pendingSourceConflict } from './sourceConflicts.js';

export function approvalState(ws, docId) {
  const approval = ws.application.approvals[docId];
  const doc = ws.application.documents[docId];
  if (!approval) return 'none';
  return doc && approval.revision === doc.revision ? 'approved' : 'stale';
}

export function approve(ws, docId, revision, now = new Date().toISOString()) {
  const conflict = pendingSourceConflict(ws);
  if (conflict) refuse('source-conflict', conflict);
  const readiness = sourceReadinessBlock(ws);
  if (readiness) refuse('not-ready', readiness);
  const doc = ws.application.documents[docId];
  const { title } = formDocument(ws, docId) ?? {};
  if (!doc) refuse('invalid', 'There is nothing to approve yet.');
  if (ws.application.repair) refuse('repair-open', 'Finish reviewing the changes first.');
  if (revision !== doc.revision) {
    refuse('stale', `The ${title.toLowerCase()} changed since you read it. Review version ${doc.revision}.`);
  }
  const { words, wordLimit, overLimit } = documentStats(ws, docId);
  if (overLimit) refuse('over-limit', `The ${title.toLowerCase()} is ${words} words; the limit is ${wordLimit}.`);
  ws.application.approvals[docId] = { revision, at: now };
  return ws.application.approvals[docId];
}
