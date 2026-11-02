import { createApp } from '../../server/app.js';
import { prepareOwnApplication } from '../../server/domain/ownForm.js';
import { apiClient } from '../journey.mjs';
import { changedUntouchedSegments, completenessRecord, docsOf, exactFact, fail, quotesPhrase, recordDependencies, recordUnrelatedEdit, safeFailure, segmentsCiting, unrelatedTarget } from './shared.mjs';

function appRun(c, { dataDir, agent, ledger, continuation = false, routing = 'first', unrelatedEdit = false }) {
  const input = { ...c.input, synthetic: true, requirementsConfirmed: true };
  const { form } = prepareOwnApplication(input, { liveModel: true });
  const app = createApp({ dataDir, form, agent, ledger });
  const proof = { status: 'failed', trace: [], httpResponses: [], final: null };
  const request = async (method, path, body) => {
    const response = await app.request(path, { method, headers: { 'content-type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    if (method === 'POST') proof.httpResponses.push({ path, status: response.status, body: await response.clone().text() });
    return response;
  };
  const api = apiClient(request);
  let state;
  const invoke = (kind) => async (name, args) => {
    state = await api[kind](name, args);
    proof.trace.push({ action: name, result: state.result });
    return state;
  };
  const act = invoke('act');
  const run = invoke('run');
  const readAndConfirm = async (sourceId) => {
    await run('read', { sourceId });
    await act('confirmFacts', { factIds: state.result.accepted });
  };
  const approve = async () => {
    for (const docId of ['answer', 'letter']) await act('approve', {
      docId, docRevision: state.workspace.application.documents[docId].revision });
  };
  return { input, api, proof, act, run, readAndConfirm, approve, continuation, routing, unrelatedEdit, state: () => state };
}

async function prepareDraft(c, ctx) {
  const { input, proof, act, run, readAndConfirm } = ctx;
  await act('startOwnApplication', input);
  await readAndConfirm(ctx.state().result.id);
  await run('check');
  proof.questions = structuredClone(ctx.state().workspace.application.questions);
  // v5 answers the question on the first requirement the form marks personal; v3 and v4 only own-answer-1.
  const target = ctx.routing === 'personal'
    ? ctx.state().workspace.application.form.documents.flatMap((d) => d.requirements).find((r) => r.personal)?.id : 'own-answer-1';
  const question = proof.questions.find((q) => q.status === 'open' && q.requirementId === target);
  const skipped = proof.questions.filter((q) => q.status === 'open' && q !== question);
  proof.answeredRequirement = question?.requirementId ?? null;
  proof.skippedQuestions = skipped.map((q) => q.requirementId);
  for (const q of skipped) await act('skip', { questionId: q.id });
  // Same one-round packet in both arms. Not asking is recorded, never hidden.
  proof.clarificationMode = question ? 'answered-question' : 'volunteered-fixed-packet';
  await act(question ? 'answer' : 'notes', question
    ? { questionId: question.id, text: c.clarificationAnswer } : { text: c.clarificationAnswer });
  await readAndConfirm(question ? ctx.state().result.source.id : ctx.state().result.id);
  // v4: a question still open after the packet (a conflict the app found) gets the
  // case's own predeclared correction as its one answer, the same text the baseline gets.
  const open = ctx.continuation && ctx.state().workspace.application.questions.find((q) => q.status === 'open');
  if (open) {
    proof.continuation = { question: open.text, answer: c.correction.after };
    await act('answer', { questionId: open.id, text: c.correction.after });
    await readAndConfirm(ctx.state().result.source.id);
    // The app now asks the applicant to decide on the earlier fact the conflict was
    // about. The harness keeps it, recorded, because its predeclared correction step
    // corrects that fact next: the measured flow stays exactly as in v4.
    const settle = ctx.state().view?.conflictDecisions ?? [];
    for (const d of settle) await act('settleConflict', { questionId: d.questionId, factId: d.factId, decision: 'keep' });
    if (settle.length) proof.conflictSettled = 'kept';
  }
  proof.facts = structuredClone(ctx.state().workspace.applicant.facts);
  await run('draft');
  proof.original = docsOf(ctx.state().workspace.application.documents);
  proof.originalCompleteness = completenessRecord(c.input, proof.original);
  proof.initialEvidenceCoverage = ctx.state().view?.coverage ?? [];
}

async function finishRepair(ctx) {
  const { proof, act, run } = ctx;
  proof.repairAttempted = true;
  await run('repair');
  proof.proposal = structuredClone(ctx.state().workspace.application.repair);
  const items = proof.proposal.items;
  if (items.some((item) => !item.after)) fail('repair-needs-human-wording');
  const conflict = items.find((item) => item.segmentId === proof.affectedManualEdit.segmentId
    && item.docId === proof.affectedManualEdit.docId && item.status === 'conflict');
  if (!conflict) fail('target-manual-conflict-not-detected');
  for (const item of items) await act('decideChange', { itemId: item.id, decision: 'take' });
  proof.explicitConflictDecision = true;
  proof.reviewDecision = { action: 'accept-proposed-repair', scripted: true, humanQualityApproved: false };
  await act('applyChanges');
  proof.repaired = docsOf(ctx.state().workspace.application.documents);
}

async function finishExport(ctx) {
  const { proof, act, approve } = ctx;
  proof.untouchedChanges = changedUntouchedSegments(ctx.state().workspace.application.documents, proof.untouchedOriginal);
  await approve();
  await act('export');
  const pack = ctx.state().result;
  proof.exportStatus = pack.status;
  proof.final = Object.fromEntries(pack.documents.map((d) => [d.id, d.text]));
  proof.freshApproval = pack.documents.every((d) => d.approvedAt);
  proof.export = pack;
  proof.status = 'completed';
}

// The inflated packet claim never became a confirmed fact because the app asked first.
function caughtEarly(c, ctx) {
  if (!ctx.proof.continuation) return false;
  return !ctx.state().workspace.applicant.facts.some((f) => f.status === 'confirmed' && quotesPhrase(f.quote, c.correction.anchor));
}

export async function runAppCase(c, options) {
  const ctx = appRun(c, options);
  try {
    await prepareDraft(c, ctx);
    if (caughtEarly(c, ctx)) {
      recordDependencies(ctx.proof, ctx.state().workspace.application.documents, { answer: [], letter: [] });
      ctx.proof.correctionCaughtEarly = true;
      ctx.proof.repairSkipped = 'The predeclared answer corrected this claim before drafting, so no correction or repair was left to exercise.';
    } else {
      await editAndCorrect(c, ctx.state(), ctx.proof, ctx.act, ctx.approve, ctx.unrelatedEdit);
      if (ctx.proof.affectedDocuments.length) await finishRepair(ctx);
      else ctx.proof.repairSkipped = 'No original document cites the corrected fact; no repair or manual-conflict test exercised.';
    }
    await finishExport(ctx);
  } catch (error) { ctx.proof.failure = safeFailure(error); }
  ctx.proof.workspace = ctx.state()?.workspace ?? null;
  ctx.proof.missingCriteria = ctx.state()?.view?.coverage?.filter((requirement) => !requirement.covered) ?? [];
  try { ctx.proof.receipts = (await ctx.api.get('/api/receipts')).receipts; }
  catch (error) { ctx.proof.receiptReadFailure = safeFailure(error); }
  return ctx.proof;
}

async function editAndCorrect(c, initial, proof, act, approve, unrelated) {
  const facts = initial.workspace.applicant.facts;
  const target = exactFact(facts, c.correction.anchor);
  const docs = initial.workspace.application.documents;
  const targets = Object.fromEntries(['answer', 'letter'].map((id) => [id, segmentsCiting(docs[id], target.id)]));
  recordDependencies(proof, docs, targets);
  // This prefix is a wording change, not an invented accomplishment or metric.
  if (proof.affectedManualEdit) {
    const { docId, segmentId } = proof.affectedManualEdit;
    const edited = await act('edit', { docId, segmentId, text: `For clarity: ${targets[docId][0].text}` });
    proof.edited = docsOf(edited.workspace.application.documents);
  } else proof.edited = proof.original;
  if (unrelated) {
    const target = unrelatedTarget(proof, docs, (s) => s.kind === 'claim');
    const edited = await act('edit', { ...target, text: c.manual.replacement });
    recordUnrelatedEdit(proof, edited.workspace.application.documents, target);
    proof.edited = docsOf(edited.workspace.application.documents);
  }
  await approve();
  const changed = await act('changeFact', { factId: target.id, text: c.correction.after });
  if (proof.affectedDocuments.some((id) => changed.workspace.application.approvals[id] !== null)) fail('approval-not-invalidated');
  proof.correctionAppliedToEvidence = true;
  const items = changed.workspace.application.repair?.items ?? [];
  const expected = Object.entries(proof.affectedSegments).flatMap(([docId, ids]) => ids.map((id) => `${docId}:${id}`)).sort();
  if (JSON.stringify(items.map((i) => `${i.docId}:${i.segmentId}`).sort()) !== JSON.stringify(expected)) fail('repair-dependencies-mismatch');
}
