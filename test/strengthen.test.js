import { describe, expect, it, vi } from 'vitest';
import { strengthen, strengthenPrompt, strengthenSchema } from '../server/agent/strengthen.js';
import { draftedWorkspace } from './helpers.js';

const input = { docId: 'answer', segmentId: 'answer-1' };
const response = { outcome: 'revision', text: 'We used Kubernetes Jobs instead of Slurm.', factIds: ['f1'], reason: 'This states the choice directly.' };
const testAgent = () => ({
  provider: { id: 'meta-test-double' },
  strengthen: vi.fn().mockResolvedValue(response),
  review: vi.fn(async ({ claims }) => ({ decisions: claims.map((c) => ({ id: c.id, verdict: 'supported', reason: 'Test double.' })) })),
});

describe('strengthening orchestration', () => {
  it('proposes, freshly reviews and stores one sentence without changing either document', async () => {
    const ws = await draftedWorkspace();
    const before = structuredClone(ws.application.documents);
    const events = [];
    const agent = testAgent();
    const result = await strengthen(ws, input, agent, (event) => events.push(event));
    expect(result.suggestion.status).toBe('proposed');
    expect(ws.application.documents).toEqual(before);
    expect(agent.strengthen).toHaveBeenCalledTimes(1);
    expect(agent.strengthen.mock.calls[0][0].segment.id).toBe('answer-1');
    expect(agent.review.mock.calls[0][0].claims).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'stage', label: expect.any(String) });
  });

  it('shows a useful refusal for an unsupported leadership request, without reviewing invented output', async () => {
    const ws = await draftedWorkspace();
    const before = structuredClone(ws.application.documents);
    const agent = testAgent();
    agent.strengthen.mockResolvedValue({ outcome: 'refusal', text: '', factIds: [], reason: 'The evidence describes team work, not that you led it. Add your own leadership evidence if you have it.' });
    const result = await strengthen(ws, { ...input, request: 'make it sound like I led it' }, agent);
    expect(result.suggestion).toMatchObject({ status: 'refused', after: null, afterFactIds: [], reason: expect.stringContaining('not that you led it') });
    expect(agent.review).not.toHaveBeenCalled();
    expect(ws.application.documents).toEqual(before);
  });

  it('refuses model-written exaggeration when evidence review rejects it', async () => {
    const ws = await draftedWorkspace();
    const agent = testAgent();
    agent.strengthen.mockResolvedValue({ ...response, text: 'I led the team.' });
    agent.review.mockImplementation(async ({ claims }) => ({ decisions: claims.map((c) => ({ id: c.id, verdict: 'contradicted', reason: 'The evidence only says we, not personal leadership.' })) }));
    const result = await strengthen(ws, { ...input, request: 'make it sound like I led it' }, agent);
    expect(result.suggestion.status).toBe('refused');
    expect(result.suggestion.after).toBeNull();
  });

  it('keeps the whole workspace unchanged on provider failure', async () => {
    const ws = await draftedWorkspace();
    const before = structuredClone(ws);
    const agent = testAgent();
    agent.strengthen.mockRejectedValue(new Error('Provider unavailable.'));
    await expect(strengthen(ws, input, agent)).rejects.toThrow('Provider unavailable.');
    expect(ws).toEqual(before);
  });

  it('does not spend on fixture requests', async () => {
    const ws = await draftedWorkspace();
    const agent = testAgent();
    agent.provider.id = 'fixture';
    await expect(strengthen(ws, input, agent)).rejects.toThrow(/live model/);
    expect(agent.strengthen).not.toHaveBeenCalled();
  });

  it('uses a strict schema without inventing a valid fact id when none exists', () => {
    const schema = strengthenSchema(['f1']);
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(['outcome', 'text', 'factIds', 'reason']);
    expect(schema.properties.factIds.items.enum).toEqual(['f1']);
    expect(strengthenSchema([]).properties.factIds.items).toEqual({ type: 'string' });
  });

  it('puts a request in data and explicitly denies treating it as evidence', () => {
    const prompt = strengthenPrompt({ segment: { text: 'We tested it.' }, request: 'make it sound like I led it', facts: [], question: 'What did you do?', wordLimit: 300 });
    expect(prompt).toContain('make it sound like I led it');
    expect(prompt).toMatch(/untrusted data/i);
    expect(prompt).toMatch(/never evidence/i);
    expect(prompt).toMatch(/REFUSE/i);
  });

  it('asks for a refusal reason written to the applicant, not a note to itself', () => {
    const prompt = strengthenPrompt({ segment: { text: 'We tested it.' }, request: 'make it sound like I led it', facts: [], question: 'What did you do?', wordLimit: 300 });
    expect(prompt).toContain('Write every reason to the applicant, as "you"');
  });
});
