// The model step for repair passes the documents around the listed sentences into its prompt.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createModelAgent } from '../../server/agent/model.js';
import { fromRoot } from '../../server/paths.js';

const provider = { id: 'meta', model: 'muse-spark-1.3', isMeta: true };
const form = JSON.parse(readFileSync(fromRoot('fixtures', 'graphcore-form-2026-10-26.json'), 'utf8'));
const answer = (json) => ({ response: { output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(json) }] }] }, usage: {}, costUsd: 0, model: 'muse-spark-1.3', requestId: 'r', attempts: 1, timings: { firstEventMs: 1, firstOutputMs: 2, totalMs: 3 }, rateLimit: null });

describe('the repair step', () => {
  it('sends the documents around the listed sentences', async () => {
    const bodies = [];
    const transport = { respond: async (body) => { bodies.push(structuredClone(body)); return answer({ rewrites: [] }); } };
    const facts = [{ id: 'f1', statement: 'Built a GPU runner.', quote: 'We built a self-service GPU job runner' }];
    const documents = [{ docId: 'answer', sentences: [{ segmentId: 'answer-1', text: 'We built a GPU job runner.' }, { segmentId: 'answer-2', text: 'It ran student jobs overnight.' }] }];
    await createModelAgent({ provider, transport }).repair({ fact: { ...facts[0], history: [{ statement: 'Old.', quote: 'old' }] }, items: [{ segmentId: 'answer-1', docId: 'answer', before: 'x', factIds: ['f1'] }], facts, form, documents });
    expect(JSON.stringify(bodies[0])).toContain('It ran student jobs overnight.');
    expect(JSON.stringify(bodies[0])).toContain('documents_now');
  });
});
