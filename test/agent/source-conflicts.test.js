import { describe, expect, it } from 'vitest';
import { createModelAgent } from '../../server/agent/model.js';
import { clarifyPrompt, extractPrompt } from '../../server/agent/prompts.js';
import { extractSchema } from '../../server/agent/schemas.js';
import { form } from '../helpers.js';

const source = { id: 's2', kind: 'answer', text: 'I deployed to production.' };
const evidence = [{ id: 's1', kind: 'notes', text: 'We used a practice network.' }, source];
const provider = { id: 'meta', model: 'muse-spark-1.3', isMeta: true };
function model(result) {
  const bodies = [];
  const transport = { respond: async (body) => {
    bodies.push(body);
    return { response: { output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(result) }] }] }, usage: {}, costUsd: 0, requestId: 'test-only', attempts: 1, timings: { totalMs: 1 } };
  } };
  return { agent: createModelAgent({ provider, transport }), bodies };
}

describe('source-conflict extraction contract', () => {
  it('asks for grounded conflict output during the existing extraction call', async () => {
    const { agent, bodies } = model({ facts: [], conflicts: [] });
    await agent.extract({ form, source, evidence });
    expect(bodies).toHaveLength(1);
    expect(bodies[0].input[0].content).toContain('We used a practice network.');
    const schema = bodies[0].text.format.schema;
    expect(schema.required).toEqual(['facts', 'conflicts']);
    expect(schema.properties.conflicts.items.properties.priorSourceId.enum).toEqual(['s1', 's2']);
  });

  it.each([{ facts: [] }, { facts: [], conflicts: null }])('rejects a missing source-consistency result: %o', async (result) => {
    const { agent } = model(result);
    await expect(agent.extract({ form, source, evidence })).rejects.toThrow('The source check did not finish');
  });

  it('keeps all strict objects closed and all keys required', () => {
    function verify(schema) {
      if (schema.type === 'object') {
        expect(schema.additionalProperties).toBe(false);
        expect(schema.required).toEqual(Object.keys(schema.properties));
        Object.values(schema.properties).forEach(verify);
      }
      if (schema.items) verify(schema.items);
    }
    verify(extractSchema(['contribution'], ['s1', 's2']));
  });

  it('instructs semantic comparison, preserving explicit corrections and useful scope', () => {
    const prompt = extractPrompt({ source, evidence });
    expect(prompt).toContain('not banned words');
    expect(prompt).toContain('Do not smooth over a material conflict by omitting the disputed scope');
    expect(prompt).toContain('do not resurrect the removed claim');
    expect(prompt).toContain('Ordinary added notes or an answer do not silently replace an earlier fact');
  });

  // Live, 3 Nov: every note that began "Correction:" was read as new facts, a number-only
  // correction raised nothing, and one question told the applicant to use "Correct fact".
  it('treats only a correction source as a correction, compares numbers and keeps app controls out of questions (prompt contract)', () => {
    const prompt = extractPrompt({ source, evidence });
    expect(prompt).toContain('Only a source whose kind in active_source_context is "correction" is an explicit correction');
    expect(prompt).toContain('Notes or an answer stay ordinary even when they call themselves a correction ("Correction:", "One correction"): when they contradict an earlier source, return the conflict so the applicant decides.');
    expect(prompt).toContain('a different number, date or measurement for the same thing');
    expect(prompt).toContain('never naming the app\'s buttons or steps');
    expect(prompt).not.toContain('Correct fact');
    expect(clarifyPrompt({ askable: [], facts: [], notes: [] })).toContain('never naming the app\'s buttons or steps');
  });
});
