// Each step offers only the tools it needs, and the last turn asks for the answer.
// From the first real Muse Spark journey: the draft step called verify_quote 17
// times on facts already confirmed verbatim and ran out of turns without answering.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createLoop } from '../../server/agent/loop.js';
import { createModelAgent } from '../../server/agent/model.js';
import { draftPrompt, INSTRUCTIONS } from '../../server/agent/prompts.js';
import { fromRoot } from '../../server/paths.js';

const provider = { id: 'meta', model: 'muse-spark-1.3', isMeta: true };
const form = JSON.parse(readFileSync(fromRoot('fixtures', 'graphcore-form-2026-10-26.json'), 'utf8'));
const reply = (output) => ({ response: { output }, usage: {}, costUsd: 0, model: 'muse-spark-1.3', requestId: 'r', attempts: 1, timings: { firstEventMs: 1, firstOutputMs: 2, totalMs: 3 }, rateLimit: null });
const answer = (json) => reply([{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(json) }] }]);
const call = { type: 'function_call', call_id: 'c1', name: 'word_count', arguments: '{"text":"a b"}' };

function recording(turns) {
  const bodies = [];
  return { bodies, respond: async (body) => { bodies.push(structuredClone(body)); return turns.shift(); } };
}
const toolNames = (body) => body.tools.map((t) => t.name);
const facts = [{ id: 'f1', statement: 'Built a GPU runner.', quote: 'We built a self-service GPU job runner' }];

describe('tools per step', () => {
  it('offers drafting and repair only the word counter, reading the quote check and the form, asking the form', async () => {
    const transport = recording([answer({ facts: [], conflicts: [] }), answer({ coverage: [], questions: [] }), answer({ segments: [] }), answer({ rewrites: [] })]);
    const agent = createModelAgent({ provider, transport });
    await agent.extract({ form, source: { id: 's1', kind: 'notes', text: 'We built a self-service GPU job runner.' } });
    await agent.clarify({ form, askable: form.documents[0].requirements.slice(0, 1), facts, notes: ['n'] });
    await agent.draft({ form, doc: form.documents[0], facts, coverage: [], applicant: 'Ellie' });
    await agent.repair({ fact: { ...facts[0], history: [{ statement: 'Old.', quote: 'old' }] }, items: [{ segmentId: 'answer-1', docId: 'answer', before: 'x', factIds: ['f1'] }], facts, form });
    expect(transport.bodies.map(toolNames)).toEqual([['verify_quote', 'form_requirements'], ['form_requirements'], ['word_count'], ['word_count']]);
  });

  it('keeps the shared instructions identical for caching, and the draft prompt asks for no needless call', () => {
    expect(INSTRUCTIONS).toContain('3. Use the tools this step offers:');
    const prompt = draftPrompt({ doc: form.documents[0], facts, coverage: [], applicant: 'Ellie', company: 'Graphcore', role: form.role });
    expect(prompt).not.toContain('Call form_requirements first');
  });
});

describe('the last turn', () => {
  it('tells the model to answer now, and only on the last turn', async () => {
    const transport = recording([reply([call]), reply([call]), reply([call]), reply([call]), reply([call]), answer({ ok: true })]);
    const runStep = createLoop({ provider, transport });
    await runStep({ step: 'draft', prompt: 'Write.', schema: {}, tools: ['word_count'], toolContext: { sources: [], wordLimit: 300 }, effort: 'medium', maxOutputTokens: 100 });
    const last = transport.bodies[5].input.at(-1);
    expect(last).toEqual({ role: 'user', content: 'This is your last turn. Reply now with only the JSON answer; do not call a tool.' });
    expect(transport.bodies[4].input.at(-1).type).toBe('function_call_output');
  });
});
