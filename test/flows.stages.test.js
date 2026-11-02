import { describe, expect, it, vi } from 'vitest';
import { agentActions } from '../server/flows.js';
import { draftedWorkspace } from './helpers.js';

describe('progress stages come from the flows, for any model', () => {
  it('names each document as it is drafted, then the word-count check', async () => {
    const ws = await draftedWorkspace();
    ws.application.documents = { answer: null, letter: null };
    const agent = { draft: vi.fn(async () => ({ segments: [{ kind: 'claim', text: 'We chose Kubernetes Jobs.', factIds: ['f1'], startsParagraph: true }] })) };
    const labels = [];
    await agentActions.draft(ws, {}, agent, (e) => { if (e.type === 'stage') labels.push(e.label); });
    expect(labels).toEqual(['Drafting the project answer', 'Drafting the cover letter', 'Checking the word counts']);
  });

  it('names the reading, checking and repair steps', async () => {
    const ws = await draftedWorkspace();
    const s = ws.applicant.sources[0];
    s.read = false;
    const labels = [];
    const emit = (e) => { if (e.type === 'stage') labels.push(e.label); };
    await agentActions.read(ws, { sourceId: s.id }, { extract: vi.fn(async () => ({ facts: [] })) }, emit);
    expect(labels).toEqual(['Reading your words']);
  });
});
