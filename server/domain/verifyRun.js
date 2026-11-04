// Verify this run: the saved workspace re-checked by code, with no model call. Each check reuses
// the rule that admitted the record and returns whether it holds, how many items it checked and
// the first few fact, sentence or export ids where it does not.
import { checkContext, citedFacts, statesNewNumber } from './claims.js';
import { buildExport, NOT_SUBMITTED } from './exportPack.js';
import { approvalState } from './review.js';
import { isVerbatim } from './text.js';
import { confirmedFacts, DOC_IDS, findSource } from './workspace.js';

// The loop's recorded decision each time the review held sentences back for one rewrite.
const HELD_BACK = /^Revising (\d+) unsupported/;
// A model step that wrote document wording; the fixture is hand-written, not a model.
const wroteLive = (r) => /^(draft|repair|strengthen)/.test(r.step ?? '') && r.provider !== 'fixture';
const outcome = (id, bad, count, text) => ({ id, pass: !bad.length, count, failures: bad.slice(0, 3).map((x) => x.id), text });

// empty: what the row says when there is nothing to check (by default "No … yet").
function check(id, items, fails, noun, rule, empty = `No ${noun} yet`) {
  const bad = items.filter(fails);
  return outcome(id, bad, items.length, items.length ? `${items.length - bad.length} of ${items.length} ${noun} ${rule}` : empty);
}

// The latest export, rebuilt from the saved state by the export's own code.
function exportCheck(ws) {
  const last = ws.application.exports.at(-1);
  if (!last) return outcome('export', [], 0, 'No export yet: open the application, then verify again');
  let pack = null;
  try { pack = buildExport(structuredClone(ws), last.at); } catch { /* something changed after the export */ }
  const holds = pack?.status === NOT_SUBMITTED && pack.documents.every((d) => d.revision === last.revisions[d.id]);
  return outcome('export', holds ? [] : [last], ws.application.exports.length, `Export ${last.id} ${holds ? `is stamped ${NOT_SUBMITTED} and holds` : 'does not hold'} exactly the approved versions`);
}

// The code saves a model-written statement only on a supported verdict, so the review on record is the
// statements a live model wrote, plus the sentences the loop recorded it held back.
function reviewCheck(ws, drafted, records) {
  const live = Boolean(ws.prepared) || records.some(wroteLive);
  const reviewed = Boolean(ws.prepared) || records.some((r) => r.step === 'review' && !r.error);
  const heldBack = records.reduce((n, r) => n + (Number(HELD_BACK.exec(r.label ?? '')?.[1]) || 0), 0);
  if (!live) return outcome('review', [], 0, 'No model review on record: no live model has written document wording');
  if (!reviewed) return outcome('review', drafted, 0, `No model review on record for ${drafted.length} model-written statements`);
  return outcome('review', [], drafted.length, `Model review on record: ${drafted.length} cited sentences supported, ${heldBack} held back${ws.prepared ? ' in this visit' : ''}`);
}

// records: this workspace's receipts and the loop's recorded decisions, as saved.
export function verifyRun(ws, records = []) {
  const who = ws.applicant.name ? `${ws.applicant.name}’s` : 'the applicant’s';
  const facts = confirmedFacts(ws);
  const confirmed = new Map(facts.map((f) => [f.id, f]));
  const segments = DOC_IDS.flatMap((id) => ws.application.documents[id]?.segments ?? []);
  // The applicant's own sentences are counted apart, as the manuscript head counts them.
  const drafted = segments.filter((s) => s.kind === 'claim' && s.author !== 'user');
  const repairItems = ws.application.repair?.items ?? [];
  const { roleTitle } = checkContext(ws);
  return [
    check('quotes', facts, (f) => !isVerbatim(f.quote, findSource(ws, f.sourceId)?.text), 'confirmed facts', `quote ${who} text word for word`),
    check('citations', drafted, (s) => !s.factIds.length || s.factIds.some((id) => !confirmed.has(id)), 'drafted statements', 'cite at least one fact, all confirmed'),
    check('numbers', drafted, (s) => statesNewNumber(s.text, citedFacts(ws, s.factIds, confirmed), roleTitle), 'drafted statements', 'state no number their cited facts do not'),
    check('approvals', DOC_IDS.filter((id) => ws.application.approvals[id]).map((id) => ({ id })), ({ id }) => approvalState(ws, id) !== 'approved', 'approvals', 'match the current version'),
    // A correction must ask before touching one: an open repair holds each as a conflict, its wording unchanged.
    check('own', segments.filter((s) => s.author === 'user'), (s) => repairItems.some((i) => i.segmentId === s.id && (i.status !== 'conflict' || i.before !== s.text)), `sentences marked as ${who} own`, 'are untouched by the model', `No sentences in ${who} own wording (none to check)`),
    exportCheck(ws),
    reviewCheck(ws, drafted, records),
  ];
}
