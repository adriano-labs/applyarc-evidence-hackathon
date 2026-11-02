// A requirement this document answers is unanswered when confirmed facts cover it
// but no claim in the document cites one of them. A requirement no fact covers is a
// gap the applicant was asked about, never an omission.
import { coverage } from './facts.js';
import { letterContributionGap } from './letterQuality.js';

export function unansweredRequirements(ws, docId, segments = ws.application.documents[docId]?.segments ?? []) {
  const cited = new Set(segments.filter((s) => s?.kind === 'claim').flatMap((s) => s.factIds ?? []));
  const requirements = coverage(ws);
  const unanswered = requirements.filter((r) => r.docId === docId && r.covered && !r.factIds.some((id) => cited.has(id)));
  return docId === 'letter' ? [...unanswered, ...letterContributionGap(ws, segments, requirements)] : unanswered;
}
