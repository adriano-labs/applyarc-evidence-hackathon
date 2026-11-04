// The evidence trail: numbered runs of plain sentences, built only from the
// receipts, the loop's recorded decisions and the saved workspace. Nothing here
// infers who did what from styling, and no row is a thought or a guess.
import { formatMs, formatUsd, modelSteps, summariseReceipts } from './format.js';

const GAP_MS = 10 * 60 * 1000;
const STEP_FLOW = { extract: 'read', clarify: 'check', draft: 'draft', review: 'draft', revise: 'draft', repair: 'repair', transcribe: 'voice', strengthen: 'strengthen' };
const DOC = { answer: 'Project answer', letter: 'Cover letter' };
const TITLES = { read: 'Read your words', check: 'Checked the form', draft: 'Wrote both documents', repair: 'Proposed changes after your correction', strengthen: 'Looked for a stronger sentence', voice: 'Heard your words' };

export const isStage = (row) => row?.kind === 'stage';
const stepOf = (row) => String(row?.step ?? '');
const docOf = (row) => row?.docId ?? (stepOf(row).startsWith('draft-') ? stepOf(row).slice(6) : null);
export const flowOf = (row) => row?.flow ?? STEP_FLOW[stepOf(row).startsWith('draft') ? 'draft' : stepOf(row)] ?? null;
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// The documents' titles from the form (Marcus's answer is "Why this role"), with the usual names without one.
export const docTitles = (workspace) => ({ ...DOC, ...Object.fromEntries((workspace?.application?.form?.documents ?? []).filter((d) => d?.id && d.title).map((d) => [d.id, d.title])) });

// Which Meta model a receipt ran on: a short tag for the row and a name for prose.
export function family(model, isMeta = true) {
  const m = String(model ?? '');
  if (/muse-wonder/i.test(m)) return { tag: 'Wonder', name: 'Muse Wonder' };
  if (/muse-spark-open/i.test(m)) return { tag: 'Spark Open', name: 'Muse Spark Open' };
  if (/muse-spark/i.test(m)) return { tag: 'Spark', name: 'Muse Spark' };
  if (/muse-voice/i.test(m)) return { tag: 'Voice', name: 'Muse Voice Transcribe' };
  return isMeta && m ? { tag: 'Meta', name: m } : { tag: 'Model', name: m || 'The model' };
}

export const actorOf = (receipt) => (receipt?.provider === 'fixture' ? 'Fixture' : family(receipt?.model, receipt?.isMeta).tag);

export function formatAudio(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return null;
  const s = Math.max(1, Math.round(ms / 1000));
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
}

// Consecutive rows of one flow make a run; a pause over ten minutes starts another.
export function groupRuns(receipts = []) {
  const runs = [];
  for (const row of receipts) {
    if (!row) continue;
    const flow = flowOf(row);
    const at = Date.parse(row.at);
    const last = runs.at(-1);
    const gap = last && Number.isFinite(at) && Number.isFinite(last.endAt) ? at - last.endAt : 0;
    if (last && last.flow === flow && gap <= GAP_MS) last.rows.push(row);
    else runs.push({ flow, rows: [row], endAt: null });
    if (Number.isFinite(at)) runs.at(-1).endAt = at;
  }
  return runs.map(({ flow, rows }, i) => ({ n: i + 1, flow, rows, ...totals(rows) }));
}

function totals(rows) {
  const receipts = modelSteps(rows);
  let totalMs = 0; let costUsd = 0; let timed = false; let costComplete = true; let failed = false;
  for (const r of receipts) {
    if (typeof r.totalMs === 'number') { totalMs += r.totalMs; timed = true; }
    if (typeof r.costUsd === 'number') costUsd += r.costUsd; else costComplete = false;
    if (r.error) failed = true;
  }
  const host = receipts.find((r) => r.host)?.host ?? null;
  return { receipts, totalMs, timed, costUsd: Math.round(costUsd * 1e6) / 1e6, costComplete, failed, host };
}

// The k-th read run read the k-th source the applicant gave (corrections are never read).
// A prepared workspace's saved sources were read before this visit, so they have no run here.
export function readSource(workspace, k) {
  const since = workspace?.prepared?.loadedAt ?? '';
  return (workspace?.applicant?.sources ?? []).filter((s) => s?.kind !== 'correction' && (!since || (s.at ?? '') >= since))[k] ?? null;
}

export function runTitle(flow, source = null) {
  if (flow === 'read' && source?.kind === 'notes') return 'Read your notes';
  if (flow === 'read' && source?.kind === 'answer') return 'Read your answer';
  return TITLES[flow] ?? 'Model steps';
}

// A run finished unless its last step failed. A draft saves both documents or nothing, so a draft
// run with a failure in it finished only if it is the latest one and both documents are saved.
function finished(run, runs, workspace) {
  if (run.receipts.at(-1)?.error) return false;
  if (!run.failed || run.flow !== 'draft') return true;
  return run === runs.findLast((r) => r.flow === 'draft') && Object.keys(DOC).every((id) => workspace?.application?.documents?.[id]);
}

// Each run with its title and the applicant decisions that close it, read from saved state.
export function trailRuns(receipts, workspace, view) {
  const runs = groupRuns(receipts);
  const lastDocRun = runs.findLast((r) => r.flow === 'draft' || r.flow === 'repair');
  const lastRepairRun = runs.findLast((r) => r.flow === 'repair');
  const askRun = runs.find((r) => r.flow === 'check' && r.receipts.length);
  let readIndex = 0;
  return runs.map((run) => {
    const source = run.flow === 'read' && run.receipts.some((r) => !r.error) ? readSource(workspace, readIndex++) : null;
    const flags = { flow: run.flow, source, lastDocRun: run === lastDocRun, lastRepairRun: run === lastRepairRun, askRun: run === askRun, endAt: run.rows.at(-1)?.at ?? '' };
    return { run, title: finished(run, runs, workspace) ? runTitle(run.flow, source) : 'Did not finish', decisions: decisionRows(flags, workspace, view) };
  });
}

export function stepSentence(receipt, titles = DOC) {
  const step = stepOf(receipt);
  const flow = flowOf(receipt);
  if (step === 'extract') return 'Read your words';
  if (step === 'clarify') return 'Compared your facts with what the form asks for';
  if (step.startsWith('draft')) return titles[docOf(receipt)] ? `Drafted “${titles[docOf(receipt)]}”` : 'Drafted a document';
  if (step === 'review') return flow === 'repair' ? 'Reviewed the proposed sentences against the facts they cite' : flow === 'strengthen' ? 'Reviewed the suggestion against the facts it cites' : 'Reviewed the cited sentences against their facts';
  if (step === 'revise') return 'Rewrote only the sentences the check refused';
  if (step === 'repair') return 'Proposed new wording for the sentences that cite the corrected fact';
  if (step === 'transcribe') return formatAudio(receipt?.audioMs) ? `Turned ${formatAudio(receipt.audioMs)} of speech into text` : 'Turned your speech into text';
  if (step === 'strengthen') return 'Looked for a stronger sentence your facts support';
  return step;
}

// What the app's own tools found, one sentence per kind of check, in the order they were first called.
export function codeRows(toolCalls = []) {
  const calls = Array.isArray(toolCalls) ? toolCalls.filter((t) => t?.name) : [];
  const first = (name) => calls.findIndex((t) => t.name === name);
  const quotes = calls.filter((t) => t.name === 'verify_quote');
  const ok = quotes.filter((t) => t.note === 'verbatim').length;
  const words = calls.filter((t) => t.name === 'word_count').map((t) => t.note).filter(Boolean);
  const rows = [];
  if (first('form_requirements') >= 0) rows.push([first('form_requirements'), 'Read the form']);
  if (quotes.length) rows.push([first('verify_quote'), `Checked ${plural(quotes.length, 'quote', 'quotes')} against your words: ${ok} word for word${quotes.length - ok ? ` · ${quotes.length - ok} not word for word` : ''}`]);
  if (words.length) rows.push([first('word_count'), `Counted the words: ${words.join(' · ')}`]);
  return rows.sort((a, b) => a[0] - b[0]).map(([, text]) => text);
}

// `form_requirements: read ×1 · verify_quote: verbatim ×12`, for the row's details.
export function toolTally(toolCalls = []) {
  const counts = new Map();
  for (const t of Array.isArray(toolCalls) ? toolCalls : []) {
    if (!t?.name) continue;
    const key = `${t.name}: ${t.note ?? ''}`.trim();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].map(([key, n]) => `${key} ×${n}`).join(' · ');
}

// The live tally while a step runs, from the tool events streamed so far.
export function tallyLine(toolCounts) {
  if (!toolCounts) return null;
  const quotes = toolCounts.verify_quote ?? 0;
  const ok = toolCounts.verbatim ?? 0;
  const parts = [];
  if (quotes) parts.push(ok === quotes ? `Checked ${plural(quotes, 'quote', 'quotes')} word for word so far` : `Checked ${quotes} quotes against your words: ${ok} word for word so far`);
  if (toolCounts.words) parts.push(`Counted the words: ${toolCounts.words}`);
  if (toolCounts.form_requirements) parts.push('Read the form');
  return parts.length ? parts.join(' · ') : null;
}

export function approvalRow(workspace, view) {
  const docs = workspace?.application?.form?.documents ?? [];
  const approved = docs.filter((d) => view?.approvals?.[d.id] === 'approved').map((d) => ({ title: d.title || DOC[d.id] || d.id, revision: workspace?.application?.documents?.[d.id]?.revision }));
  if (!approved.length) return null;
  if (approved.length === docs.length && docs.length > 1 && approved.every((d) => d.revision === approved[0].revision)) return `You approved version ${approved[0].revision} of both documents`;
  return `You approved ${approved.map((d) => `version ${d.revision} of “${d.title}”`).join(' and ')}`;
}

// The applicant's decisions, read from saved state (they are state, not timestamped events).
export function decisionRows({ flow, source = null, lastDocRun = false, lastRepairRun = false, askRun = false, endAt = '' }, workspace, view) {
  const rows = [];
  if (flow === 'read' && source) {
    // A corrected fact moves to its correction's source; its first history entry keeps where it was read.
    const n = (workspace?.applicant?.facts ?? []).filter((f) => (f?.history?.[0]?.sourceId ?? f?.sourceId) === source.id && f.status === 'confirmed').length;
    if (n) rows.push(`You confirmed ${plural(n, 'fact', 'facts')}`);
  }
  if (flow === 'check' && askRun) {
    // The first check asked the questions. A source conflict is settled by a correction, not an answer.
    const questions = (workspace?.application?.questions ?? []).filter((q) => q?.kind !== 'source-conflict');
    const answered = questions.filter((q) => q?.status === 'answered').length;
    const skipped = questions.filter((q) => q?.status === 'skipped').length;
    if (answered) rows.push(answered === 1 ? 'You answered the question' : `You answered ${answered} questions`);
    if (skipped) rows.push(skipped === 1 ? 'You skipped the question' : `You skipped ${skipped} questions`);
  }
  // The last apply counts only for the run it followed: an undone or still-open repair applied nothing.
  const last = workspace?.application?.lastRepair;
  if (flow === 'repair' && lastRepairRun && typeof last?.changed === 'number' && last.at >= endAt) {
    rows.push(`You applied ${plural(last.changed, 'change', 'changes')}`);
  }
  if ((flow === 'draft' || flow === 'repair') && lastDocRun) {
    const approval = approvalRow(workspace, view);
    if (approval) rows.push(approval);
  }
  return rows;
}

// What drafted the documents, for copy that names it: the family of the latest draft step.
export function drafter(receipts = []) {
  const step = modelSteps(receipts).findLast((r) => stepOf(r).startsWith('draft'));
  if (!step) return null;
  return step.provider === 'fixture' ? 'The fixture' : family(step.model, step.isMeta).tag.replace(/^Model$/, 'The model');
}

// Who proposed the repair wording, and whether the same model reviewed the proposals.
export function repairProvenance(receipts = []) {
  const rows = modelSteps(receipts);
  const repair = rows.findLast((r) => r.step === 'repair' && r.provider !== 'fixture');
  if (!repair) return null;
  const reviewed = rows.some((r) => r.step === 'review' && flowOf(r) === 'repair');
  return `Proposed by ${family(repair.model, repair.isMeta).name}${reviewed ? ', then reviewed by the same model against the facts each sentence cites' : ''}`;
}

// The run header's right-hand figures: summed model time (when timed) and the run's cost.
export function runFigures(run) {
  return [run.timed ? formatMs(run.totalMs) : null, run.costComplete ? formatUsd(run.costUsd) : 'cost not settled'].filter(Boolean).join(' · ');
}

// The closed drawer's one line: models, runs, steps, tool calls, model time and cost, and what is not settled.
export function summaryLine(rows, runCount) {
  const steps = modelSteps(rows);
  // Attempts that may have run and stay counted at their worst case, plus steps whose cost is unknown.
  const notSettled = steps.reduce((n, r) => n + (r?.unsettled || (r?.costUsd == null ? 1 : 0)), 0);
  if (!steps.length) return { line: 'No model calls yet', notSettled };
  const summary = summariseReceipts(rows);
  // Summed per-step model time; a fixture step has none, so the line says nothing about time.
  const time = steps.some((r) => typeof r.totalMs === 'number') ? ` · ${formatMs(summary.totalMs)} total model time` : '';
  const line = `${summary.models.join(', ')} · ${plural(runCount, 'run', 'runs')} · ${plural(summary.steps, 'step', 'steps')} · ${plural(summary.toolCalls, 'tool call', 'tool calls')}${time} · ${formatUsd(summary.costUsd)}`;
  return { line: notSettled > 0 ? `${line} + ${notSettled} not settled` : line, notSettled };
}
