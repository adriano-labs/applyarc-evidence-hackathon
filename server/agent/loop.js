// One model step as a tool-using loop: send, run any tool calls the model
// makes, send their results back (with the encrypted reasoning, so nothing is
// stored at the provider), until the model returns its structured answer.
// Every turn's cost lands on one receipt, even when the step fails.
import { randomUUID } from 'node:crypto';
import { INSTRUCTIONS } from './prompts.js';
import { runTool, TOOL_DEFINITIONS } from './tools.js';
import { ProviderError } from './transport.js';

const MAX_TURNS = 6;

const NO_TOOLS = '\n\nNo tools are available on this model: check every quote and word count yourself.';

export function requestBody({ provider, step, input, schema, effort, maxOutputTokens, safetyIdentifier, tools }) {
  const toolList = tools ? tools.map((name) => TOOL_DEFINITIONS.find((t) => t.name === name)).filter(Boolean) : TOOL_DEFINITIONS;
  return {
    instructions: provider.wire === 'chat' ? INSTRUCTIONS + NO_TOOLS : INSTRUCTIONS,
    input,
    tools: toolList,
    tool_choice: 'auto',
    parallel_tool_calls: true,
    text: { format: { type: 'json_schema', name: `applyarc_${step}`, schema, strict: true } },
    ...(provider.reasoning === false ? {} : { reasoning: { effort } }),
    max_output_tokens: maxOutputTokens,
    store: false,
    include: ['reasoning.encrypted_content'],
    truncation: 'disabled',
    ...(provider.promptCacheKey ? { prompt_cache_key: `applyarc-evidence-${step}` } : {}),
    ...(safetyIdentifier && provider.safetyIdentifier ? { safety_identifier: safetyIdentifier } : {}),
  };
}

function finalAnswer(output) {
  const message = output.find((o) => o.type === 'message');
  const parts = message?.content ?? [];
  if (parts.some((p) => p.type === 'refusal')) throw new ProviderError('refused', 'The model declined this step. Nothing was changed.');
  const text = parts.filter((p) => p.type === 'output_text').map((p) => p.text).join('');
  try {
    return JSON.parse(text);
  } catch {
    throw new ProviderError('invalid-output', 'The model’s answer was not valid. Nothing was changed. Try again.');
  }
}

// `docId` names the document a draft or revise step wrote; `host` is where the call went.
function newReceipt(provider, step, effort, docId) {
  return {
    step, ...(docId ? { docId } : {}), provider: provider.id, isMeta: Boolean(provider.isMeta), model: provider.model,
    ...(provider.host ? { host: provider.host } : {}), effort, turns: 0, attempts: 0,
    requestIds: [], toolCalls: [], usage: { input: 0, cached: 0, output: 0, reasoning: 0 }, costUsd: 0,
    firstEventMs: null, firstOutputMs: null, totalMs: 0, rateLimit: null, unsettled: 0, injectedFaults: 0,
  };
}

function addTurn(receipt, result) {
  const u = result.usage;
  receipt.turns += 1;
  receipt.attempts += result.attempts;
  receipt.model = result.model;
  receipt.requestIds.push(result.requestId);
  receipt.usage.input += u.input_tokens ?? 0;
  receipt.usage.cached += u.input_tokens_details?.cached_tokens ?? 0;
  receipt.usage.output += u.output_tokens ?? 0;
  receipt.usage.reasoning += u.output_tokens_details?.reasoning_tokens ?? 0;
  // One turn with no usage makes the step's cost unknown.
  receipt.costUsd = result.costUsd === null || receipt.costUsd === null ? null : receipt.costUsd + result.costUsd;
  receipt.firstEventMs ??= result.timings.firstEventMs;
  receipt.firstOutputMs ??= result.timings.firstOutputMs ?? null;
  receipt.rateLimit = result.rateLimit;
  receipt.unsettled += result.unsettled ?? 0;
  receipt.injectedFaults += result.injectedFaults ?? 0;
}

function runCalls(calls, toolContext, receipt, emit) {
  return calls.map((call) => {
    let args = {};
    try { args = JSON.parse(call.arguments || '{}'); } catch { /* the tool reports the bad call */ }
    const result = runTool(call.name, args, toolContext);
    const note = call.name === 'verify_quote' ? (result.verbatim ? 'verbatim' : 'not verbatim') : call.name === 'word_count' ? (result.limit == null ? `${result.words} words` : `${result.words} of ${result.limit}`) : 'read';
    receipt.toolCalls.push({ name: call.name, ok: !result.error, note });
    emit({ type: 'tool', name: call.name, note });
    return { type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(result) };
  });
}

export function createLoop({ provider, transport, safetyIdentifier, now = () => Date.now() }) {
  return async function runStep({ step, prompt, schema, toolContext, effort, maxOutputTokens, emit = () => {}, tools, docId }) {
    const callId = `${step}-${randomUUID().slice(0, 8)}`;
    const receipt = newReceipt(provider, step, effort, docId);
    const started = now();
    let input = [{ role: 'user', content: prompt }];
    try {
      for (let turn = 1; turn <= MAX_TURNS; turn += 1) {
        let currentInput = input;
        if (turn === MAX_TURNS) {
          currentInput = [...input, { role: 'user', content: 'This is your last turn. Reply now with only the JSON answer; do not call a tool.' }];
        }
        const body = requestBody({ provider, step, input: currentInput, schema, effort, maxOutputTokens, safetyIdentifier, tools });
        const result = await transport.respond(body, { callId: `${callId}-t${turn}`, onEvent: (e) => emit({ ...e, type: 'model', event: e.type, step, turn }) });
        addTurn(receipt, result);
        const output = result.response.output ?? [];
        const calls = output.filter((o) => o.type === 'function_call');
        if (!calls.length) return finalAnswer(output);
        const outputWithSummary = output.map((item) => (item?.type === 'reasoning' ? { ...item, summary: item.summary ?? [] } : item));
        input = [...currentInput, ...outputWithSummary, ...runCalls(calls, toolContext, receipt, emit)];
      }
      throw new ProviderError('failed', 'The model kept calling tools without finishing. Nothing was changed. Try again.');
    } catch (error) {
      receipt.error = error.code ?? 'internal';
      // A billed answer that failed or was cut short keeps its tokens and cost here;
      // a failed step that left an attempt that may have run has no known cost.
      if (error.turn) addTurn(receipt, error.turn);
      else receipt.unsettled += error.unsettled ?? 0;
      if (receipt.unsettled > 0) receipt.costUsd = null;
      throw error;
    } finally {
      receipt.totalMs = now() - started;
      emit({ type: 'receipt', receipt });
    }
  };
}
