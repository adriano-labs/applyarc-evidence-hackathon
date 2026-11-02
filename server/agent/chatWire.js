// Translate between the Responses API the app speaks and Chat Completions,
// for a model with no structured-output mode and no native tool calls: the
// schema goes into the system message, and the streamed chunks come back as
// a Responses-shaped final response.
export function toChatBody(body, model, { structured = false } = {}) {
  const system = structured
    ? body.instructions
    : `${body.instructions}\n\nReply with JSON only: no prose and no code fences. It must match this JSON Schema exactly:\n${JSON.stringify(body.text.format.schema)}`;
  const messages = (body.input ?? []).filter((i) => i?.role === 'user' || i?.role === 'system').map(({ role, content }) => ({ role, content }));
  const chat = {
    model,
    stream: true,
    stream_options: { include_usage: true },
    reasoning_effort: body.reasoning?.effort,
    max_completion_tokens: body.max_output_tokens,
    messages: [{ role: 'system', content: system }, ...messages],
    ...(structured
      ? { response_format: { type: 'json_schema', json_schema: { name: body.text.format.name, schema: body.text.format.schema, strict: true } } }
      : {}),
  };
  return Object.fromEntries(Object.entries(chat).filter(([, v]) => v !== undefined));
}

function stripFence(text) {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) return text;
  return trimmed.replace(/^```[^\n]*\n?/, '').replace(/\n?```$/, '').trim();
}

function statusOf(finishReason) {
  if (finishReason === 'stop') return { status: 'completed' };
  if (finishReason === 'length') return { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } };
  return { status: 'failed', error: { code: finishReason ?? 'unfinished' } };
}

// A stream that never reported usage is flagged, so the transport keeps the
// call's whole reservation charged instead of charging nothing.
function usageOf(u) {
  if (!u) return { usage: { input_tokens: 0, input_tokens_details: { cached_tokens: 0 }, output_tokens: 0, output_tokens_details: { reasoning_tokens: 0 } }, usageMissing: true };
  return {
    usage: {
      input_tokens: u.prompt_tokens ?? 0,
      input_tokens_details: { cached_tokens: u.prompt_tokens_details?.cached_tokens ?? 0 },
      output_tokens: u.completion_tokens ?? 0,
      output_tokens_details: { reasoning_tokens: u.completion_tokens_details?.reasoning_tokens ?? 0 },
    },
  };
}

export function createChatAccumulator() {
  const state = { id: '', model: '', finishReason: null, usage: null, parts: [], chars: 0 };
  return {
    add(chunk) {
      if (chunk?.id) state.id = chunk.id;
      if (chunk?.model) state.model = chunk.model;
      if (chunk?.usage) state.usage = chunk.usage;
      const choice = chunk?.choices?.[0];
      if (choice?.finish_reason) state.finishReason = choice.finish_reason;
      const content = choice?.delta?.content;
      if (content) {
        state.parts.push(content);
        state.chars += content.length;
      }
    },
    deltaChars: () => state.chars,
    finished: () => state.finishReason !== null,
    result: () => ({
      id: state.id,
      model: state.model,
      ...statusOf(state.finishReason),
      output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: stripFence(state.parts.join('')) }] }],
      ...usageOf(state.usage),
    }),
  };
}
