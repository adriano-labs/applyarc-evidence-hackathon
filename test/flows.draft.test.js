import { describe, expect, it, vi } from 'vitest';
import { agentActions } from '../server/flows.js';
import { draftedWorkspace } from './helpers.js';

async function blank() {
  const ws = await draftedWorkspace();
  ws.application.documents = { answer: null, letter: null };
  return ws;
}
const good = { segments: [{ kind: 'claim', text: 'We chose Kubernetes Jobs.', factIds: ['f1'], startsParagraph: true }] };
const bad = { segments: [{ kind: 'claim', text: 'I am brilliant.', factIds: [], startsParagraph: true }] };

describe('the draft step', () => {
  it('sends a refused draft back once with the exact problems, and keeps the fixed one', async () => {
    const ws = await blank();
    const draft = vi.fn().mockResolvedValueOnce(bad).mockResolvedValue(good);
    const events = [];
    const result = await agentActions.draft(ws, {}, { draft }, (e) => events.push(e));
    expect(result.drafted).toEqual(['answer', 'letter']);
    expect(draft).toHaveBeenCalledTimes(3);
    expect(draft.mock.calls[1][0].problems).toEqual(['Sentence 1: a claim must cite a fact']);
    expect(draft.mock.calls[0][0].problems).toBeUndefined();
    expect(events.map((e) => e.label).filter(Boolean)).toContain('The evidence check refused 1 sentence; asking for a fix');
    expect(ws.application.documents.answer.segments[0].text).toBe('We chose Kubernetes Jobs.');
  });

  it('after one fix attempt keeps every sentence that passes, leaves out the rest and says which', async () => {
    const ws = await blank();
    const mixed = { segments: [
      { kind: 'claim', text: 'We chose Kubernetes Jobs.', factIds: ['f1'], startsParagraph: true },
      { kind: 'claim', text: 'I am brilliant.', factIds: [], startsParagraph: true },
      { kind: 'claim', text: 'We chose Kubernetes Jobs again.', factIds: ['f1'], startsParagraph: false },
    ] };
    const draft = vi.fn().mockResolvedValueOnce(bad).mockResolvedValueOnce(mixed).mockResolvedValue(good);
    const result = await agentActions.draft(ws, {}, { draft }, () => {});
    expect(ws.application.documents.answer.segments.map((s) => [s.text, s.startsParagraph])).toEqual([['We chose Kubernetes Jobs.', true], ['We chose Kubernetes Jobs again.', true]]);
    expect(result.dropped).toEqual([{ docId: 'answer', text: 'I am brilliant.', reason: 'a claim must cite a fact' }]);
  });

  it('gives up after one fix attempt and changes nothing when no sentence passes', async () => {
    const ws = await blank();
    const draft = vi.fn().mockResolvedValue(bad);
    await expect(agentActions.draft(ws, {}, { draft }, () => {})).rejects.toMatchObject({ code: 'invalid-draft' });
    expect(draft).toHaveBeenCalledTimes(2);
    expect(ws.application.documents.answer).toBeNull();
  });
});
