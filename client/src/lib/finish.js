// "What just happened", for the finish of the walk-through: short lines built only from the
// saved workspace and the receipts the client already holds. No number appears unless they hold it.
import { formatMs, formatUsd, modelSteps, summariseReceipts } from './format.js';
import { preparedBy } from './prepared.js';
import { approvalRow, family, isStage, plural } from './trail.js';

// On a prepared workspace: where the facts and drafts came from, and what ran live in this visit,
// on the model this visit's steps ran on (a voice call aside).
function preparedLine(ws, rows) {
  if (!ws?.prepared) return null;
  const live = ws.application?.lastRepair ? '; the correction and the repair ran live now' : '';
  const host = modelSteps(rows).find((r) => r.step !== 'transcribe' && r.model)?.model;
  return `Those facts and both drafts were ${preparedBy(ws.prepared, host)}, before this visit${live}.`;
}

// Facts in another language: each English meaning is a working translation the applicant confirmed.
function meaningLine(ws) {
  if (!(ws?.applicant?.facts ?? []).some((f) => f?.status === 'confirmed' && f.language)) return null;
  return `Each English meaning is a working translation ${ws.applicant.name ?? 'you'} confirmed.`;
}

// Sentences the evidence check refused and sent back for rewriting, from the loop's recorded decisions.
export function refusedCount(rows = []) {
  return rows.filter(isStage).reduce((n, row) => n + (Number(/^Revising (\d+) unsupported/.exec(row.label ?? '')?.[1]) || 0), 0);
}

function correctionLine(ws) {
  const last = ws?.application?.lastRepair;
  if (!last) return null;
  const held = typeof last.reopened === 'number' && typeof last.untouched === 'number';
  return `1 fact corrected${held ? `: it reopened ${plural(last.reopened, 'sentence', 'sentences')} and left ${last.untouched} untouched` : ''}.`;
}

// The model steps as the receipts record them. The fixture is named as the fixture, never as a model,
// and time is model time: no step records how long a person took.
function workLine(rows) {
  const steps = modelSteps(rows);
  if (!steps.length) return null;
  const s = summariseReceipts(rows);
  const fixture = steps.every((r) => r.provider === 'fixture');
  const who = fixture ? 'The fixture (hand-written, not a model)' : steps.some((r) => r.isMeta) ? 'Meta' : 'The model';
  const time = steps.some((r) => typeof r.totalMs === 'number') ? `, ${formatMs(s.totalMs)} total model time` : '';
  const cost = !s.costComplete ? 'cost not settled' : fixture ? formatUsd(s.costUsd) : `${formatUsd(s.costUsd)} estimated`;
  return `${who}: ${plural(s.steps, fixture ? 'step' : 'model step', fixture ? 'steps' : 'model steps')}, ${plural(s.toolCalls, 'tool call', 'tool calls')}${time}, ${cost}.`;
}

function refusedLine(rows) {
  const n = refusedCount(rows);
  if (!n) return null;
  const rewrite = modelSteps(rows).findLast((r) => r.step === 'revise' && !r.error);
  const who = rewrite ? family(rewrite.model, rewrite.isMeta).tag.replace(/^Model$/, 'the model') : null;
  return `${who ? `${who}’s own review` : 'The model review'} refused ${plural(n, 'sentence', 'sentences')}${who ? ` and sent ${n === 1 ? 'it' : 'them'} back to ${who} to rewrite` : ''}.`;
}

export function happenedLines(ws, view, receipts = []) {
  const rows = Array.isArray(receipts) ? receipts : [];
  const confirmed = (ws?.applicant?.facts ?? []).filter((f) => f?.status === 'confirmed').length;
  const approved = approvalRow(ws, view);
  return [
    `${plural(confirmed, 'fact', 'facts')} confirmed.`,
    meaningLine(ws),
    preparedLine(ws, rows),
    approved ? `${approved}.` : null,
    correctionLine(ws),
    workLine(rows),
    refusedLine(rows),
    'Nothing has been sent.',
  ].filter(Boolean);
}
