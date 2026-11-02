// Mechanical checks only. Semantic review remains separate and must name whether
// its reviewer was human or another model. These seen cases are not a holdout.
import { prepareOwnApplication } from '../../server/domain/ownForm.js';
const normalized = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
export const PROTOCOL = 'paired-full-workflow-v3';
export const CASE_STATUS = 'SEEN DIAGNOSTIC CASES; NOT HOLDOUT';
export const HELD_OUT_STATUS = 'HELD-OUT CASES: written blind by a separate agent and frozen before any run';
const SEEN = /already been seen|seen diagnostic cases/;
export const PROTOCOL_V4 = 'paired-full-workflow-v4';
// v4 keeps every v3 rule and adds one post-packet question for each arm (opt-in, WORKFLOW_PROTOCOL=v4).
export const PROTOCOL_V4_CHANGES = [
  'After the fixed packet, each arm gets one chance to ask about a conflict: the app through its own open question, the baseline through one reconcile step.',
  'An arm that asks gets the same predeclared answer: the case correction text, frozen in the corpus before any run. No new answer was written after v3 was seen.',
  'An arm that does not ask gets nothing more. When the app never confirmed the inflated packet claim, the correction and repair are recorded as caught before drafting and unexercised, not as a repair success.',
  'v3 runs are retained unchanged. These remain seen diagnostic cases, not a holdout.',
];
export const PROTOCOL_V5 = 'paired-full-workflow-v5';
// v5 keeps every v4 rule and fixes how the app arm routes the fixed answer (WORKFLOW_PROTOCOL=v5).
export const PROTOCOL_V5_CHANGES = [
  'The app arm gives the fixed answer to its open question on the first requirement the form marks as asking what the applicant did themselves; every other open question is skipped and recorded. Under v4 only a question on the first requirement was answered, so a contribution question on another requirement got the answer as unlinked notes (set 2 exposure: 5 Baseten, 1 Meta, 5 Modal cases). The baseline arm and the fixed text are unchanged.',
];
export const PROTOCOL_CHANGES = [
  'Both arms use the actual app document specifications. The baseline-only mandate to repeat the contribution in the optional letter is removed.',
  'The correction fact stays exact and unique. Every sentence citing it is affected; multiple citations are allowed. No missing contribution is inserted.',
  'A document without a cited dependency is unaffected. Cross-document repair is exercised only when both original documents cite the fact; all other cases remain in the report.',
  'Original completeness is NOT GRADED automatically: review against actual per-document requirements, not the legacy both-documents condition.',
  'The first affected segment in document order receives For clarity: and needs an explicit repair decision. With no affected segment, repair and this manual-edit check are unexercised.',
  'The v1 compound manual replacement remains retired. Unrelated manual-wording preservation is NOT TESTED. V1/v2 runs are retained, not replaced.',
  'These cases have already been seen. Results are diagnostics, not untouched validation, human time saving or a general product-completion win.',
];
export const textOf = (doc) => (doc?.segments ?? doc ?? []).map((s) => s.text).join('\n\n');
export const docsOf = (documents) => Object.fromEntries(['answer', 'letter'].map((id) => [id, textOf(documents[id])]));
export const words = (text) => normalized(text).split(/\s+/).filter(Boolean).length;

export function fail(code) { throw Object.assign(new Error(code), { code }); }

// A phrase at a word boundary: "I designed…" is not found inside "Ravi designed…".
export function quotesPhrase(text, phrase) {
  const at = normalized(text).indexOf(normalized(phrase));
  if (at < 0) return false;
  const before = normalized(text)[at - 1] ?? ' ';
  return !/[\p{L}\p{N}]/u.test(before) || quotesPhrase(normalized(text).slice(at + 1), phrase);
}

export function exactFact(facts, anchor) {
  const matches = facts.filter((f) => f.status === 'confirmed' && quotesPhrase(f.quote, anchor));
  if (matches.length !== 1) fail('target-fact-missing-or-ambiguous');
  return matches[0];
}

export function documentSpecs(input) {
  return prepareOwnApplication({ ...input, synthetic: true, requirementsConfirmed: true }, { liveModel: true }).form.documents;
}

export function completenessRecord(input, original) {
  return { status: 'NOT GRADED', basis: 'Actual form requirements; evidence coverage alone does not prove draft completeness.',
    documentSpecs: documentSpecs(input), original };
}

export const segmentsCiting = (doc, factId) => doc.segments.filter((s) => s.factIds.includes(factId));
export const segmentsQuoting = (segments, anchor) => segments.filter((s) =>
  s.evidenceQuotes.some((q) => normalized(q).includes(normalized(anchor))));

export function recordDependencies(proof, documents, targets) {
  proof.affectedSegments = Object.fromEntries(['answer', 'letter'].map((id) => [id, targets[id].map((s) => s.id)]));
  proof.affectedDocuments = ['answer', 'letter'].filter((id) => targets[id].length);
  proof.dependencyBasis = 'Exact citation dependencies; semantic completeness is NOT GRADED.';
  proof.untouchedOriginal = untouchedSegments(documents, proof.affectedSegments);
  const docId = proof.affectedDocuments[0];
  proof.affectedManualEdit = docId ? { docId, segmentId: targets[docId][0].id } : null;
}

export function untouchedSegments(documents, targets) {
  return ['answer', 'letter'].flatMap((docId) => (documents[docId]?.segments ?? documents[docId]).filter(
    (segment) => !(targets[docId] ?? []).includes(segment.id)).map((segment) => ({ docId, segmentId: segment.id, text: segment.text })));
}

// Set 3B: the applicant's own sentence goes in place of the first factual letter
// segment the correction does not touch (the answer's when the letter has none).
export function unrelatedTarget(proof, documents, isFactual) {
  for (const docId of ['letter', 'answer']) {
    const segment = (documents[docId]?.segments ?? documents[docId] ?? []).find((s) => isFactual(s) && !proof.affectedSegments[docId].includes(s.id));
    if (segment) return { docId, segmentId: segment.id };
  }
  return fail('target-unrelated-segment-missing');
}

// After that hand edit, its text is what the untouched check must find unchanged.
export function recordUnrelatedEdit(proof, documents, target) {
  const segment = (documents[target.docId]?.segments ?? documents[target.docId]).find((s) => s.id === target.segmentId);
  proof.unrelatedEdit = { ...target, text: segment.text };
  proof.untouchedOriginal = proof.untouchedOriginal.map((o) => (o.docId === target.docId && o.segmentId === target.segmentId ? { ...o, text: segment.text } : o));
}

export function changedUntouchedSegments(documents, originals) {
  return originals.flatMap((original) => {
    const segments = documents[original.docId]?.segments ?? documents[original.docId] ?? [];
    const found = segments.find((segment) => segment.id === original.segmentId);
    return found?.text === original.text ? [] : [{ ...original, after: found?.text ?? null }];
  });
}

export function safeFailure(error) {
  const code = String(error?.code ?? 'comparison-failed');
  return /^[a-z][a-z0-9-]{0,70}$/.test(code) ? code : 'comparison-failed';
}

export function scoreRun(c, run) {
  const texts = run.final ?? {};
  const markers = c.expected.correctedMarkers;
  const affected = run.affectedDocuments ?? [];
  const byDocument = Object.fromEntries(['answer', 'letter'].map((id) => [id, affected.includes(id)
    ? markers.every((marker) => normalized(texts[id]).toLowerCase().includes(marker.toLowerCase())) : null]));
  return {
    semanticQuality: 'NOT GRADED', humanTimeSaved: 'NOT MEASURED',
    usableExport: run.status === 'completed' && ['answer', 'letter'].every((id) => Boolean(texts[id]))
      && run.exportStatus === 'NOT SUBMITTED' && run.freshApproval === true,
    originalCompleteness: 'NOT GRADED',
    correctedMarkersByDocument: byDocument,
    correctedMarkersInAllAffectedDocuments: affected.length ? affected.every((id) => byDocument[id]) : null,
    crossDocumentRepairEligible: Array.isArray(run.affectedDocuments) ? affected.length === 2 : null,
    crossDocumentRepairExercised: affected.length === 2 && run.repairAttempted === true,
    untouchedOriginalSegmentsPreserved: Boolean(run.untouchedOriginal?.length) && run.untouchedChanges?.length === 0,
    unrelatedManualWordingPreservation: run.unrelatedEdit
      ? normalized(texts[run.unrelatedEdit.docId]).includes(normalized(run.unrelatedEdit.text)) : 'NOT TESTED IN V3',
    explicitConflictDecision: run.affectedManualEdit ? run.explicitConflictDecision === true : null,
    withinWordLimits: Boolean(texts.answer && texts.letter)
      && words(texts.answer) <= c.input.wordLimit && words(texts.letter) <= 400,
    // These are deliberately only string hits, not counts of false claims.
    obsoleteExactPhrasesFound: c.expected.obsoletePhrases.filter((phrase) =>
      Object.values(texts).some((text) => normalized(text).toLowerCase().includes(phrase.toLowerCase()))),
    controlledSetupFailure: String(run.failure ?? '').startsWith('target-'),
  };
}

export function scopeAccounting(runs) {
  return Object.fromEntries(['app', 'baseline'].map((method) => {
    const arm = runs.filter((run) => run.method === method);
    return [method, { retainedArms: arm.length, completedTechnicalWorkflows: arm.filter((r) => r.status === 'completed').length,
      failedArms: arm.filter((r) => r.status === 'failed').length,
      scopeNotReached: arm.filter((r) => !Array.isArray(r.affectedDocuments)).length,
      noAffectedDocument: arm.filter((r) => r.affectedDocuments?.length === 0).length,
      oneAffectedDocument: arm.filter((r) => r.affectedDocuments?.length === 1).length,
      bothDocumentsAffected: arm.filter((r) => r.affectedDocuments?.length === 2).length }];
  }));
}

// The label a report carries, from one place, so a v4 run is never saved as v3
// and a held-out corpus never reads as seen cases.
// version: false (v3), true or 'v4', or 'v5'.
export function protocolLabel(version = false, heldOut = false) {
  const v5 = version === 'v5';
  const changes = v5 ? [...PROTOCOL_CHANGES, ...PROTOCOL_V4_CHANGES, ...PROTOCOL_V5_CHANGES]
    : version ? [...PROTOCOL_CHANGES, ...PROTOCOL_V4_CHANGES] : PROTOCOL_CHANGES;
  return { protocol: v5 ? PROTOCOL_V5 : version ? PROTOCOL_V4 : PROTOCOL, caseStatus: heldOut ? HELD_OUT_STATUS : CASE_STATUS,
    protocolChanges: heldOut ? [...changes.filter((c) => !SEEN.test(c)), `${HELD_OUT_STATUS}; the app was not changed after they were written.`] : changes };
}

export async function pairCases(cases, runners, save = async () => {}, label = protocolLabel()) {
  const report = { ...label, runs: [], semanticReview: 'NOT GRADED', humanTiming: 'NOT MEASURED' };
  for (const [index, c] of cases.entries()) {
    const order = index % 2 ? ['app', 'baseline'] : ['baseline', 'app'];
    for (const method of order) {
      const started = performance.now();
      let result;
      try { result = await runners[method](c); }
      catch (error) { result = { status: 'failed', failure: safeFailure(error) }; }
      report.runs.push({ caseId: c.id, method, pairOrder: order, legacyExpected: c.expected,
        expectationScope: 'Use actual originalCompleteness requirements and affectedDocuments. Legacy unconditional both-doc/manual constraints are inactive.', ...result,
        machineElapsedMs: Math.round(performance.now() - started), checks: scoreRun(c, result) });
      report.scopeAccounting = scopeAccounting(report.runs);
      await save(report);
    }
  }
  return report;
}
