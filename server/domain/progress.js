// The applicant's next step, derived from the workspace alone.
import { approvalState } from './review.js';
import { askableRequirements } from './questions.js';
import { unsettledConflicts } from './sourceConflicts.js';
import { DOC_IDS } from './workspace.js';

export function nextStep(ws) {
  const { sources, facts } = ws.applicant;
  const app = ws.application;
  if (app.repair) return app.repair.status === 'awaiting-proposal' ? 'repair-proposal' : 'repair';
  if (!sources.some((s) => s.kind === 'notes')) return 'notes';
  if (sources.some((s) => s.kind !== 'correction' && !s.read)) return 'read';
  if (facts.some((f) => f.status === 'proposed')) return 'facts';
  if (app.questions.some((q) => q.status === 'open')) return 'question';
  if (unsettledConflicts(ws).length) return 'decide';
  if (askableRequirements(ws).length) return 'check';
  if (DOC_IDS.some((id) => !app.documents[id])) return 'draft';
  if (DOC_IDS.some((id) => approvalState(ws, id) !== 'approved')) return 'approve';
  return 'export';
}
