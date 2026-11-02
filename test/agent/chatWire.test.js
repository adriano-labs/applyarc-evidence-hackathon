import { describe, expect, it } from 'vitest';
import { createChatAccumulator, toChatBody } from '../../server/agent/chatWire.js';

const schema = { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false };
const body = {
  instructions: 'Be careful.',
  input: [{ role: 'user', content: 'Hello' }, { type: 'reasoning', encrypted_content: 'x' }],
  tools: [{ type: 'function', name: 'word_count' }],
  text: { format: { type: 'json_schema', name: 'applyarc_check', schema, strict: true } },
  reasoning: { effort: 'xhigh' },
  max_output_tokens: 3000,
  store: false,
};
const chunk = (delta, extra = {}) => ({ id: 'chat-1', model: 'stand-in-model', choices: [{ index: 0, delta, finish_reason: null, ...extra }] });

describe('toChatBody', () => {
  it('turns a Responses request into a streamed Chat Completions request with the schema in the system message', () => {
    const chat = toChatBody(body, 'stand-in-model-v2');
    expect(chat).toEqual({
      model: 'stand-in-model-v2',
      stream: true,
      stream_options: { include_usage: true },
      reasoning_effort: 'xhigh',
      max_completion_tokens: 3000,
      messages: [
        { role: 'system', content: `Be careful.\n\nReply with JSON only: no prose and no code fences. It must match this JSON Schema exactly:\n${JSON.stringify(schema)}` },
        { role: 'user', content: 'Hello' },
      ],
    });
  });
});

describe('toChatBody with structured output', () => {
  it('sends the schema as a strict response_format and keeps the system message to the instructions', () => {
    const chat = toChatBody(body, 'meta-models/Muse-Spark-Open-816B-A42B', { structured: true });
    expect(chat.response_format).toEqual({ type: 'json_schema', json_schema: { name: 'applyarc_check', schema, strict: true } });
    expect(chat.messages[0]).toEqual({ role: 'system', content: 'Be careful.' });
  });

  it('leaves out reasoning_effort for a model without reasoning', () => {
    const { reasoning, ...noReasoning } = body;
    expect('reasoning_effort' in toChatBody(noReasoning, 'meta-models/Muse-Spark-Open-816B-A42B', { structured: true })).toBe(false);
  });
});

describe('createChatAccumulator', () => {
  it('builds a Responses-shaped completed response from streamed chunks and the usage chunk', () => {
    const acc = createChatAccumulator();
    acc.add(chunk({ role: 'assistant', content: '{"ok":' }));
    acc.add(chunk({ content: 'true}' }));
    acc.add(chunk({}, { finish_reason: 'stop' }));
    acc.add({ id: 'chat-1', model: 'stand-in-model', choices: [], usage: { prompt_tokens: 50, completion_tokens: 20, prompt_tokens_details: { cached_tokens: 10 }, completion_tokens_details: { reasoning_tokens: 12 } } });
    expect(acc.deltaChars()).toBe(11);
    expect(acc.finished()).toBe(true);
    expect(acc.result()).toEqual({
      id: 'chat-1',
      model: 'stand-in-model',
      status: 'completed',
      output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '{"ok":true}' }] }],
      usage: { input_tokens: 50, input_tokens_details: { cached_tokens: 10 }, output_tokens: 20, output_tokens_details: { reasoning_tokens: 12 } },
    });
  });

  it('strips a code fence around the JSON', () => {
    const acc = createChatAccumulator();
    acc.add(chunk({ content: '```json\n{"ok":true}\n```' }, { finish_reason: 'stop' }));
    expect(acc.result().output[0].content[0].text).toBe('{"ok":true}');
  });

  it('marks a reply cut by the token limit as incomplete, and a filtered one as failed', () => {
    const cut = createChatAccumulator();
    cut.add(chunk({ content: '{"ok":' }, { finish_reason: 'length' }));
    expect(cut.result()).toMatchObject({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } });
    const filtered = createChatAccumulator();
    filtered.add(chunk({ content: '' }, { finish_reason: 'content_filter' }));
    expect(filtered.result()).toMatchObject({ status: 'failed', error: { code: 'content_filter' } });
  });

  it('flags a stream that never reported usage', () => {
    const acc = createChatAccumulator();
    acc.add(chunk({ content: '{"ok":true}' }, { finish_reason: 'stop' }));
    expect(acc.result()).toMatchObject({ status: 'completed', usageMissing: true });
  });

  it('is not finished until a finish reason arrives', () => {
    const acc = createChatAccumulator();
    acc.add(chunk({ content: '{"ok":' }));
    expect(acc.finished()).toBe(false);
  });
});
