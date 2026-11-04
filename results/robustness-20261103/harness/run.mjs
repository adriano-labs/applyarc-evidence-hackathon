#!/usr/bin/env node
// Drive whole applicant journeys over the app's HTTP API and check nine invariants.
//   node run.mjs --host wonder --base http://127.0.0.1:3170 --personas priya,tom --concurrency 2 --headroom 1.5
// Reuses the app's own apiClient/remoteRequest (scripts/journey.mjs) and text rules.
// Each journey writes runs/<host>/<persona>.json; the host writes runs/<host>/summary.json.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { apiClient, remoteRequest } from '../../../scripts/journey.mjs';
import { isVerbatim, normalise, numbers } from '../../../server/domain/text.js';
import { ALL } from './personas.mjs';

const ROOT = new URL('.', import.meta.url).pathname;

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) { out[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true; }
  }
  return out;
}

// Same table as the app's server/http/errors.js, so a streamed error can be classed like an HTTP status.
const STATUS = {
  stale: 409, 'not-ready': 409, 'would-overwrite': 409, 'repair-open': 409, undecided: 409, 'not-approved': 409, cap: 409,
  invalid: 422, 'over-limit': 422, 'invalid-draft': 502, 'not-found': 404, provider: 502, busy: 503, timeout: 504, cut: 502,
  cancelled: 499, failed: 502, incomplete: 502, refused: 422, 'invalid-output': 502, network: 502, auth: 502, billing: 503, limit: 429,
};

// The client's own retryable set (client/src/useWorkspace.js:10): these are the errors the UI shows "Try again" for.
// Note: the first runs (before 14:05Z on 3 Nov 2026) retried only when the message text said "Try again",
// which excluded `incomplete`; one Leo plain-phrased journey aborted on it and was rerun.
const UI_RETRYABLE = new Set(['busy', 'cut', 'timeout', 'network', 'invalid-output', 'invalid-draft', 'failed', 'incomplete', 'internal']);
const retryable = (e) => UI_RETRYABLE.has(errorOf(e).code) || /try again/i.test(String(e?.message));
const clone = (v) => JSON.parse(JSON.stringify(v));
const words = (t) => new Set(normalise(t).toLowerCase().match(/[a-z0-9/.]+/g) ?? []);
const overlap = (a, b) => { const w = words(b); return [...words(a)].filter((x) => w.has(x)).length; };
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };

function errorOf(e) {
  const message = String(e?.message ?? e);
  let code = e?.code ?? null;
  if (!code) { const m = /^(?:[a-zA-Z]+: )?([a-z-]+): /.exec(message); code = m?.[1] ?? 'unknown'; }
  return { code, message, httpStatus: e?.httpStatus ?? STATUS[code] ?? null };
}

// Every request is logged with its status and time; 4xx/5xx bodies keep their error code.
function loggedRequest(baseUrl, log) {
  const raw = remoteRequest(baseUrl);
  return async (method, path, body) => {
    const started = performance.now();
    const response = await raw(method, path, body);
    const entry = { method, path, status: response.status, ms: Math.round(performance.now() - started) };
    if (response.status >= 400) { try { entry.error = (await response.clone().json()).error; } catch { /* not JSON */ } }
    log.push(entry);
    return response;
  };
}

async function runJourney({ host, baseUrl, persona, headroomUsd, log, probe = false, plain = false }) {
  const http = [];
  const request = loggedRequest(baseUrl, http);
  const api = apiClient(request, { retryOnce: false });
  // --plain: the same correcting note without the word "correction" in it. --probe: stop right after the note is read.
  const correctionText = plain ? (persona.correctionPlain ?? persona.correction.text) : persona.correction.text;
  const journey = {
    host, persona: persona.id, style: persona.style, startedAt: new Date().toISOString(), completed: false, abortedAt: null, abortReason: null,
    probe, plain, correctionText, steps: [], findings: [], route: null, correctedFactId: null, intendedTargetId: null, questions: [], skipped: [], snapshots: {}, http,
  };
  const finding = (kind, detail) => { journey.findings.push({ kind, ...detail }); log(`   ! ${kind}${detail?.note ? `: ${detail.note}` : ''}`); };
  let receiptCount = 0;
  const receiptsNow = async () => (await (await request('GET', '/api/receipts')).json());
  const step = async (name, fn, { retry = false } = {}) => {
    const rec = { name, startedAt: new Date().toISOString(), ms: 0, ok: false, retries: 0, firstError: null, error: null, receipts: [], stages: [] };
    const t0 = performance.now();
    const before = http.length;
    try {
      let out;
      try { out = await fn(); } catch (e) {
        if (retry && retryable(e)) { rec.retries = 1; rec.firstError = errorOf(e); log(`   retry: ${name} (${rec.firstError.code})`); out = await fn(); } else throw e;
      }
      rec.ok = true;
      return out;
    } catch (e) {
      rec.error = errorOf(e);
      throw Object.assign(e instanceof Error ? e : new Error(String(e)), { stepName: name, code: rec.error.code });
    } finally {
      rec.ms = Math.round(performance.now() - t0);
      rec.http = http.slice(before).map(({ method, path, status, ms }) => ({ method, path, status, ms }));
      try {
        const { receipts } = await receiptsNow();
        const fresh = receipts.slice(receiptCount);
        receiptCount = receipts.length;
        rec.receipts = fresh.filter((r) => r.kind !== 'stage').map(({ step: s, docId, model, effort, turns, attempts, toolCalls, usage, costUsd, firstEventMs, totalMs, unsettled, error }) => ({ step: s, docId, model, effort, turns, attempts, toolCalls: toolCalls?.length ?? 0, toolNotes: (toolCalls ?? []).map((t) => `${t.name}:${t.note}`), usage, costUsd, firstEventMs, totalMs, unsettled, error }));
        rec.stages = fresh.filter((r) => r.kind === 'stage').map((r) => r.label);
      } catch { /* receipts are best effort */ }
      journey.steps.push(rec);
      log(`${String(journey.steps.length).padStart(2)} ${name} (${rec.ms} ms${rec.retries ? ', retried' : ''}${rec.ok ? '' : `, FAILED ${rec.error.code}`})`);
    }
  };
  const confirmProposed = async (state) => {
    for (const f of state.workspace.applicant.facts.filter((x) => x.status === 'proposed')) state = await api.act('decideFact', { factId: f.id, decision: 'confirm' });
    return state;
  };
  const openQuestions = (state) => state.workspace.application.questions.filter((q) => q.status === 'open');
  const settleDecisions = async (state) => {
    for (const d of state.view.conflictDecisions ?? []) {
      finding('earlier-fact-decision', { note: `kept earlier fact ${d.factId} after a conflict answer`, quote: d.quote });
      state = await api.act('settleConflict', { questionId: d.questionId, factId: d.factId, decision: 'keep' });
    }
    return state;
  };
  // A conflict the model raised on the notes or on the answer: explain, as the README suggests, then read the explanation.
  const explainConflict = async (state, questionId, where) => {
    const q = state.workspace.application.questions.find((x) => x.id === questionId);
    finding('conflict-raised', { where, question: q?.text, priorQuote: q?.priorQuote, quote: q?.quote, note: `${where}: "${q?.text}"` });
    state = await step(`explain the conflict (${where})`, () => api.act('answer', { questionId, text: persona.conflictAnswer }));
    state = await step(`read the explanation (${where})`, () => api.run('read', { sourceId: state.result.source.id }), { retry: true });
    if (state.result.conflict) {
      finding('conflict-raised-again', { where, note: 'the explanation was held too; skipped it' });
      state = await step(`skip the second conflict (${where})`, () => api.act('skip', { questionId: state.result.questionId }));
    }
    state = await confirmProposed(state);
    return settleDecisions(state);
  };

  try {
    await step('start fresh', () => api.reset());
    const start = await api.get('/api/state');
    journey.mode = start.mode;
    journey.budgetStart = start.budget;
    if (start.budget && Number.isFinite(headroomUsd) && start.budget.remainingUsd < headroomUsd) {
      throw Object.assign(new Error(`headroom: only $${start.budget.remainingUsd.toFixed(3)} of the cap is left; not starting`), { code: 'headroom' });
    }
    let state = await step('add notes', () => (persona.sample ? api.act('startSample', { sampleId: persona.sample }) : api.act('notes', { text: persona.notes })));
    const notesId = state.result.id;
    state = await step('read the notes', () => api.run('read', { sourceId: notesId }), { retry: true });
    journey.extraction = { accepted: state.result.accepted?.length ?? 0, refused: state.result.refused ?? [], conflict: Boolean(state.result.conflict) };
    if (state.result.conflict) state = await explainConflict(state, state.result.questionId, 'notes');
    state = await step('confirm the facts', () => confirmProposed(state));
    state = await step('check what the form still needs', () => api.run('check'), { retry: true });
    journey.questions = state.workspace.application.questions.map(({ id, requirementId, text, status, askedBy, kind }) => ({ id, requirementId, text, status, askedBy, kind }));
    const open = openQuestions(state);
    const q = open.find((x) => x.requirementId === 'contribution' && persona.answerFor.contribution)
      ?? open.find((x) => persona.answerFor[x.requirementId]) ?? null;
    for (const other of open.filter((x) => x !== q)) { journey.skipped.push({ id: other.id, requirementId: other.requirementId, text: other.text }); state = await api.act('skip', { questionId: other.id }); }
    if (q) {
      const text = persona.answerFor[q.requirementId];
      journey.answered = { id: q.id, requirementId: q.requirementId, text: q.text, answer: text };
      state = await step('answer the question', () => api.act('answer', { questionId: q.id, text }));
      const answerId = state.result.source.id;
      state = await step('read the answer', () => api.run('read', { sourceId: answerId }), { retry: true });
      journey.answerExtraction = { accepted: state.result.accepted?.length ?? 0, refused: state.result.refused ?? [], conflict: Boolean(state.result.conflict) };
      if (state.result.conflict) state = await explainConflict(state, state.result.questionId, 'answer');
      state = await step('confirm the new facts', () => confirmProposed(state));
      state = await step('check again', () => api.run('check'), { retry: true });
      for (const other of openQuestions(state)) { journey.skipped.push({ id: other.id, requirementId: other.requirementId, text: other.text, late: true }); state = await api.act('skip', { questionId: other.id }); }
    } else {
      journey.answered = null;
      finding('no-question', { note: open.length ? `open questions had no prepared answer: ${open.map((x) => x.requirementId).join(', ')}` : 'the model asked nothing' });
    }
    state = await settleDecisions(state);
    journey.snapshots.facts = clone(state.workspace.applicant.facts);
    journey.snapshots.sources = clone(state.workspace.applicant.sources);
    journey.coverage = state.view.coverage.map(({ id, covered, factIds }) => ({ id, covered, factIds }));

    if (probe) {
      // Conflict-detection probe only: no drafts, so the note is read against the notes and the answer alone.
      state = await step('add the correcting note', () => api.act('notes', { text: correctionText }));
      const probeNoteId = state.result.id;
      state = await step('read the correcting note', () => api.run('read', { sourceId: probeNoteId }), { retry: true });
      const question = state.result.conflict ? state.workspace.application.questions.find((x) => x.id === state.result.questionId) : null;
      journey.probeResult = {
        conflict: Boolean(state.result.conflict),
        proposed: (state.result.accepted ?? []).map((id) => state.workspace.applicant.facts.find((f) => f.id === id)?.quote),
        refused: state.result.refused ?? [],
        question: question ? { text: question.text, priorSourceId: question.priorSourceId, priorQuote: question.priorQuote, quote: question.quote } : null,
        offer: state.view.sourceCorrections?.[0] ?? null,
      };
      if (!state.result.conflict) finding('conflict-missed', { note: `probe: no conflict; ${journey.probeResult.proposed.length} fact(s) proposed`, proposed: journey.probeResult.proposed });
      else finding('conflict-raised', { where: 'probe', note: `probe: conflict raised${journey.probeResult.offer ? ' with a Use-this-correction offer' : ' without an offer'}`, question: question?.text, priorQuote: question?.priorQuote });
      journey.completed = true;
      return journey;
    }

    state = await step('write both documents', () => api.run('draft'), { retry: true });
    journey.snapshots.drafted = clone(state.workspace.application.documents);
    journey.snapshots.draftStats = clone(state.view.stats);
    journey.dropped = state.result.dropped ?? [];
    const docs = () => state.workspace.application.documents;
    const confirmed = state.workspace.applicant.facts.filter((f) => f.status === 'confirmed');
    const citedIds = new Set(['answer', 'letter'].flatMap((d) => docs()[d].segments.flatMap((s) => s.factIds)));
    const target = confirmed.map((f) => ({ f, score: overlap(f.quote, persona.correction.anchor) + (citedIds.has(f.id) ? 1 : 0) })).sort((a, b) => b.score - a.score)[0]?.f ?? null;
    journey.intendedTargetId = target?.id ?? null;
    journey.intendedTarget = target ? { id: target.id, quote: target.quote, cited: citedIds.has(target.id) } : null;

    // The manual edit: the opening sentence of the answer unless it cites the fact the correction will overturn.
    const candidates = [...docs().answer.segments.map((s) => ({ docId: 'answer', s })), ...docs().letter.segments.map((s) => ({ docId: 'letter', s }))]
      .filter(({ s }) => s.kind === 'claim' && !(target && s.factIds.includes(target.id)));
    const chosen = candidates[0];
    if (!chosen) throw Object.assign(new Error('no claim sentence to edit that avoids the target fact'), { code: 'no-editable-sentence' });
    state = await step('edit a sentence by hand', () => api.act('edit', { docId: chosen.docId, segmentId: chosen.s.id, text: persona.manualSentence }));
    const manual = { docId: chosen.docId, segmentId: chosen.s.id, before: chosen.s.text, factIds: chosen.s.factIds, text: docs()[chosen.docId].segments.find((s) => s.id === chosen.s.id).text };
    journey.manual = manual;

    state = await step('approve the project answer', () => api.act('approve', { docId: 'answer', docRevision: docs().answer.revision }));
    state = await step('approve the cover letter', () => api.act('approve', { docId: 'letter', docRevision: docs().letter.revision }));
    journey.snapshots.approvalsAfterFirstApproval = clone(state.view.approvals);
    journey.snapshots.beforeCorrection = clone(docs());

    state = await step('add the correcting note', () => api.act('notes', { text: correctionText }));
    journey.snapshots.approvalsAfterNote = clone(state.view.approvals);
    const noteId = state.result.id;
    state = await step('read the correcting note', () => api.run('read', { sourceId: noteId }), { retry: true });
    journey.correctionExtraction = { accepted: state.result.accepted?.length ?? 0, refused: state.result.refused ?? [], conflict: Boolean(state.result.conflict) };
    if (state.result.conflict) {
      const question = state.workspace.application.questions.find((x) => x.id === state.result.questionId);
      journey.conflictQuestion = question ? { text: question.text, priorSourceId: question.priorSourceId, priorQuote: question.priorQuote, quote: question.quote } : null;
      const offer = state.view.sourceCorrections?.find((o) => o.questionId === state.result.questionId) ?? state.view.sourceCorrections?.[0] ?? null;
      if (offer) {
        journey.offer = offer;
        state = await step('choose the correction', () => api.act('resolveSourceConflict', { questionId: offer.questionId, sourceId: offer.sourceId, factId: offer.factId, text: offer.text }));
        journey.route = 'use-this-correction';
        journey.correctedFactId = offer.factId;
      } else {
        finding('no-correction-offer', { note: 'the conflict was raised but "Use this correction" was not offered (the earlier quote did not match exactly one confirmed fact)', priorQuote: question?.priorQuote });
        if (!target) throw Object.assign(new Error('no target fact for the direct correction'), { code: 'no-target' });
        state = await step('keep the earlier account (skip the conflict)', () => api.act('skip', { questionId: state.result.questionId }));
        state = await step('correct the fact directly', () => api.act('changeFact', { factId: target.id, text: correctionText }));
        journey.route = 'skip-then-correct-fact';
        journey.correctedFactId = target.id;
      }
    } else {
      finding('conflict-missed', { note: `the correcting note raised no conflict; ${state.result.accepted?.length ?? 0} fact(s) were proposed from it instead`, proposed: (state.result.accepted ?? []).map((id) => state.workspace.applicant.facts.find((f) => f.id === id)?.quote) });
      for (const id of state.result.accepted ?? []) state = await api.act('decideFact', { factId: id, decision: 'reject' });
      if (!target) throw Object.assign(new Error('no target fact for the direct correction'), { code: 'no-target' });
      state = await step('correct the fact directly', () => api.act('changeFact', { factId: target.id, text: correctionText }));
      journey.route = 'missed-then-correct-fact';
      journey.correctedFactId = target.id;
    }
    journey.correctedFact = clone(state.workspace.applicant.facts.find((f) => f.id === journey.correctedFactId));
    journey.snapshots.approvalsAfterCorrection = clone(state.view.approvals);

    const repair = state.workspace.application.repair;
    if (!repair) {
      finding('nothing-to-repair', { note: 'no sentence cited the corrected fact, so no repair was opened' });
      journey.repair = null;
    } else {
      journey.repairItemsBefore = clone(repair.items);
      state = await step('propose the changes', () => api.run('repair'), { retry: true });
      const items = state.workspace.application.repair.items;
      journey.repair = { items: clone(items), refused: state.result.refused ?? [] };
      const decisions = [];
      for (const item of items) {
        if (item.status === 'proposed') continue;
        let decision;
        if (item.status === 'conflict') {
          decision = item.segmentId === manual.segmentId ? 'keep' : (item.after ? 'take' : 'keep');
          if (item.segmentId === manual.segmentId) finding('manual-sentence-conflict', { note: 'the hand-edited sentence cited the corrected fact; kept it as written', after: item.after });
        } else {
          decision = 'keep';
          finding('needs-review', { note: `no usable rewrite for ${item.docId}/${item.segmentId}: ${item.reason ?? ''}`, before: item.before });
        }
        decisions.push({ itemId: item.id, segmentId: item.segmentId, status: item.status, decision });
      }
      journey.decisions = decisions;
      state = await step('decide what needs you', async () => {
        for (const d of decisions) state = await api.act('decideChange', { itemId: d.itemId, decision: d.decision });
        return state;
      });
      state = await step('apply the changes', () => api.act('applyChanges'));
      journey.applied = clone(state.result);
    }
    journey.snapshots.afterCorrection = clone(docs());
    journey.snapshots.afterStats = clone(state.view.stats);
    state = await step('approve the project answer again', () => api.act('approve', { docId: 'answer', docRevision: docs().answer.revision }));
    state = await step('approve the cover letter again', () => api.act('approve', { docId: 'letter', docRevision: docs().letter.revision }));
    journey.snapshots.approvalsAfterSecondApproval = clone(state.view.approvals);
    const pack = await step('export the pack', () => api.act('export'));
    journey.export = { status: pack.result.status, notice: pack.result.notice, documents: pack.result.documents.map(({ id, words, wordLimit, ownWords, notAnswered, text }) => ({ id, words, wordLimit, ownWords, notAnswered, text })) };
    journey.snapshots.final = clone(pack.workspace);
    journey.completed = true;
  } catch (e) {
    journey.abortedAt = e.stepName ?? null;
    journey.abortReason = errorOf(e);
    log(`   ABORTED at "${journey.abortedAt}": ${journey.abortReason.code}: ${journey.abortReason.message}`);
  } finally {
    try {
      const end = await receiptsNow();
      journey.budgetEnd = end.budget;
      journey.receipts = end.receipts.filter((r) => r.kind !== 'stage');
    } catch { /* best effort */ }
    journey.endedAt = new Date().toISOString();
    journey.invariants = checkInvariants(journey);
    journey.metrics = metricsOf(journey);
  }
  return journey;
}

// The nine checks. Each is { pass, evaluable, detail }.
function checkInvariants(j) {
  const out = {};
  const ws = j.snapshots.final ?? null;
  const docsFinal = ws?.application?.documents ?? j.snapshots.afterCorrection ?? null;
  const facts = ws?.applicant?.facts ?? j.snapshots.facts ?? [];
  const sources = ws?.applicant?.sources ?? j.snapshots.sources ?? [];
  const confirmed = facts.filter((f) => f.status === 'confirmed');
  const byId = new Map(facts.map((f) => [f.id, f]));
  const src = new Map(sources.map((s) => [s.id, s]));
  const role = normalise(ws?.application?.form?.role ?? '');
  const company = normalise(ws?.application?.form?.company ?? '');

  // (1) every confirmed fact's quote is word for word in the applicant's own text (its source; also any notes/answer/correction).
  {
    const bad = confirmed.filter((f) => !isVerbatim(f.quote, src.get(f.sourceId)?.text ?? ''));
    const badAnywhere = confirmed.filter((f) => !sources.some((s) => isVerbatim(f.quote, s.text)));
    out.quotesVerbatim = { pass: confirmed.length > 0 && bad.length === 0, evaluable: confirmed.length > 0, detail: { confirmed: confirmed.length, notInOwnSource: bad.map((f) => f.id), notInAnySource: badAnywhere.map((f) => f.id) } };
  }
  // (2) both documents within the form's limits (after draft and at export).
  {
    const stats = j.snapshots.afterStats ?? j.snapshots.draftStats ?? null;
    const draft = j.snapshots.draftStats ?? null;
    const over = stats ? ['answer', 'letter'].filter((d) => stats[d].overLimit) : [];
    const overDraft = draft ? ['answer', 'letter'].filter((d) => draft[d].overLimit) : [];
    out.withinLimits = { pass: Boolean(stats) && over.length === 0 && overDraft.length === 0, evaluable: Boolean(stats), detail: { atExport: stats && Object.fromEntries(['answer', 'letter'].map((d) => [d, `${stats[d].words}/${stats[d].wordLimit}`])), afterDraft: draft && Object.fromEntries(['answer', 'letter'].map((d) => [d, `${draft[d].words}/${draft[d].wordLimit}`])), over, overDraft } };
  }
  // (3) every citation points to a confirmed fact.
  {
    const segs = docsFinal ? ['answer', 'letter'].flatMap((d) => (docsFinal[d]?.segments ?? []).map((s) => ({ d, s }))) : [];
    const bad = segs.filter(({ s }) => s.factIds.some((id) => byId.get(id)?.status !== 'confirmed'));
    const uncited = segs.filter(({ s }) => s.kind === 'claim' && !s.factIds.length);
    out.citationsConfirmed = { pass: segs.length > 0 && bad.length === 0 && uncited.length === 0, evaluable: segs.length > 0, detail: { sentences: segs.length, badCitations: bad.map(({ d, s }) => `${d}/${s.id}`), uncitedClaims: uncited.map(({ d, s }) => `${d}/${s.id}`) } };
  }
  // (4) after the correction, only sentences that cited the corrected fact changed.
  {
    const before = j.snapshots.beforeCorrection; const after = j.snapshots.afterCorrection;
    if (before && after && j.correctedFactId) {
      const changed = []; const wrong = []; let structure = true;
      for (const d of ['answer', 'letter']) {
        const b = before[d].segments; const a = after[d].segments;
        if (b.length !== a.length || b.some((s, i) => s.id !== a[i].id)) structure = false;
        b.forEach((s, i) => {
          const t = a.find((x) => x.id === s.id);
          if (!t) return;
          if (t.text !== s.text) { changed.push(`${d}/${s.id}`); if (!s.factIds.includes(j.correctedFactId)) wrong.push(`${d}/${s.id}`); }
        });
      }
      out.onlyCitingSentencesChanged = { pass: structure && wrong.length === 0, evaluable: true, detail: { changed, changedWithoutCitingTheFact: wrong, sameStructure: structure, repairOpened: Boolean(j.repair) } };
    } else out.onlyCitingSentencesChanged = { pass: false, evaluable: false, detail: { reason: 'journey did not reach the correction' } };
  }
  // (5) the manual sentence is byte-identical before and after.
  {
    const m = j.manual; const after = j.snapshots.afterCorrection ?? docsFinal;
    if (m && after) {
      const seg = after[m.docId]?.segments.find((s) => s.id === m.segmentId);
      const fin = docsFinal?.[m.docId]?.segments.find((s) => s.id === m.segmentId);
      const same = seg?.text === m.text && (!fin || fin.text === m.text);
      out.manualSentenceIntact = { pass: Boolean(seg) && same && seg.author === 'user', evaluable: true, detail: { expected: m.text, afterCorrection: seg?.text ?? null, author: seg?.author ?? null, normalisedByApp: m.text !== normalise(m.text) ? false : m.text !== m.before } };
    } else out.manualSentenceIntact = { pass: false, evaluable: false, detail: { reason: 'no manual edit recorded' } };
  }
  // (6) approvals cleared by the correction and renewed after approval.
  {
    const a1 = j.snapshots.approvalsAfterFirstApproval; const a2 = j.snapshots.approvalsAfterNote; const a3 = j.snapshots.approvalsAfterSecondApproval;
    const approved = (a) => a && a.answer === 'approved' && a.letter === 'approved';
    const cleared = (a) => a && a.answer !== 'approved' && a.letter !== 'approved';
    out.approvalsClearedAndRenewed = { pass: approved(a1) && cleared(a2) && approved(a3), evaluable: Boolean(a1 && a2), detail: { afterFirstApproval: a1, afterCorrectingNote: a2, afterCorrection: j.snapshots.approvalsAfterCorrection, afterSecondApproval: a3 } };
  }
  // (7) the export says NOT SUBMITTED.
  out.exportNotSubmitted = { pass: j.export?.status === 'NOT SUBMITTED', evaluable: Boolean(j.export), detail: { status: j.export?.status ?? null } };
  // (8) no HTTP 5xx and no unhandled error (including streamed errors whose code maps to 5xx).
  {
    const http5xx = j.http.filter((h) => h.status >= 500).map((h) => `${h.method} ${h.path} ${h.status}`);
    const streamed = j.steps.flatMap((s) => [s.firstError, s.error].filter(Boolean).filter((e) => (e.httpStatus ?? 0) >= 500 || e.code === 'internal').map((e) => `${s.name}: ${e.code}`));
    const internal = [...j.http.filter((h) => h.error?.code === 'internal'), ...j.steps.filter((s) => s.error?.code === 'internal' || s.firstError?.code === 'internal')].length;
    out.noServerErrors = { pass: http5xx.length === 0 && streamed.length === 0 && internal === 0, evaluable: true, detail: { http5xx, streamed5xxClass: streamed, unhandled: internal } };
  }
  // (9) a number in a draft sentence that appears in none of its cited facts.
  {
    const segs = docsFinal ? ['answer', 'letter'].flatMap((d) => (docsFinal[d]?.segments ?? []).filter((s) => s.kind === 'claim' && s.author !== 'user').map((s) => ({ d, s }))) : [];
    const strip = (t) => { let x = normalise(t); if (role) x = x.replace(role, ' '); if (company) x = x.replaceAll(company, ' '); return x; };
    const flagged = [];
    for (const { d, s } of segs) {
      const inFacts = new Set(s.factIds.flatMap((id) => numbers(byId.get(id)?.quote ?? '')));
      const extra = numbers(strip(s.text)).filter((n) => !inFacts.has(n));
      if (extra.length) flagged.push({ sentence: `${d}/${s.id}`, text: s.text, numbers: extra, cited: s.factIds.map((id) => byId.get(id)?.quote) });
    }
    out.noUncitedNumbers = { pass: segs.length > 0 && flagged.length === 0, evaluable: segs.length > 0, detail: { checked: segs.length, flagged } };
  }
  return out;
}

function metricsOf(j) {
  const modelSteps = j.steps.filter((s) => s.receipts.length);
  const costs = j.steps.flatMap((s) => s.receipts.map((r) => r.costUsd));
  const unknown = costs.filter((c) => c === null).length;
  const sum = (xs) => xs.reduce((a, b) => a + (b ?? 0), 0);
  const usage = j.steps.flatMap((s) => s.receipts).reduce((acc, r) => ({ input: acc.input + (r.usage?.input ?? 0), cached: acc.cached + (r.usage?.cached ?? 0), output: acc.output + (r.usage?.output ?? 0), reasoning: acc.reasoning + (r.usage?.reasoning ?? 0) }), { input: 0, cached: 0, output: 0, reasoning: 0 });
  return {
    steps: j.steps.length, stepRetries: sum(j.steps.map((s) => s.retries)),
    providerAttempts: sum(j.steps.flatMap((s) => s.receipts.map((r) => r.attempts))), providerTurns: sum(j.steps.flatMap((s) => s.receipts.map((r) => r.turns))),
    toolCalls: sum(j.steps.flatMap((s) => s.receipts.map((r) => r.toolCalls))), receipts: j.steps.flatMap((s) => s.receipts).length, receiptErrors: j.steps.flatMap((s) => s.receipts).filter((r) => r.error).length,
    usage, costReceiptsUsd: sum(costs), costUnknownReceipts: unknown,
    costLedgerUsd: j.budgetStart && j.budgetEnd ? Number((j.budgetEnd.spentUsd - j.budgetStart.spentUsd).toFixed(6)) : null,
    wallMs: Date.parse(j.endedAt) - Date.parse(j.startedAt),
    modelStepMs: Object.fromEntries(modelSteps.map((s) => [s.name, s.ms])),
    medianModelStepMs: median(modelSteps.map((s) => s.ms)), worstModelStep: modelSteps.sort((a, b) => b.ms - a.ms)[0]?.name ?? null, worstModelStepMs: modelSteps[0]?.ms ?? null,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const host = args.host; const baseUrl = args.base;
  if (!host || !baseUrl) throw new Error('Pass --host <name> --base <url>.');
  const ids = String(args.personas ?? '').split(',').filter(Boolean);
  const personas = ids.map((id) => { if (!ALL[id]) throw new Error(`Unknown persona ${id}`); return ALL[id]; });
  const concurrency = Number(args.concurrency ?? 1);
  const headroomUsd = Number(args.headroom ?? 0);
  const probe = Boolean(args.probe); const plain = Boolean(args.plain);
  const suffix = `${plain ? '-plain' : ''}${probe ? '-probe' : ''}`;
  const outDir = join(ROOT, 'runs', host);
  mkdirSync(outDir, { recursive: true });
  const log = (id) => (line) => console.log(`[${host}/${id}${suffix}] ${line}`);
  const results = [];
  let stop = null;
  const queue = [...personas];
  const worker = async () => {
    while (queue.length && !stop) {
      const persona = queue.shift();
      const j = await runJourney({ host, baseUrl, persona, headroomUsd, log: log(persona.id), probe, plain });
      results.push(j);
      writeFileSync(join(outDir, `${persona.id}${suffix}.json`), JSON.stringify(j, null, 2));
      if (j.abortReason && ['cap', 'headroom', 'billing', 'auth'].includes(j.abortReason.code)) { stop = j.abortReason; console.log(`[${host}] STOP: ${stop.code}: ${stop.message}`); }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
  const summary = summarise(host, results, personas, queue, stop);
  writeFileSync(join(outDir, `summary${suffix}.json`), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary.table, null, 2));
}

function summarise(host, results, personas, notStarted, stop) {
  const keys = ['quotesVerbatim', 'withinLimits', 'citationsConfirmed', 'onlyCitingSentencesChanged', 'manualSentenceIntact', 'approvalsClearedAndRenewed', 'exportNotSubmitted', 'noServerErrors', 'noUncitedNumbers'];
  const invariants = Object.fromEntries(keys.map((k) => [k, { pass: results.filter((r) => r.invariants[k].pass).length, evaluable: results.filter((r) => r.invariants[k].evaluable).length }]));
  const modelSteps = results.flatMap((r) => r.steps.filter((s) => s.receipts.length));
  const worst = [...modelSteps].sort((a, b) => b.ms - a.ms)[0];
  const costs = results.map((r) => r.metrics.costLedgerUsd).filter((c) => c !== null);
  return {
    host, attempted: results.length, completed: results.filter((r) => r.completed).length, notStarted: notStarted.map((p) => p.id), stoppedBecause: stop,
    invariants, medianModelStepMs: median(modelSteps.map((s) => s.ms)), worstModelStep: worst ? { persona: results.find((r) => r.steps.includes(worst))?.persona, name: worst.name, ms: worst.ms } : null,
    costPerJourneyUsd: costs.length ? { median: median(costs), min: Math.min(...costs), max: Math.max(...costs), total: Number(costs.reduce((a, b) => a + b, 0).toFixed(6)) } : null,
    routes: Object.fromEntries(results.map((r) => [r.persona, r.route])),
    aborted: results.filter((r) => !r.completed).map((r) => ({ persona: r.persona, at: r.abortedAt, error: r.abortReason })),
    findings: results.flatMap((r) => r.findings.map((f) => ({ persona: r.persona, ...f }))),
    table: results.map((r) => ({ persona: r.persona, completed: r.completed, route: r.route, invariantsPassed: keys.filter((k) => r.invariants[k].pass).length, retries: r.metrics.stepRetries, attempts: r.metrics.providerAttempts, tools: r.metrics.toolCalls, costUsd: r.metrics.costLedgerUsd, wallMs: r.metrics.wallMs })),
  };
}

await main();
