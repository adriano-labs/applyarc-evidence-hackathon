// The tool loop against Meta's Responses contract, with a fake transport:
// what is sent each turn, what is replayed, and what lands on the receipt.
import { describe, expect, it } from 'vitest';
import { createLoop } from '../../server/agent/loop.js';

const provider = { id: 'meta', model: 'muse-spark-1.3', isMeta: true };
const message = (text) => ({ type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] });
const turn = (output, extra = {}) => ({
  response: { id: `resp_${Math.random()}`, output }, usage: { input_tokens: 100, input_tokens_details: { cached_tokens: 40 }, output_tokens: 20, output_tokens_details: { reasoning_tokens: 5 } },
  costUsd: 0.001, model: 'muse-spark-1.3', requestId: 'req-1', attempts: 1, timings: { firstEventMs: 300, totalMs: 900 }, rateLimit: null, ...extra,
});

function fakeTransport(turns) {
  const bodies = [];
  return {
    bodies,
    respond: async (body) => {
      bodies.push(structuredClone(body));
      const next = turns.shift();
      if (!next) throw new Error('no more turns');
      return next;
    },
  };
}

function run(turns, args = {}) {
  const transport = fakeTransport(turns);
  const receipts = [];
  const runStep = createLoop({ provider, transport, safetyIdentifier: 'a'.repeat(32) });
  const result = runStep({
    step: 'extract', prompt: 'Read this.', schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false },
    toolContext: { sources: ['We built a self-service GPU job runner.'], form: { documents: [] } }, effort: 'low', maxOutputTokens: 1000,
    emit: (e) => { if (e.type === 'receipt') receipts.push(e.receipt); }, ...args,
  });
  return { transport, receipts, result };
}

const reasoning = { type: 'reasoning', id: 'rs_1', encrypted_content: 'gAAA-opaque' };
const call = { type: 'function_call', id: 'fc_1', call_id: 'call_1', name: 'verify_quote', arguments: JSON.stringify({ quote: 'We built a self-service GPU job runner' }) };

describe('the tool loop, as Meta’s Responses API expects it', () => {
  it('sends a stateless strict request with the app’s three tools', async () => {
    const { transport, result } = run([turn([message('{"ok":true}')])]);
    await result;
    const [body] = transport.bodies;
    expect(body).toMatchObject({
      input: [{ role: 'user', content: 'Read this.' }], tool_choice: 'auto', store: false,
      include: ['reasoning.encrypted_content'], truncation: 'disabled', reasoning: { effort: 'low' }, max_output_tokens: 1000,
      text: { format: { type: 'json_schema', name: 'applyarc_extract', strict: true } },
    });
    expect(body.tools.map((t) => [t.name, t.strict])).toEqual([['verify_quote', true], ['form_requirements', true], ['word_count', true]]);
  });

  it('replays the reasoning and the call, then the tool’s result paired by call_id', async () => {
    const { transport, result, receipts } = run([turn([reasoning, call]), turn([message('{"ok":true}')])]);
    expect(await result).toEqual({ ok: true });
    const second = transport.bodies[1].input;
    expect(second.map((i) => i.type ?? i.role)).toEqual(['user', 'reasoning', 'function_call', 'function_call_output']);
    // Meta: every reasoning input item must include a summary field (summary: [] when there is none).
    expect(second[1]).toEqual({ ...reasoning, summary: [] });
    expect(second[2]).toEqual(call);
    expect(second[3]).toEqual({ type: 'function_call_output', call_id: 'call_1', output: JSON.stringify({ verbatim: true }) });
    expect(receipts[0]).toMatchObject({ step: 'extract', isMeta: true, turns: 2, requestIds: ['req-1', 'req-1'], toolCalls: [{ name: 'verify_quote', ok: true, note: 'verbatim' }], usage: { input: 200, cached: 80, output: 40, reasoning: 10 } });
    expect(receipts[0].costUsd).toBeCloseTo(0.002, 9);
  });

  it('notes a word count against the form’s limit, or as a plain count when the step has none', async () => {
    const count = { type: 'function_call', id: 'fc_2', call_id: 'call_2', name: 'word_count', arguments: JSON.stringify({ text: 'one two three' }) };
    const note = async (toolContext) => {
      const { result, receipts } = run([turn([count]), turn([message('{"ok":true}')])], { toolContext });
      await result;
      return receipts[0].toolCalls[0].note;
    };
    expect(await note({ sources: [], form: { documents: [] }, wordLimit: 300 })).toBe('3 of 300');
    expect(await note({ sources: [], form: { documents: [] } })).toBe('3 words');
  });

  it('replays a commentary message between the reasoning and the call unchanged', async () => {
    const commentary = { type: 'message', role: 'assistant', phase: 'commentary', content: [{ type: 'output_text', text: 'Checking the quote.' }] };
    const { transport, result } = run([turn([reasoning, commentary, call]), turn([message('{"ok":true}')])]);
    await result;
    const second = transport.bodies[1].input;
    expect(second.map((i) => i.type ?? i.role)).toEqual(['user', 'reasoning', 'message', 'function_call', 'function_call_output']);
    expect(second[2]).toEqual(commentary);
  });

  it('keeps a reasoning summary the model already sent', async () => {
    const summarised = { ...reasoning, summary: [{ type: 'summary_text', text: 'Checking the quote.' }] };
    const { transport, result } = run([turn([summarised, call]), turn([message('{"ok":true}')])]);
    await result;
    expect(transport.bodies[1].input[1]).toEqual(summarised);
  });

  it('names the document and the host on the receipt', async () => {
    const receipts = [];
    const runStep = createLoop({ provider: { ...provider, host: 'api.meta.ai' }, transport: fakeTransport([turn([message('{"ok":true}')])]), safetyIdentifier: null });
    await runStep({ step: 'draft', docId: 'answer', prompt: 'x', schema: {}, toolContext: { sources: [] }, effort: 'medium', maxOutputTokens: 10, emit: (e) => { if (e.type === 'receipt') receipts.push(e.receipt); } });
    expect(receipts[0]).toMatchObject({ step: 'draft', docId: 'answer', host: 'api.meta.ai' });
    const { receipts: plain } = run([turn([message('{"ok":true}')])]);
    await new Promise((r) => setTimeout(r, 0));
    expect(plain[0]).not.toHaveProperty('docId');
    expect(plain[0]).not.toHaveProperty('host');
  });

  it('keeps the first output time, unsettled attempts and injected faults on the receipt', async () => {
    const { result, receipts } = run([turn([reasoning, call], { unsettled: 1, injectedFaults: 1, timings: { firstEventMs: 300, firstOutputMs: 1800, totalMs: 2500 } }), turn([message('{"ok":true}')])]);
    await result;
    expect(receipts[0]).toMatchObject({ firstEventMs: 300, firstOutputMs: 1800, unsettled: 1, injectedFaults: 1 });
  });

  it('says the cost is unknown when a turn had no usage, and counts a failed attempt that may have run', async () => {
    const unknownCost = run([turn([message('{"ok":true}')], { costUsd: null })]);
    await unknownCost.result;
    expect(unknownCost.receipts[0].costUsd).toBeNull();
    const transport = { respond: async () => { throw Object.assign(new Error('The model took too long to start.'), { code: 'timeout', unsettled: 2 }); } };
    const receipts = [];
    const runStep = createLoop({ provider, transport });
    await expect(runStep({ step: 'draft', prompt: 'x', schema: {}, toolContext: { sources: [] }, effort: 'medium', maxOutputTokens: 10, emit: (e) => { if (e.type === 'receipt') receipts.push(e.receipt); } })).rejects.toMatchObject({ code: 'timeout' });
    expect(receipts[0]).toMatchObject({ error: 'timeout', unsettled: 2, costUsd: null });
  });

  it('stops after six tool turns and says so on the receipt', async () => {
    const { transport, result, receipts } = run(Array.from({ length: 7 }, () => turn([call])));
    await expect(result).rejects.toMatchObject({ code: 'failed' });
    expect(transport.bodies).toHaveLength(6);
    expect(receipts[0]).toMatchObject({ turns: 6, error: 'failed' });
  });

  it('turns a refusal or an answer that is not JSON into a safe error', async () => {
    await expect(run([turn([{ type: 'message', content: [{ type: 'refusal', refusal: 'No.' }] }])]).result).rejects.toMatchObject({ code: 'refused' });
    await expect(run([turn([message('not json')])]).result).rejects.toMatchObject({ code: 'invalid-output' });
  });
});
