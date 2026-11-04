import { saysSelf } from './attribution.js';
import { isOwnWork } from './facts.js';
import { findFact } from './workspace.js';

// This is ApplyArc's writing advice, not an extra employer requirement. Only
// confirmed own-work facts linked to an existing personal requirement qualify.
// The letter itself is English, so its sentences are read in English.
export function letterContributionGap(ws, segments, requirements) {
  const linked = requirements.filter((r) => r.personal).flatMap((r) => r.factIds);
  const factIds = [...new Set(linked)].filter((id) => {
    const fact = findFact(ws, id);
    return fact?.status === 'confirmed' && isOwnWork(ws, fact);
  });
  const present = segments.some((s) => s?.kind === 'claim'
    && (s.factIds ?? []).some((id) => factIds.includes(id))
    && saysSelf(s.text, s.text));
  if (!factIds.length || present) return [];
  return [{
    id: 'letter-personal-contribution', docId: 'letter', factIds,
    text: 'ApplyArc quality check: include one confirmed example of your own contribution.',
  }];
}
