// A suggestion is separate from the document. Only explicit acceptance changes
// its one sentence, and only while the wording and evidence are still current.
import { createHash, randomUUID } from 'node:crypto';
import { documentStats, findSegment } from './documents.js';
import { refuse } from './errors.js';
import { normalise, wordCount } from './text.js';
import { confirmedFacts, formDocument } from './workspace.js';
import { reviewKey } from '../agent/evidenceReview.js';

const fingerprint = (ws, segment) => createHash('sha256').update(reviewKey(ws, segment)).digest('hex');
const DEFAULT_REQUEST = 'Make this sentence clearer and more specific without adding facts.';
const NO_PROPOSAL = 'I could not find a useful supported change. Your original is unchanged.';

function requestText(value) {
  if (value !== undefined && typeof value !== 'string') refuse('invalid', 'Write your request as text.');
  const text = (value ?? '').trim();
  if (text.length > 500) refuse('invalid', 'Keep your request under 500 characters.');
  return text || DEFAULT_REQUEST;
}

export function prepareSuggestion(ws, input, provider) {
  if (!provider || provider.id === 'fixture') refuse('invalid', 'Sentence suggestions need the live model.');
  if (ws.application.repair) refuse('repair-open', 'Finish reviewing the fact correction first.');
  if (ws.application.suggestion) refuse('suggestion-open', 'Review or dismiss the current suggestion first.');
  const { docId, segmentId } = input;
  const { doc, segment } = findSegment(ws, docId, segmentId);
  if (segment.kind !== 'claim') refuse('invalid', 'Choose a factual sentence, not a greeting or sign-off.');
  const facts = confirmedFacts(ws).map(({ id, statement, quote }) => ({ id, statement, quote }));
  if (!facts.length) refuse('not-ready', 'Confirm evidence before asking for a suggestion.');
  return {
    docId, segmentId, before: segment.text, beforeFactIds: [...segment.factIds], baseAuthor: segment.author,
    baseFormId: ws.application.form.id, baseDocRevision: doc.revision,
    beforeEvidenceHash: fingerprint(ws, segment), request: requestText(input.request),
    segment: structuredClone(segment), facts, question: formDocument(ws, docId).question,
    wordLimit: formDocument(ws, docId).wordLimit,
  };
}

export function candidateFor(result) {
  if (result?.outcome !== 'revision' || typeof result.text !== 'string') return null;
  const text = normalise(result.text);
  const factIds = result.factIds;
  if (!text || text.length > 2000 || !Array.isArray(factIds) || !factIds.length || factIds.length > 20
    || !factIds.every((id) => typeof id === 'string') || new Set(factIds).size !== factIds.length) return null;
  return { kind: 'claim', text, factIds: [...factIds] };
}

function currentTarget(ws, binding) {
  if (ws.application.repair) refuse('repair-open', 'Finish reviewing the fact correction first.');
  const { doc, segment } = findSegment(ws, binding.docId, binding.segmentId);
  if (ws.application.form.id !== binding.baseFormId || doc.revision !== binding.baseDocRevision
    || segment.text !== binding.before || segment.author !== binding.baseAuthor
    || fingerprint(ws, segment) !== binding.beforeEvidenceHash) {
    refuse('stale', 'This sentence or its evidence changed. Keep your current work and ask again.');
  }
  return { doc, segment };
}

function rejectionReason(ws, context, candidate, review) {
  if (!candidate) return NO_PROPOSAL;
  if (candidate.text === normalise(context.before)) return 'The proposed wording is already in your document. Your original is unchanged.';
  const confirmed = new Set(confirmedFacts(ws).map((fact) => fact.id));
  if (candidate.factIds.some((id) => !confirmed.has(id))) return 'The suggestion cited evidence that is not confirmed. Your original is unchanged.';
  const key = reviewKey(ws, candidate);
  if (!(review instanceof Map) || !review.has(key) || review.get(key) !== null) {
    return review instanceof Map && typeof review.get(key) === 'string'
      ? review.get(key).slice(0, 400) : 'The evidence review could not establish support. Your original is unchanged.';
  }
  const stats = documentStats(ws, context.docId);
  if (stats.words - wordCount(context.before) + wordCount(candidate.text) > stats.wordLimit) {
    return 'This suggestion would take the document over its word limit. Ask for a shorter version.';
  }
  return null;
}

export function finishSuggestion(ws, context, result, review, now = new Date().toISOString()) {
  currentTarget(ws, context);
  const candidate = candidateFor(result);
  const rejected = rejectionReason(ws, context, candidate, review);
  const explanation = typeof result?.reason === 'string' ? result.reason.trim().slice(0, 400) : '';
  const { docId, segmentId, before, beforeFactIds, baseAuthor, baseFormId, baseDocRevision, beforeEvidenceHash, request } = context;
  const suggestion = {
    id: randomUUID(), docId, segmentId, before, beforeFactIds, baseAuthor, baseFormId, baseDocRevision,
    beforeEvidenceHash, request, createdAt: now, status: rejected ? 'refused' : 'proposed',
    after: rejected ? null : candidate.text, afterFactIds: rejected ? [] : candidate.factIds,
    afterEvidenceHash: rejected ? null : fingerprint(ws, candidate),
    reason: result?.outcome === 'refusal' && explanation ? explanation : rejected || explanation || 'This keeps the meaning supported by your confirmed evidence.',
  };
  ws.application.suggestion = suggestion;
  return { suggestion };
}

function selectedSuggestion(ws, suggestionId) {
  const suggestion = ws.application.suggestion;
  if (!suggestion || suggestion.id !== suggestionId) refuse('invalid', 'That suggestion is no longer available.');
  return suggestion;
}

export function acceptSuggestion(ws, suggestionId, now = new Date().toISOString()) {
  const suggestion = selectedSuggestion(ws, suggestionId);
  if (suggestion.status !== 'proposed') refuse('invalid', 'There is no supported suggestion to accept.');
  const { doc, segment } = currentTarget(ws, suggestion);
  const candidate = { text: suggestion.after, factIds: suggestion.afterFactIds };
  if (fingerprint(ws, candidate) !== suggestion.afterEvidenceHash) {
    refuse('stale', 'The evidence for this suggestion changed. Keep your current work and ask again.');
  }
  Object.assign(segment, candidate, { author: 'assisted' });
  doc.revision += 1;
  ws.application.approvals[suggestion.docId] = null;
  ws.application.lastSuggestion = { docId: suggestion.docId, segmentId: suggestion.segmentId, before: suggestion.before,
    beforeFactIds: suggestion.beforeFactIds, beforeAuthor: suggestion.baseAuthor, after: suggestion.after,
    afterFactIds: suggestion.afterFactIds, acceptedAt: now };
  ws.application.suggestion = null;
  return { accepted: true, docId: suggestion.docId, segmentId: suggestion.segmentId };
}

export function dismissSuggestion(ws, suggestionId) {
  selectedSuggestion(ws, suggestionId);
  ws.application.suggestion = null;
  return { dismissed: true };
}
