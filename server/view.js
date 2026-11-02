// What the client renders: the workspace plus everything derived from it.
import { citationNumbers } from './domain/citations.js';
import { documentStats, draftBlockers } from './domain/documents.js';
import { exportBlockers } from './domain/exportPack.js';
import { coverage } from './domain/facts.js';
import { nextStep } from './domain/progress.js';
import { approvalState } from './domain/review.js';
import { DOC_IDS } from './domain/workspace.js';
import { citedInDrafts, conflictedFacts } from './domain/sourceConflicts.js';
import { sourceCorrections } from './domain/sourceConflictCorrection.js';

export function viewOf(ws) {
  const per = (fn) => Object.fromEntries(DOC_IDS.map((id) => [id, fn(id)]));
  const conflictDecisions = (ws.application?.questions ?? []).flatMap((q) => conflictedFacts(ws, q)
    .map((f) => ({ questionId: q.id, factId: f.id, quote: f.quote, cited: citedInDrafts(ws, f.id) })));
  return {
    next: nextStep(ws),
    coverage: coverage(ws),
    draftBlockers: draftBlockers(ws),
    exportBlockers: exportBlockers(ws),
    stats: per((id) => documentStats(ws, id)),
    approvals: per((id) => approvalState(ws, id)),
    citations: citationNumbers(ws),
    conflictDecisions,
    sourceCorrections: sourceCorrections(ws),
  };
}
