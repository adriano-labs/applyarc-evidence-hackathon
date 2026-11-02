// Draft the two documents independently. A failed claim gets one targeted
// revision; accepted wording and its evidence verdict never need regenerating.
import { draftBlockers, draftProblems, saidBefore, setDraft } from '../domain/documents.js';
import { coverage } from '../domain/facts.js';
import { refuse } from '../domain/errors.js';
import { confirmedFacts, DOC_IDS } from '../domain/workspace.js';
import { reviewClaims } from './evidenceReview.js';
import { normalise, wordCount } from '../domain/text.js';
import { unansweredRequirements } from '../domain/completeness.js';
import { frameOptions } from '../domain/frames.js';

const isReal = (agent) => Boolean(agent.provider && agent.provider.id !== 'fixture');
const factsFor = (ws) => confirmedFacts(ws).map(({ id, statement, quote }) => ({ id, statement, quote }));
const GREETING_OR_SIGNOFF = /^(dear\b|to whom it may concern\b|yours (sincerely|faithfully)\b|kind regards\b|best regards\b)/i;

function commitDraft(ws, docId, segments, review) {
  if (!segments.some((s) => s?.kind === 'claim')) {
    refuse('invalid-draft', 'No supported claim remains in this draft.', { problems: [] });
  }
  setDraft(ws, docId, segments, review);
}

// The letter's own frame sentences, the ones the letter's draft may choose from.
function letterFrames(ws) {
  const { company, role } = ws.application.form;
  const { openings, closings } = frameOptions({ company, role, applicant: ws.applicant.name });
  return new Set([...openings, ...closings].map((t) => normalise(t).toLowerCase()));
}

// The answer never carries letter text: a frame, or a claim that is a greeting, a
// sign-off or one of the letter's frame sentences (a supported "I am applying for …
// because …" stays). No document says a sentence twice.
function filterPassing(ws, docId, segments, review) {
  const failed = new Map(draftProblems(ws, segments, review));
  const frames = docId === 'answer' ? letterFrames(ws) : null;
  if (frames) segments.forEach((s, i) => {
    const text = normalise(s?.text ?? '');
    if (s?.kind === 'frame' || (s?.kind === 'claim' && (GREETING_OR_SIGNOFF.test(text) || frames.has(text.toLowerCase())))) {
      failed.set(i, 'Greetings and sign-offs belong in the cover letter.');
    }
  });
  let refused;
  let kept;
  // Dropping a sentence can fail the next one (a "them" whose person was named
  // just before), so check what is kept again until nothing new fails.
  for (;;) {
    refused = new Map(failed);
    kept = [];
    const at = [];
    const said = [];
    let startsParagraph = false;
    segments.forEach((segment, index) => {
      if (!refused.has(index) && segment?.kind === 'claim' && saidBefore(segment.text, said)) refused.set(index, 'Said already.');
      if (refused.has(index)) {
        startsParagraph ||= Boolean(segment?.startsParagraph);
        return;
      }
      if (segment?.kind === 'claim') said.push(segment.text);
      kept.push({ ...segment, startsParagraph: Boolean(segment.startsParagraph) || startsParagraph });
      at.push(index);
      startsParagraph = false;
    });
    const later = draftProblems(ws, kept, review);
    if (!later.length) break;
    for (const [k, reason] of later) failed.set(at[k], reason);
  }
  const dropped = [...refused].map(([index, reason]) => ({ docId, text: segments[index]?.text, reason }));
  const problems = [...refused].sort(([x], [y]) => x - y).map(([index, reason]) => `Sentence ${index + 1}: ${reason}`);
  return { kept, dropped, problems };
}

function keepWhatPasses(ws, docId, segments, review) {
  const { kept, dropped } = filterPassing(ws, docId, segments, review);
  commitDraft(ws, docId, kept, review);
  return dropped;
}

async function retryWholeDraft(ws, docId, args, agent, emit, segments, review) {
  try {
    commitDraft(ws, docId, segments, review);
    return [];
  } catch (error) {
    if (error?.code !== 'invalid-draft') throw error;
    const problems = (error.details?.problems ?? []).map(([index, reason]) => `Sentence ${index + 1}: ${reason}`);
    emit({ type: 'stage', label: problems.length === 1 ? 'The evidence check refused 1 sentence; asking for a fix' : `The evidence check refused ${problems.length} sentences; asking for a fix` });
    const result = await agent.draft({ ...args, problems });
    const revised = result.segments ?? [];
    return keepWhatPasses(ws, docId, revised, await reviewClaims(ws, revised, agent, emit));
  }
}

const missingLine = (r) => `Not answered yet: "${r.text}". Use ${r.factIds.length === 1 ? 'fact' : 'facts'} ${r.factIds.join(', ')}.`;

function tooLong(kept, limit) {
  const words = wordCount(kept.map((s) => s.text).join(' '));
  return limit && words > limit ? `Over the word limit: ${words} words of ${limit}. Cut it to under ${limit} words and keep every requirement answered.` : null;
}

async function improveLetterOnce(ws, docId, args, agent, emit, gap, first, review) {
  const problems = [`ApplyArc writing suggestion: add any one example of your own contribution using one of these qualifying facts: ${gap.factIds.join(', ')}. Keep the other checked wording; you do not need to use every fact.`];
  try {
    const dropped = await redraftOnce(ws, docId, args, agent, emit, problems, 'Adding your own contribution to the letter');
    if (!unansweredRequirements(ws, docId).length) return dropped;
  } catch (error) {
    if (error?.code === 'cancelled' || error?.code === 'ABORT_ERR' || error?.name === 'AbortError') throw error;
  }
  commitDraft(ws, docId, first.kept, review);
  emit({ type: 'stage', label: 'Keeping the checked draft; the writing suggestion remains' });
  return first.dropped;
}

// One more draft when nothing passed or the text ran over its limit; after that it fails closed.
async function redraftOnce(ws, docId, args, agent, emit, problems, label) {
  emit({ type: 'stage', label });
  const result = await agent.draft({ ...args, problems });
  const segments = result.segments ?? [];
  const review = await reviewClaims(ws, segments, agent, emit);
  const revised = await reviseFailedClaims(ws, segments, draftProblems(ws, segments, review), args, agent, emit, review);
  const { kept, dropped } = filterPassing(ws, docId, revised.segments, revised.review);
  if (tooLong(kept, args.doc?.wordLimit)) refuse('over-limit', 'The draft stayed over the word limit. Nothing was changed. Try again.');
  commitDraft(ws, docId, kept, revised.review);
  return dropped;
}

function replacementsFor(items, segments, rewrites) {
  const allowed = new Set(items.map((item) => item.segmentId));
  const seen = new Set();
  const replacements = new Map();
  for (const rewrite of Array.isArray(rewrites) ? rewrites : []) {
    const id = rewrite?.segmentId;
    if (!allowed.has(id)) continue;
    if (seen.has(id)) { replacements.delete(id); continue; }
    seen.add(id);
    if (typeof rewrite.text !== 'string' || !rewrite.text.trim()
      || !Array.isArray(rewrite.factIds) || !rewrite.factIds.every((factId) => typeof factId === 'string')) continue;
    replacements.set(id, { ...segments[Number(id)], text: rewrite.text, factIds: rewrite.factIds });
  }
  return replacements;
}

async function reviseFailedClaims(ws, segments, problems, args, agent, emit, review) {
  const items = problems.filter(([index]) => segments[index]?.kind === 'claim').map(([index, reason]) => ({
    segmentId: String(index), text: segments[index].text, reason, factIds: segments[index].factIds ?? [],
  }));
  if (!items.length) return { segments, review };
  emit({ type: 'stage', label: `Revising ${items.length} unsupported sentence${items.length === 1 ? '' : 's'}` });
  let rewrites;
  try {
    const result = await agent.revise({ items, facts: args.facts, emit });
    rewrites = result?.rewrites;
  } catch (error) {
    if (error?.code === 'invalid-output') {
      emit({ type: 'stage', label: 'The rewording step sent an answer that could not be read; going on without it' });
      return { segments, review };
    }
    throw error;
  }
  const replacements = replacementsFor(items, segments, rewrites);
  if (!replacements.size) return { segments, review };
  const newReview = await reviewClaims(ws, [...replacements.values()], agent, emit);
  return {
    segments: segments.map((segment, index) => replacements.get(String(index)) ?? segment),
    review: new Map([...(review ?? []), ...(newReview ?? [])]),
  };
}

export async function draftOne(ws, docId, args, agent, emit = () => {}) {
  if (ws.application.documents[docId]?.segments.some((segment) => segment.author === 'user')) {
    refuse('would-overwrite', 'This document has your edits; a new draft would replace them.');
  }
  emit({ type: 'stage', label: docId === 'answer' ? 'Drafting the project answer' : 'Drafting the cover letter' });
  const { segments } = await agent.draft(args);
  const review = await reviewClaims(ws, segments, agent, emit);
  if (!isReal(agent) || typeof agent.revise !== 'function') return retryWholeDraft(ws, docId, args, agent, emit, segments, review);
  const problems = draftProblems(ws, segments, review);
  const revised = await reviseFailedClaims(ws, segments, problems, args, agent, emit, review);
  const pass = filterPassing(ws, docId, revised.segments, revised.review);
  if (!pass.kept.some((s) => s?.kind === 'claim')) {
    return redraftOnce(ws, docId, args, agent, emit, pass.problems, 'No sentence passed the evidence check; asking for a new draft');
  }
  // One redraft in all names everything still wrong: the limit and any covered requirement left out.
  const over = tooLong(pass.kept, args.doc?.wordLimit);
  const unanswered = unansweredRequirements(ws, docId, pass.kept);
  if (docId === 'letter' && !over && unanswered.length === 1 && unanswered[0].id === 'letter-personal-contribution') {
    return improveLetterOnce(ws, docId, args, agent, emit, unanswered[0], pass, revised.review);
  }
  const asks = [over, ...unanswered.map(missingLine)].filter(Boolean);
  if (asks.length) {
    return redraftOnce(ws, docId, args, agent, emit, asks, over ? 'Over the word limit; asking for a shorter draft' : 'Not every requirement is answered; asking for a new draft');
  }
  commitDraft(ws, docId, pass.kept, revised.review);
  return pass.dropped;
}

export async function draftDocuments(ws, agent, emit = () => {}) {
  const blockers = draftBlockers(ws);
  if (blockers.length) refuse('not-ready', blockers[0], { blockers });
  const facts = factsFor(ws);
  const cover = coverage(ws);
  const drafted = DOC_IDS.filter((id) => !ws.application.documents[id]);
  const run = async (docId) => {
    const doc = ws.application.form.documents.find((d) => d.id === docId);
    const dropped = await draftOne(ws, docId, {
      form: ws.application.form, docId, doc,
      facts, coverage: cover.filter((r) => r.docId === docId), applicant: ws.applicant.name, emit,
    }, agent, emit);
    // A read-only preview, not a save: the outer transaction commits only when
    // both documents finish. Never stream unchecked model text into the UI.
    emit({ type: 'document-ready', docId, title: doc.title,
      segments: structuredClone(ws.application.documents[docId].segments) });
    return dropped;
  };
  const results = [];
  if (isReal(agent)) {
    // Settle both calls before the outer store commits or discards its clone.
    const settled = await Promise.allSettled(drafted.map(run));
    const failed = settled.find((result) => result.status === 'rejected');
    if (failed) throw failed.reason;
    results.push(...settled.map((result) => result.value));
  } else {
    for (const docId of drafted) results.push(await run(docId));
  }
  emit({ type: 'stage', label: 'Checking the word counts' });
  return { drafted, dropped: results.flat() };
}
