import { describe, expect, it, vi } from 'vitest';
import { draftBlockers } from '../server/domain/documents.js';
import { decideFact, proposeFacts } from '../server/domain/facts.js';
import { addSource } from '../server/domain/workspace.js';
import { actions, agentActions } from '../server/flows.js';
import { nextStep } from '../server/domain/progress.js';
import { approve } from '../server/domain/review.js';
import { exportBlockers } from '../server/domain/exportPack.js';
import { currentSourceText } from '../server/domain/sourceConflicts.js';
import { viewOf } from '../server/view.js';
import { draftedWorkspace, workspaceWithNotes } from './helpers.js';

// Seen in set 4 (hotel to service desk): the applicant answered the conflict
// question, the narrower answer was confirmed, and the earlier broader fact
// stayed confirmed beside it, so the draft used both.
const notes = 'I restored the booking server myself when it went down on a Saturday night.';
const prior = 'I restored the booking server myself';

function answeredConflict() {
  const { ws, source } = workspaceWithNotes(notes);
  proposeFacts(ws, source.id, [{ statement: 'Restored the booking server.', quote: prior, requirementIds: ['contribution'] }]);
  decideFact(ws, 'f1', 'confirm');
  const answer = addSource(ws, { kind: 'answer', text: 'I followed the helpdesk instructions while they restored it.', now: '2026-10-30T10:00:00.000Z' });
  answer.read = true;
  ws.application.questions.push({
    id: 'q1', kind: 'source-conflict', status: 'answered', text: 'Did you restore the server yourself, or follow the helpdesk?',
    conflictSourceId: 's9', priorSourceId: source.id, quote: 'I followed the helpdesk instructions', priorQuote: prior, sourceId: answer.id,
  });
  return ws;
}

describe('an answered conflict makes the earlier fact an explicit decision', () => {
  it('holds drafting until the applicant decides on the earlier fact, and changes nothing by itself', () => {
    const ws = answeredConflict();
    const blockers = draftBlockers(ws);
    expect(blockers.some((b) => b.includes(prior))).toBe(true);
    expect(ws.applicant.facts[0]).toMatchObject({ id: 'f1', status: 'confirmed', quote: prior });
  });

  it('makes the decision the next step until it is made', () => {
    const ws = answeredConflict();
    ws.applicant.sources[0].read = true;
    expect(nextStep(ws)).toBe('decide');
    actions.settleConflict(ws, { questionId: 'q1', decision: 'keep' });
    expect(nextStep(ws)).not.toBe('decide');
  });

  it('keep: the fact stays exactly as it was and drafting may go on', () => {
    const ws = answeredConflict();
    actions.settleConflict(ws, { questionId: 'q1', decision: 'keep' });
    expect(ws.applicant.facts[0]).toMatchObject({ status: 'confirmed', quote: prior });
    expect(draftBlockers(ws).some((b) => b.includes(prior))).toBe(false);
  });

  it('remove: the earlier fact no longer counts and drafting may go on', () => {
    const ws = answeredConflict();
    actions.settleConflict(ws, { questionId: 'q1', decision: 'remove' });
    expect(ws.applicant.facts[0].status).not.toBe('confirmed');
    expect(draftBlockers(ws).some((b) => b.includes(prior))).toBe(false);
  });

  it('correcting the earlier fact also settles it', () => {
    const ws = answeredConflict();
    actions.changeFact(ws, { factId: 'f1', text: 'I followed the helpdesk instructions while they restored the booking server.' });
    expect(draftBlockers(ws).some((b) => b.includes(prior))).toBe(false);
  });

  it('refuses any other decision', () => {
    const ws = answeredConflict();
    expect(() => actions.settleConflict(ws, { questionId: 'q1', decision: 'replace' })).toThrow();
  });

  it('ends the blocker with one full stop when the quote already has one', () => {
    const ws = answeredConflict();
    ws.applicant.facts[0].quote = `${prior}.`;
    expect(draftBlockers(ws)).toContain(`Check the earlier fact your answer was about: “${prior}.” Keep it, correct it or remove it.`);
  });

  it('asks nothing when the earlier quote matches no confirmed fact', () => {
    const ws = answeredConflict();
    ws.application.questions[0].priorQuote = 'went down on a Saturday night';
    expect(draftBlockers(ws).some((b) => b.includes('went down'))).toBe(false);
  });
});

// Seen in review: the earlier quote spanned two facts when the notes were split, and
// only the first was asked about; the second stayed confirmed with no decision.
describe('every earlier fact the conflict covers gets its own decision', () => {
  const rota = 'I created the weekend rota and decided which colleagues covered each shift.';
  function split() {
    const { ws, source } = workspaceWithNotes(rota);
    proposeFacts(ws, source.id, ['I created the weekend rota', 'decided which colleagues covered each shift.'].map((quote) => ({ statement: quote, quote, requirementIds: ['contribution'] })));
    for (const f of ws.applicant.facts) decideFact(ws, f.id, 'confirm');
    const answer = addSource(ws, { kind: 'answer', text: 'My manager made the rota; I only swapped two shifts.', now: '2026-10-30T10:00:00.000Z' });
    answer.read = true;
    ws.application.questions.push({ id: 'q1', kind: 'source-conflict', status: 'answered', text: 'Did you make the rota?', priorSourceId: source.id, priorQuote: rota, quote: 'My manager made the rota', sourceId: answer.id });
    return { ws, source };
  }

  it('asks about each fact and waits until both are decided', () => {
    const { ws } = split();
    expect(viewOf(ws).conflictDecisions.map((d) => d.factId)).toEqual(['f1', 'f2']);
    actions.settleConflict(ws, { questionId: 'q1', factId: 'f1', decision: 'keep' });
    expect(draftBlockers(ws).some((b) => b.includes('decided which colleagues'))).toBe(true);
    actions.settleConflict(ws, { questionId: 'q1', factId: 'f2', decision: 'remove' });
    expect(draftBlockers(ws)).toEqual([]);
    expect(ws.applicant.facts.map((f) => f.status)).toEqual(['confirmed', 'rejected']);
  });

  it('asks which fact when more than one waits', () => {
    const { ws } = split();
    expect(() => actions.settleConflict(ws, { questionId: 'q1', decision: 'remove' })).toThrow(/which earlier fact/);
  });

  it('takes a removed fact out of the evidence the review reads', () => {
    const { ws, source } = split();
    actions.settleConflict(ws, { questionId: 'q1', factId: 'f1', decision: 'remove' });
    expect(currentSourceText(ws, source)).toBe('[Removed by the applicant] and decided which colleagues covered each shift.');
  });
});

describe('a decision that waits after drafting', () => {
  async function drafted() {
    const ws = await draftedWorkspace();
    const notes = ws.applicant.sources[0];
    const answer = addSource(ws, { kind: 'answer', text: 'Sam wrote the Helm change.', now: '2026-10-30T10:00:00.000Z' });
    answer.read = true;
    ws.application.questions.push({ id: 'q9', kind: 'source-conflict', status: 'answered', text: 'Who wrote the Helm change?', priorSourceId: notes.id,
      priorQuote: 'I wrote the Helm change that fixed it.', quote: 'Sam wrote the Helm change', sourceId: answer.id });
    return ws;
  }

  it('holds approval and export until it is decided', async () => {
    const ws = await drafted();
    expect(() => approve(ws, 'answer', 1)).toThrow(/earlier fact your answer was about/);
    expect(exportBlockers(ws)[0]).toMatch(/earlier fact your answer was about/);
    actions.settleConflict(ws, { questionId: 'q9', decision: 'keep' });
    expect(() => approve(ws, 'answer', 1)).not.toThrow();
  });

  it('refuses to remove a fact the drafts cite, and offers no Remove for it', async () => {
    const ws = await drafted();
    expect(viewOf(ws).conflictDecisions[0]).toMatchObject({ factId: 'f3', cited: true });
    expect(() => actions.settleConflict(ws, { questionId: 'q9', decision: 'remove' })).toThrow(/Correct it instead/);
    expect(ws.applicant.facts[2].status).toBe('confirmed');
  });
});

// Seen in re-review: while a decision waited, correcting another fact started a repair
// the server refused, and the repair queue hid the decision, so the user was stuck.
describe('a waiting decision never blocks a correction', () => {
  it('lets the repair of another fact run, and says Keep or correct for a cited fact', async () => {
    const ws = await draftedWorkspace();
    const answer = addSource(ws, { kind: 'answer', text: 'Sam wrote the Helm change.', now: '2026-10-30T10:00:00.000Z' });
    answer.read = true;
    ws.application.questions.push({ id: 'q9', kind: 'source-conflict', status: 'answered', text: 'Who wrote the Helm change?', priorSourceId: ws.applicant.sources[0].id,
      priorQuote: 'I wrote the Helm change that fixed it.', quote: 'Sam wrote the Helm change', sourceId: answer.id });
    expect(draftBlockers(ws).at(-1)).toMatch(/Keep it or correct it\.$/);
    actions.changeFact(ws, { factId: 'f2', text: 'The default /dev/shm in the pods was 64 MB, far too small for the jobs.' });
    const agent = { provider: { id: 'test-double' }, repair: vi.fn(async () => ({ rewrites: [] })), review: async () => ({ decisions: [] }) };
    await agentActions.repair(ws, {}, agent, () => {});
    expect(agent.repair).toHaveBeenCalled();
  });
});

describe('a fact corrected, then removed after a conflict', () => {
  it('keeps the corrected-away wording out of the evidence too', () => {
    const { ws, source } = workspaceWithNotes('I led the migration of the booking system to Azure. I also trained two new starters.');
    proposeFacts(ws, source.id, [{ statement: 'Led the migration.', quote: 'I led the migration of the booking system to Azure.', requirementIds: ['contribution'] }]);
    decideFact(ws, 'f1', 'confirm');
    actions.changeFact(ws, { factId: 'f1', text: 'Priya led the migration; I wrote the runbook.' });
    ws.application.repair = null;
    const f1 = ws.applicant.facts[0];
    f1.history.push({ statement: f1.statement, quote: f1.quote, sourceId: f1.sourceId, at: '2026-10-30T11:00:00.000Z', removed: true });
    f1.status = 'rejected';
    expect(currentSourceText(ws, source)).toBe('[Superseded by the applicant’s explicit correction] I also trained two new starters.');
  });
});

