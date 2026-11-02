import { describe, expect, it, vi } from 'vitest';
import { draftedWorkspace } from './helpers.js';
import { unansweredRequirements } from '../server/domain/completeness.js';
import { documentStats, editSegment } from '../server/domain/documents.js';
import { addSource } from '../server/domain/workspace.js';
import { proposeFacts, decideFact, coverage, changeFact } from '../server/domain/facts.js';
import { draftOne } from '../server/agent/draftFlow.js';
import { startRepair } from '../server/domain/repair.js';

const claim = (text, factIds) => ({ kind: 'claim', text, factIds });
const team = claim('We chose Kubernetes Jobs over Slurm.', ['f1']);
const own = claim('I found the /dev/shm problem by reading dmesg, and I wrote the Helm change that fixed it.', ['f3']);
const qualityId = 'letter-personal-contribution';
const gaps = (ws, segments) => unansweredRequirements(ws, 'letter', segments).filter((r) => r.id === qualityId);

async function ready() {
  const ws = await draftedWorkspace();
  // The letter already meets its generic experience requirement through team work.
  ws.application.coverage.evidence = ['f1', 'f3'];
  return ws;
}

function addFact(ws, quote, requirementIds) {
  const source = addSource(ws, { kind: 'answer', text: quote });
  const { accepted } = proposeFacts(ws, source.id, [{ statement: quote, quote, requirementIds }]);
  decideFact(ws, accepted[0], 'confirm');
  return accepted[0];
}

describe('conditional letter quality', () => {
  it('reports missing personal work even when team evidence satisfies the letter form criteria', async () => {
    const ws = await ready();
    expect(gaps(ws, [team])).toEqual([expect.objectContaining({
      id: qualityId, docId: 'letter', factIds: ['f3'],
    })]);
    expect(gaps(ws, [team])[0].text).toMatch(/ApplyArc/i);
  });

  it('accepts a supported personal contribution without requiring the rest of the facts', async () => {
    const ws = await ready();
    addFact(ws, 'I wrote the quota check.', ['contribution']);
    expect(gaps(ws, [team, own])).toEqual([]);
  });

  it('does not mistake first-person motivation for individual work', async () => {
    const ws = await ready();
    const id = addFact(ws, 'I like the infrastructure side of this role.', ['motivation']);
    expect(gaps(ws, [team, claim('I like the infrastructure side of this role.', [id])])).toHaveLength(1);
  });

  it('does not accept a team fact linked alongside an individual contribution', async () => {
    const ws = await ready();
    ws.application.coverage.contribution.push('f1');
    expect(gaps(ws, [team])[0]?.factIds).toEqual(['f3']);
  });

  it('does not count a teammate-only sentence citing a mixed applicant and teammate fact', async () => {
    const ws = await ready();
    const id = addFact(ws, 'Sam wrote the patch, and I tested the fix.', ['contribution']);
    expect(gaps(ws, [team, claim('Sam wrote the patch.', [id])])).toHaveLength(1);
    expect(gaps(ws, [team, claim('I tested the fix.', [id])])).toEqual([]);
  });

  it('does not invent a quality requirement without confirmed own-work evidence', async () => {
    const ws = await ready();
    ws.applicant.facts.find((f) => f.id === 'f3').status = 'rejected';
    addFact(ws, 'Sam wrote the patch.', ['contribution', 'evidence']);
    expect(gaps(ws, [team])).toEqual([]);
    expect(coverage(ws).find((r) => r.id === 'contribution').covered).toBe(false);
    expect(documentStats(ws, 'answer').leftOut.map((r) => r.id)).toContain('contribution');
  });

  it('does not widen correction repair to a letter using another contribution', async () => {
    const ws = await ready();
    const id = addFact(ws, 'I wrote the quota check.', ['contribution']);
    ws.application.documents.letter.segments = [{ id: 's99', kind: 'claim', text: 'I wrote the quota check.', factIds: [id], author: 'model' }];
    const before = structuredClone(ws.application.documents.letter);
    changeFact(ws, 'f3', 'Sam wrote the patch, and I tested the fix.');
    const repair = startRepair(ws, 'f3');
    expect(repair.items.every((item) => item.docId === 'answer')).toBe(true);
    expect(ws.application.documents.letter).toEqual(before);
    expect(gaps(ws, ws.application.documents.letter.segments)).toEqual([]);
  });
});

const argsFor = (ws) => ({ form: ws.application.form, doc: ws.application.form.documents[1], docId: 'letter', facts: ws.applicant.facts, coverage: coverage(ws).filter((r) => r.docId === 'letter'), applicant: ws.applicant.name });
function agentFor(drafts) {
  const queue = [...drafts];
  return {
    provider: { id: 'meta-test-double' },
    draft: vi.fn(async () => ({ segments: queue.length > 1 ? queue.shift() : queue[0] })),
    revise: vi.fn(async () => ({ rewrites: [] })),
    review: vi.fn(async ({ claims }) => ({ decisions: claims.map((c) => ({ id: c.id, verdict: 'supported', reason: 'Supported.' })) })),
  };
}

describe('letter quality uses the existing draft path', () => {
  it('uses one existing bounded redraft to add omitted confirmed personal work', async () => {
    const ws = await ready();
    ws.application.documents.letter = null;
    const agent = agentFor([[team], [team, own]]);
    await draftOne(ws, 'letter', argsFor(ws), agent);
    expect(agent.draft).toHaveBeenCalledTimes(2);
    expect(agent.draft.mock.calls[1][0].problems.join(' ')).toMatch(/ApplyArc/);
    expect(ws.application.documents.letter.segments.map((s) => s.text)).toContain(own.text);
    expect(documentStats(ws, 'letter').unanswered.filter((r) => r.id === qualityId)).toEqual([]);
  });

  it('retains safe wording and displays the quality gap after one unsuccessful redraft', async () => {
    const ws = await ready();
    ws.application.documents.letter = null;
    const agent = agentFor([[team]]);
    await draftOne(ws, 'letter', argsFor(ws), agent);
    expect(agent.draft).toHaveBeenCalledTimes(2);
    expect(ws.application.documents.letter.segments.map((s) => s.text)).toEqual([team.text]);
    expect(documentStats(ws, 'letter').unanswered.map((r) => r.id)).toContain(qualityId);
  });

  it('makes no extra draft when a supported personal contribution is present', async () => {
    const ws = await ready();
    ws.application.documents.letter = null;
    const agent = agentFor([[team, own]]);
    await draftOne(ws, 'letter', argsFor(ws), agent);
    expect(agent.draft).toHaveBeenCalledTimes(1);
  });

  it('never redrafts over manual edits to improve letter quality', async () => {
    const ws = await ready();
    editSegment(ws, 'letter', ws.application.documents.letter.segments[1].id, 'My own opening stays.');
    const before = structuredClone(ws.application.documents.letter);
    const agent = agentFor([[team, own]]);
    await expect(draftOne(ws, 'letter', argsFor(ws), agent)).rejects.toMatchObject({ code: 'would-overwrite' });
    expect(agent.draft).not.toHaveBeenCalled();
    expect(ws.application.documents.letter).toEqual(before);
  });
});

describe('optional letter improvement recovery', () => {
  async function retrySetup(second) {
    const ws = await ready();
    ws.application.documents.letter = null;
    const agent = agentFor([[team]]);
    agent.draft.mockResolvedValueOnce({ segments: [team] });
    if (second instanceof Error) agent.draft.mockRejectedValueOnce(second);
    else agent.draft.mockResolvedValueOnce({ segments: second });
    return { ws, agent };
  }

  it.each(['timeout', 'invalid-output'])('keeps the reviewed first letter if optional retry fails with %s', async (code) => {
    const { ws, agent } = await retrySetup(Object.assign(new Error('Retry failed'), { code }));
    const events = [];
    await draftOne(ws, 'letter', argsFor(ws), agent, (event) => events.push(event));
    expect(ws.application.documents.letter.segments.map((s) => s.text)).toEqual([team.text]);
    expect(documentStats(ws, 'letter').unanswered.map((r) => r.id)).toContain(qualityId);
    expect(agent.draft).toHaveBeenCalledTimes(2);
    expect(events.map((e) => e.label)).toContain('Adding your own contribution to the letter');
    expect(events.map((e) => e.label)).toContain('Keeping the checked draft; the writing suggestion remains');
  });

  it('keeps the first letter if the optional retry has no usable claim', async () => {
    const { ws, agent } = await retrySetup([]);
    await draftOne(ws, 'letter', argsFor(ws), agent);
    expect(ws.application.documents.letter.segments.map((s) => s.text)).toEqual([team.text]);
    expect(documentStats(ws, 'letter').unanswered.map((r) => r.id)).toContain(qualityId);
  });

  it('keeps the valid first letter if the optional retry exceeds the limit', async () => {
    const { ws, agent } = await retrySetup([team, own]);
    ws.application.form.documents[1].wordLimit = 10;
    await draftOne(ws, 'letter', argsFor(ws), agent);
    expect(ws.application.documents.letter.segments.map((s) => s.text)).toEqual([team.text]);
    expect(documentStats(ws, 'letter').overLimit).toBe(false);
  });

  it('asks for any one qualifying example, without demanding every available fact', async () => {
    const { ws, agent } = await retrySetup([team, own]);
    addFact(ws, 'I wrote the quota check.', ['contribution']);
    await draftOne(ws, 'letter', argsFor(ws), agent);
    expect(agent.draft.mock.calls[1][0].problems.join(' ')).toMatch(/any one|one of/i);
    expect(agent.draft.mock.calls[1][0].problems.join(' ')).toContain('f3');
    expect(agent.draft.mock.calls[1][0].problems.join(' ')).toContain('f4');
  });

  it('keeps the first checked letter when a successful optional retry drops employer content', async () => {
    const { ws, agent } = await retrySetup([team, own]);
    const id = addFact(ws, 'I want to build infrastructure for machine learning.', ['motivation']);
    const motivation = claim('I want to build infrastructure for machine learning.', [id]);
    agent.draft.mockReset().mockResolvedValueOnce({ segments: [team, motivation] }).mockResolvedValueOnce({ segments: [team, own] });
    await draftOne(ws, 'letter', argsFor(ws), agent);
    expect(ws.application.documents.letter.segments.map((s) => s.text)).toEqual([team.text, motivation.text]);
    expect(documentStats(ws, 'letter').unanswered.map((r) => r.id)).toEqual([qualityId]);
    expect(agent.draft).toHaveBeenCalledTimes(2);
  });

  it('keeps the first checked letter when the optional retry does not resolve its advice', async () => {
    const alternative = claim('We chose Kubernetes Jobs over Slurm so every job ran in a container under a course quota.', ['f1']);
    const { ws, agent } = await retrySetup([alternative]);
    await draftOne(ws, 'letter', argsFor(ws), agent);
    expect(ws.application.documents.letter.segments.map((s) => s.text)).toEqual([team.text]);
    expect(documentStats(ws, 'letter').unanswered.map((r) => r.id)).toEqual([qualityId]);
    expect(agent.draft).toHaveBeenCalledTimes(2);
  });

  it.each(['empty', 'over-limit', 'employer-omission'])('does not accept a first draft with %s when its required retry fails', async (fault) => {
    const { ws, agent } = await retrySetup(Object.assign(new Error('Retry failed'), { code: 'timeout' }));
    if (fault === 'empty') agent.draft.mockReset().mockResolvedValueOnce({ segments: [] }).mockRejectedValueOnce(Object.assign(new Error('Retry failed'), { code: 'timeout' }));
    if (fault === 'over-limit') ws.application.form.documents[1].wordLimit = 2;
    if (fault === 'employer-omission') addFact(ws, 'I want to build infrastructure for machine learning.', ['motivation']);
    await expect(draftOne(ws, 'letter', argsFor(ws), agent)).rejects.toMatchObject({ code: 'timeout' });
    expect(ws.application.documents.letter).toBeNull();
    expect(agent.draft).toHaveBeenCalledTimes(2);
  });

  it.each(['cancelled', 'AbortError'])('propagates %s rather than saving the first draft', async (kind) => {
    const error = Object.assign(new Error('Stopped'), kind === 'cancelled' ? { code: kind } : { name: kind });
    const { ws, agent } = await retrySetup(error);
    await expect(draftOne(ws, 'letter', argsFor(ws), agent)).rejects.toBe(error);
    expect(ws.application.documents.letter).toBeNull();
  });
});
