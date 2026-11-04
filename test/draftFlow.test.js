import { describe, expect, it, vi } from 'vitest';
import { draftDocuments, draftOne } from '../server/agent/draftFlow.js';
import { draftedWorkspace } from './helpers.js';

const good = { kind: 'claim', text: 'We chose Kubernetes Jobs.', factIds: ['f1'], startsParagraph: true };
const bad = { kind: 'claim', text: 'I deployed the production service.', factIds: ['f1'], startsParagraph: true };
const fixed = { segmentId: '1', text: 'We used Kubernetes Jobs instead of Slurm.', factIds: ['f1'] };
const agentWith = (segments = [good, bad]) => ({
  provider: { id: 'meta-test-double' },
  draft: vi.fn().mockResolvedValue({ segments }),
  revise: vi.fn().mockResolvedValue({ rewrites: [fixed] }),
  review: vi.fn(async ({ claims }) => ({ decisions: claims.map((claim) => ({ id: claim.id, verdict: claim.text.includes('production') ? 'contradicted' : 'supported', reason: 'The evidence does not say this.' })) })),
});
// These tests are about revision, scheduling and shape, so only the requirement their
// drafts answer is covered; completeness has its own tests (draftFlow.completeness.test.js).
async function blank() {
  const ws = await draftedWorkspace();
  ws.application.documents = { answer: null, letter: null };
  ws.application.coverage = { decision: ['f1'] };
  return ws;
}
const argsFor = (ws) => ({ form: ws.application.form, doc: ws.application.form.documents[0], docId: 'answer', facts: ws.applicant.facts, coverage: [], applicant: ws.applicant.name });
const noEvents = () => {};

describe('targeted draft repair', () => {
  it('revises only refused claims, keeps good sentences and reviews the new wording separately', async () => {
    const ws = await blank();
    const agent = agentWith();
    const dropped = await draftOne(ws, 'answer', argsFor(ws), agent, noEvents);
    expect(agent.draft).toHaveBeenCalledTimes(1);
    expect(agent.revise).toHaveBeenCalledTimes(1);
    expect(agent.revise.mock.calls[0][0].items).toEqual([{ segmentId: '1', text: bad.text, factIds: ['f1'], reason: 'The evidence does not say this.' }]);
    expect(agent.revise.mock.calls[0][0].documents).toEqual([{
      docId: 'answer',
      sentences: [
        { segmentId: '0', text: good.text },
        { segmentId: '1', text: bad.text },
      ],
    }]);
    expect(agent.review).toHaveBeenCalledTimes(2);
    expect(agent.review.mock.calls[1][0].claims.map((c) => c.text)).toEqual([fixed.text]);
    expect(ws.application.documents.answer.segments.map((s) => s.text)).toEqual([good.text, fixed.text]);
    expect(ws.application.documents.answer.segments[0].startsParagraph).toBe(true);
    expect(dropped).toEqual([]);
  });

  it('drops an unsupported replacement after one attempt; original good claims remain', async () => {
    const ws = await blank();
    const agent = agentWith();
    agent.revise.mockResolvedValue({ rewrites: [{ ...fixed, text: 'We owned production.' }] });
    const dropped = await draftOne(ws, 'answer', argsFor(ws), agent, noEvents);
    expect(agent.revise).toHaveBeenCalledTimes(1);
    expect(ws.application.documents.answer.segments.map((s) => s.text)).toEqual([good.text]);
    expect(dropped).toEqual([{ docId: 'answer', text: 'We owned production.', reason: 'The evidence does not say this.' }]);
  });

  it('never accepts duplicate, foreign or nonrequested rewrite ids', async () => {
    const ws = await blank();
    const agent = agentWith();
    agent.revise.mockResolvedValue({ rewrites: [
      { ...fixed, segmentId: '0', text: 'Change a valid sentence.' },
      fixed, { ...fixed, text: 'Another rewrite for the same id.' },
      { ...fixed, segmentId: '99' },
    ] });
    const dropped = await draftOne(ws, 'answer', argsFor(ws), agent, noEvents);
    expect(ws.application.documents.answer.segments.map((s) => s.text)).toEqual([good.text]);
    expect(dropped[0].text).toBe(bad.text);
    expect(agent.review).toHaveBeenCalledTimes(1);
  });

  it('does not admit a replacement without a fresh complete evidence review', async () => {
    const ws = await blank();
    const agent = agentWith();
    agent.review.mockImplementationOnce(async ({ claims }) => ({ decisions: claims.map((c) => ({ id: c.id, verdict: c.text === good.text ? 'supported' : 'contradicted', reason: 'Not supported.' })) }));
    agent.review.mockResolvedValue({ decisions: [] });
    await draftOne(ws, 'answer', argsFor(ws), agent, noEvents);
    expect(ws.application.documents.answer.segments.map((s) => s.text)).toEqual([good.text]);
  });

  it('keeps greetings and sign-offs out of a project answer', async () => {
    const ws = await blank();
    const agent = agentWith([good, { kind: 'frame', text: 'Thank you for considering my application.', factIds: [] }]);
    await draftOne(ws, 'answer', argsFor(ws), agent, noEvents);
    expect(ws.application.documents.answer.segments.map((s) => s.text)).toEqual([good.text]);
    expect(agent.revise).not.toHaveBeenCalled();
  });

  it('drops bad frames without sending them for model revision', async () => {
    const ws = await blank();
    const agent = agentWith([{ kind: 'frame', text: 'Dear team, I am a genius.', factIds: [], startsParagraph: true }, { ...good, startsParagraph: false }]);
    const dropped = await draftOne(ws, 'answer', argsFor(ws), agent, noEvents);
    expect(agent.revise).not.toHaveBeenCalled();
    expect(ws.application.documents.answer.segments).toHaveLength(1);
    expect(ws.application.documents.answer.segments[0].startsParagraph).toBe(true);
    expect(dropped).toHaveLength(1);
  });

  it('refuses a document with no surviving claim instead of publishing frames or nothing', async () => {
    const ws = await blank();
    const agent = agentWith([bad]);
    agent.revise.mockResolvedValue({ rewrites: [] });
    await expect(draftOne(ws, 'answer', argsFor(ws), agent, noEvents)).rejects.toMatchObject({ code: 'invalid-draft' });
    expect(ws.application.documents.answer).toBeNull();
    const frames = agentWith([{ kind: 'frame', text: 'Dear Graphcore team,', factIds: [] }]);
    await expect(draftOne(ws, 'answer', argsFor(ws), frames, noEvents)).rejects.toMatchObject({ code: 'invalid-draft' });
    expect(ws.application.documents.answer).toBeNull();
  });

  it('leaves an existing manually edited document untouched', async () => {
    const ws = await draftedWorkspace();
    ws.application.documents.letter.segments[1].author = 'user';
    const letter = structuredClone(ws.application.documents.letter);
    ws.application.documents.answer = null;
    ws.application.coverage = { decision: ['f1'] }; // the requirement this test's draft answers
    const agent = agentWith([good]);
    const result = await draftDocuments(ws, agent, noEvents);
    expect(result.drafted).toEqual(['answer']);
    expect(agent.draft).toHaveBeenCalledTimes(1);
    expect(ws.application.documents.letter).toEqual(letter);
  });

  it('refuses even a direct draftOne call that would replace a manual edit', async () => {
    const ws = await draftedWorkspace();
    ws.application.documents.answer.segments[0].author = 'user';
    const before = structuredClone(ws.application.documents.answer);
    const agent = agentWith([good]);
    await expect(draftOne(ws, 'answer', argsFor(ws), agent, noEvents)).rejects.toMatchObject({ code: 'would-overwrite' });
    expect(agent.draft).not.toHaveBeenCalled();
    expect(ws.application.documents.answer).toEqual(before);
  });
});

describe('document scheduling and old-agent behavior', () => {
  it('previews only an admitted document while the other document is still running', async () => {
    const ws = await blank();
    const agent = agentWith();
    const pending = {};
    const emit = vi.fn();
    agent.draft.mockImplementation(({ docId }) => new Promise((resolve) => { pending[docId] = resolve; }));
    let finished = false;
    const task = draftDocuments(ws, agent, emit).finally(() => { finished = true; });
    pending.answer({ segments: [good, bad] });
    await vi.waitFor(() => expect(emit.mock.calls.some(([event]) => event.type === 'document-ready')).toBe(true));
    const event = emit.mock.calls.find(([event]) => event.type === 'document-ready')[0];
    expect(event.docId).toBe('answer');
    expect(event.segments.map((s) => s.text)).toEqual([good.text, fixed.text]);
    expect(finished).toBe(false);
    pending.letter({ segments: [good] });
    await task;
  });

  it('never emits an unreviewed or rejected document preview', async () => {
    const ws = await blank();
    const agent = agentWith([bad]);
    agent.revise.mockResolvedValue({ rewrites: [] });
    const emit = vi.fn();
    await expect(draftDocuments(ws, agent, emit)).rejects.toMatchObject({ code: 'invalid-draft' });
    expect(emit.mock.calls.some(([event]) => event.type === 'document-ready')).toBe(false);
  });

  it('checks unresolved facts before making any model call', async () => {
    const ws = await blank();
    ws.applicant.facts[0].status = 'proposed';
    const agent = agentWith([good]);
    await expect(draftDocuments(ws, agent, noEvents)).rejects.toMatchObject({ code: 'not-ready', details: { blockers: ['Confirm or reject every proposed fact.'] } });
    expect(agent.draft).not.toHaveBeenCalled();
    expect(agent.review).not.toHaveBeenCalled();
    expect(agent.revise).not.toHaveBeenCalled();
  });

  it('starts both real-agent documents before either settles', async () => {
    const ws = await blank();
    const agent = agentWith([good]);
    const pending = {};
    agent.draft.mockImplementation(({ docId }) => new Promise((resolve) => { pending[docId] = resolve; }));
    const result = draftDocuments(ws, agent, noEvents);
    expect(Object.keys(pending)).toEqual(['answer', 'letter']);
    pending.letter({ segments: [good] });
    pending.answer({ segments: [good] });
    expect((await result).drafted).toEqual(['answer', 'letter']);
  });

  it('keeps fixture ordering and full-draft retry when there is no revise method', async () => {
    const ws = await blank();
    const invalid = { segments: [{ ...bad, factIds: [] }] };
    const draft = vi.fn().mockResolvedValueOnce(invalid).mockResolvedValue({ segments: [good] });
    const result = await draftDocuments(ws, { provider: { id: 'fixture' }, draft }, noEvents);
    expect(result.drafted).toEqual(['answer', 'letter']);
    expect(draft.mock.calls.map(([args]) => args.docId)).toEqual(['answer', 'answer', 'letter']);
    expect(draft.mock.calls[1][0].problems).toEqual(['Sentence 1: a claim must cite a fact']);
  });

  it('waits for both started operations before surfacing a failure to the outer transaction', async () => {
    const ws = await blank();
    const agent = agentWith([good]);
    let finishLetter;
    const failure = new Error('Draft provider failed.');
    agent.draft.mockImplementation(({ docId }) => docId === 'answer' ? Promise.reject(failure) : new Promise((resolve) => { finishLetter = resolve; }));
    let finished = false;
    const task = draftDocuments(ws, agent, noEvents).finally(() => { finished = true; });
    await Promise.resolve();
    await Promise.resolve();
    expect(finished).toBe(false);
    finishLetter({ segments: [good] });
    await expect(task).rejects.toBe(failure);
    expect(finished).toBe(true);
  });
});
