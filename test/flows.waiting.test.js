// While a question waits for the applicant, no model call runs (FINAL-ACCEPTANCE (c)2).
// Drafting already refuses (documents.test.js); repair and strengthening must too.
import { describe, expect, it, vi } from 'vitest';
import { actions, agentActions } from '../server/flows.js';
import { draftedWorkspace } from './helpers.js';

const agent = () => ({ provider: { id: 'meta-test-double' }, repair: vi.fn(), revise: vi.fn(), review: vi.fn(), strengthen: vi.fn(), draft: vi.fn() });
const noModelCall = (a) => Object.values(a).filter((fn) => vi.isMockFunction(fn)).every((fn) => fn.mock.calls.length === 0);
async function waiting() {
  const ws = await draftedWorkspace();
  for (const docId of ['answer', 'letter']) actions.approve(ws, { docId, docRevision: ws.application.documents[docId].revision });
  actions.changeFact(ws, { factId: 'f3', text: 'My teammate Sam wrote the Helm change; I tested it on two lab nodes.' });
  ws.application.questions.push({ id: 'q9', requirementId: 'goal', text: 'What was the project for?', why: 'The form asks.', status: 'open' });
  return ws;
}

describe('a question waiting for the applicant', () => {
  it('stops a repair before any model call', async () => {
    const ws = await waiting();
    const a = agent();
    await expect(agentActions.repair(ws, {}, a, () => {})).rejects.toMatchObject({ code: 'not-ready', message: 'Answer or skip the open question first.' });
    expect(noModelCall(a)).toBe(true);
  });

  it('stops strengthening a sentence before any model call', async () => {
    const ws = await waiting();
    const a = agent();
    await expect(agentActions.strengthen(ws, { docId: 'answer', segmentId: 'answer-1' }, a, () => {})).rejects.toMatchObject({ code: 'not-ready' });
    expect(noModelCall(a)).toBe(true);
  });

  it('lets the repair run once the question is answered or skipped', async () => {
    const ws = await waiting();
    ws.application.questions.at(-1).status = 'skipped';
    const a = agent();
    a.repair.mockResolvedValue({ rewrites: [] });
    a.review.mockResolvedValue({ decisions: [] });
    await agentActions.repair(ws, {}, a, () => {});
    expect(a.repair).toHaveBeenCalledTimes(1);
  });
});
