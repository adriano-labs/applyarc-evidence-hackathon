import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createLedger } from '../../server/agent/budget.js';
import { createTransport, ProviderError } from '../../server/agent/transport.js';

const encoder = new TextEncoder();
const provider = { id: 'meta', baseUrl: 'https://api.example.test/v1', model: 'muse-spark-1.3', headers: () => ({ authorization: 'Bearer test-key' }) };
const usage = { input_tokens: 1000, input_tokens_details: { cached_tokens: 200 }, output_tokens: 300, output_tokens_details: { reasoning_tokens: 100 } };
const completed = { id: 'resp_1', model: 'muse-spark-1.3', status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '{"ok":true}' }] }], usage };

function sse(events, { end = true } = {}) {
  const text = events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join('') + (end ? 'data: [DONE]\n\n' : '');
  return new ReadableStream({ start(c) { c.enqueue(encoder.encode(text)); c.close(); } });
}
const ok = (events = [['response.created', { type: 'response.created' }], ['response.output_text.delta', { type: 'response.output_text.delta', delta: '{"ok":' }], ['response.completed', { type: 'response.completed', response: completed }]], headers = {}) =>
  new Response(sse(events), { status: 200, headers: { 'content-type': 'text/event-stream', 'x-request-id': 'req-123', 'x-ratelimit-remaining-requests': '2999', 'x-ratelimit-remaining-tokens': '3990000', ...headers } });
const status = (code, headers = {}, body = { error: { message: `status ${code}` } }) =>
  new Response(JSON.stringify(body), { status: code, headers: { 'content-type': 'application/json', ...headers } });

function setup(responses, { capUsd = 2, deadlineMs = 60000 } = {}) {
  const calls = [];
  const waits = [];
  const fetch = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return typeof next === 'function' ? next(init) : next;
  };
  const ledger = createLedger({ file: join(mkdtempSync(join(tmpdir(), 'tr-')), 'ledger.json'), capUsd });
  const transport = createTransport({ provider, fetch, ledger, sleep: async (ms) => { waits.push(ms); }, deadlineMs, random: () => 0 });
  return { transport, calls, waits, ledger };
}
const body = { input: [{ role: 'user', content: 'hello' }], max_output_tokens: 2000 };
const statuses = (ledger) => ledger.summary().entries.map((e) => e.status);

describe('transport', () => {
  it('streams one call to <baseUrl>/responses and settles the real cost', async () => {
    const { transport, calls, ledger } = setup([ok()]);
    const events = [];
    const result = await transport.respond(body, { callId: 'c1', onEvent: (e) => events.push(e) });
    expect(calls[0].url).toBe('https://api.example.test/v1/responses');
    expect(calls[0].init.headers).toMatchObject({ authorization: 'Bearer test-key', 'content-type': 'application/json', accept: 'text/event-stream' });
    expect(calls[0].body).toMatchObject({ ...body, model: 'muse-spark-1.3', stream: true });
    expect(result.response).toEqual(completed);
    expect(result).toMatchObject({ requestId: 'req-123', attempts: 1, rateLimit: { remainingRequests: 2999, remainingTokens: 3990000 } });
    expect(result.costUsd).toBeCloseTo((800 * 1.25 + 200 * 0.15 + 300 * 4.25) / 1e6, 12);
    expect(result.timings.firstEventMs).toBeGreaterThanOrEqual(0);
    expect(statuses(ledger)).toEqual(['settled']);
    expect(ledger.summary().spentUsd).toBeCloseTo(result.costUsd, 6);
    expect(events.map((e) => e.type)).toEqual(['attempt', 'first-event', 'delta', 'completed']);
  });

  it('says plainly when the key has no billing, and charges nothing', async () => {
    const { transport, calls, ledger } = setup([status(402, {}, { error: { code: 'billing_not_configured', message: 'Billing is not configured.' } })]);
    await expect(transport.respond(body, { callId: 'c1' })).rejects.toMatchObject({ code: 'billing', status: 402, message: 'Billing is not active for this key yet. Nothing was sent.' });
    expect(calls).toHaveLength(1);
    expect(statuses(ledger)).toEqual(['released']);
  });

  it('counts the attempts that may have run and stay unsettled', async () => {
    expect((await setup([status(500), ok()]).transport.respond(body, { callId: 'c1' })).unsettled).toBe(1);
    expect((await setup([status(429, { 'retry-after': '0' }), ok()]).transport.respond(body, { callId: 'c1' })).unsettled).toBe(0);
    await expect(setup([status(504)]).transport.respond(body, { callId: 'c1' })).rejects.toMatchObject({ code: 'timeout', unsettled: 1 });
    await expect(setup([status(400)]).transport.respond(body, { callId: 'c1' })).rejects.toMatchObject({ code: 'invalid', unsettled: 0 });
  });

  it('labels a demo-injected 429 as injected, on the retry event and the result', async () => {
    const { transport } = setup([status(429, { 'retry-after': '0', 'x-demo-fault': '429-once' }), ok()]);
    const events = [];
    const result = await transport.respond(body, { callId: 'c1', onEvent: (e) => events.push(e) });
    expect(events.find((e) => e.type === 'retry')).toMatchObject({ attempt: 1, status: 429, injected: true });
    expect(result.injectedFaults).toBe(1);
  });

  it('says a 404 is a model name the service does not know', async () => {
    const { transport } = setup([status(404)]);
    await expect(transport.respond(body, { callId: 'c1' })).rejects.toMatchObject({ code: 'not-found', message: 'The model service does not know this model name. Nothing was changed.' });
  });

  it('refuses before sending anything when the worst case would pass the cap', async () => {
    const { transport, calls } = setup([ok()], { capUsd: 0.001 });
    await expect(transport.respond(body, { callId: 'c1' })).rejects.toMatchObject({ code: 'cap' });
    expect(calls).toHaveLength(0);
  });

  it('waits for Retry-After on a 429, releases that attempt, then succeeds', async () => {
    const { transport, waits, ledger } = setup([status(429, { 'retry-after': '2' }), ok()]);
    const events = [];
    const result = await transport.respond(body, { callId: 'c1', onEvent: (e) => events.push(e) });
    expect(result.attempts).toBe(2);
    expect(waits).toEqual([2000]);
    expect(statuses(ledger)).toEqual(['released', 'settled']);
    expect(events.find((e) => e.type === 'retry')).toMatchObject({ attempt: 1, status: 429, waitMs: 2000 });
  });

  it('backs off exponentially without Retry-After and stops after three attempts', async () => {
    const { transport, waits, calls, ledger } = setup([status(503), status(503), status(503), ok()]);
    const error = await transport.respond(body, { callId: 'c1' }).catch((e) => e);
    expect(error).toBeInstanceOf(ProviderError);
    expect(error).toMatchObject({ code: 'busy', status: 503 });
    expect(calls).toHaveLength(3);
    expect(waits).toEqual([1000, 2000]);
    expect(statuses(ledger)).toEqual(['released', 'released', 'released']);
  });

  it('retries a 500 but keeps that attempt charged, since it may have run', async () => {
    const { transport, ledger } = setup([status(500), ok()]);
    await transport.respond(body, { callId: 'c1' });
    expect(statuses(ledger)).toEqual(['unknown', 'settled']);
  });

  it('gives up at once when the wait would pass the deadline', async () => {
    const { transport, calls, waits } = setup([status(429, { 'retry-after': '120' }), ok()], { deadlineMs: 30000 });
    await expect(transport.respond(body, { callId: 'c1' })).rejects.toMatchObject({ code: 'busy' });
    expect(calls).toHaveLength(1);
    expect(waits).toEqual([]);
  });

  it('never retries a 504 and keeps it charged', async () => {
    const { transport, calls, ledger } = setup([status(504), ok()]);
    await expect(transport.respond(body, { callId: 'c1' })).rejects.toMatchObject({ code: 'timeout', status: 504 });
    expect(calls).toHaveLength(1);
    expect(statuses(ledger)).toEqual(['unknown']);
  });

  it('never retries a stream that stops before the end, and keeps it charged', async () => {
    const cut = new Response(sse([['response.created', { type: 'response.created' }], ['response.output_text.delta', { type: 'response.output_text.delta', delta: '{"o' }]], { end: false }), { status: 200 });
    const { transport, calls, ledger } = setup([cut, ok()]);
    const error = await transport.respond(body, { callId: 'c1' }).catch((e) => e);
    expect(error).toMatchObject({ code: 'cut', message: 'The answer stopped. Nothing was changed. Try again.' });
    expect(calls).toHaveLength(1);
    expect(statuses(ledger)).toEqual(['unknown']);
  });

  it('never retries a network failure, and keeps it charged', async () => {
    const { transport, calls, ledger } = setup([new TypeError('fetch failed'), ok()]);
    await expect(transport.respond(body, { callId: 'c1' })).rejects.toMatchObject({ code: 'network' });
    expect(calls).toHaveLength(1);
    expect(statuses(ledger)).toEqual(['unknown']);
  });

  it('settles the real usage of a failed or incomplete response and does not retry it', async () => {
    const failed = { ...completed, status: 'failed', error: { code: 'server_error', message: 'boom' } };
    const { transport, calls, ledger } = setup([ok([['response.failed', { type: 'response.failed', response: failed }]]), ok()]);
    await expect(transport.respond(body, { callId: 'c1' })).rejects.toMatchObject({ code: 'failed' });
    const incomplete = { ...completed, status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } };
    const second = setup([ok([['response.incomplete', { type: 'response.incomplete', response: incomplete }]])]);
    await expect(second.transport.respond(body, { callId: 'c2' })).rejects.toMatchObject({ code: 'incomplete', message: expect.stringMatching(/max_output_tokens/) });
    expect(calls).toHaveLength(1);
    expect(statuses(ledger)).toEqual(['settled']);
    expect(statuses(second.ledger)).toEqual(['settled']);
  });

  it('maps refusals it must not retry, and releases them', async () => {
    for (const [code, expected] of [[400, 'invalid'], [401, 'auth'], [403, 'auth'], [404, 'not-found'], [422, 'invalid']]) {
      const { transport, calls, ledger } = setup([status(code), ok()]);
      await expect(transport.respond(body, { callId: 'c1' })).rejects.toMatchObject({ code: expected, status: code });
      expect(calls).toHaveLength(1);
      expect(statuses(ledger)).toEqual(['released']);
    }
  });

  it('never puts the key or the raw provider body in an error message', async () => {
    const { transport } = setup([status(401, {}, { error: { message: 'Invalid key Bearer test-key' } })]);
    const error = await transport.respond(body, { callId: 'c1' }).catch((e) => e);
    expect(error.message).not.toMatch(/test-key/);
  });
});

describe('transport timing and cancellation', () => {
  // A stream that hands out one event per read, moving a fake clock 100 ms each time.
  function paced(clock, events) {
    let i = 0;
    return new ReadableStream({
      pull(c) {
        if (i === events.length) { c.close(); return; }
        clock.t += 100;
        const [event, data] = events[i++];
        c.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      },
    }, { highWaterMark: 0 });
  }

  it('records the time of the first event, not of the completion', async () => {
    const clock = { t: 0 };
    const events = [['response.created', { type: 'response.created' }], ['response.output_text.delta', { type: 'response.output_text.delta', delta: 'x' }], ['response.completed', { type: 'response.completed', response: completed }]];
    const ledger = createLedger({ file: join(mkdtempSync(join(tmpdir(), 'tr-')), 'ledger.json'), capUsd: 2 });
    const transport = createTransport({ provider, ledger, now: () => clock.t, fetch: async () => new Response(paced(clock, events), { status: 200 }) });
    const result = await transport.respond(body, { callId: 'c1' });
    // response.created is the first event; the first text delta is the first output.
    expect(result.timings).toEqual({ firstEventMs: 100, firstOutputMs: 200, totalMs: 300 });
  });

  // Like a real fetch body: silent until the request is aborted, then it errors.
  const silent = (_url, init) => new Response(new ReadableStream({ start(c) { init.signal.addEventListener('abort', () => c.error(new Error('aborted'))); } }), { status: 200 });
  const stalling = (responses, opts = {}) => {
    const calls = [];
    const waits = [];
    const ledger = createLedger({ file: join(mkdtempSync(join(tmpdir(), 'tr-')), 'ledger.json'), capUsd: 2 });
    const fetch = async (url, init) => { calls.push(url); const next = responses.shift(); return typeof next === 'function' ? next(url, init) : next; };
    const transport = createTransport({ provider, ledger, fetch, firstEventTimeoutMs: 20, sleep: async (ms) => { waits.push(ms); }, ...opts });
    return { transport, ledger, calls, waits };
  };

  it('tries once more straight away when the first event never comes, keeping the stalled attempt charged', async () => {
    const { transport, ledger, calls, waits } = stalling([silent, ok()]);
    const events = [];
    const result = await transport.respond(body, { callId: 'c1', onEvent: (e) => events.push(e) });
    expect(result.attempts).toBe(2);
    expect(calls).toHaveLength(2);
    expect(waits).toEqual([]);
    expect(statuses(ledger)).toEqual(['unknown', 'settled']);
    expect(events.filter((e) => e.type === 'retry')).toEqual([{ type: 'retry', attempt: 1, status: null, reason: 'stall', waitMs: 0 }]);
  });

  it('calls it a timeout, kept charged, when another stall would pass the deadline', async () => {
    const { transport, ledger, calls } = stalling([silent, ok()], { deadlineMs: 30 });
    await expect(transport.respond(body, { callId: 'c1' })).rejects.toMatchObject({ code: 'timeout', status: null });
    expect(calls).toHaveLength(1);
    expect(statuses(ledger)).toEqual(['unknown']);
  });

  it('stops after three stalled attempts', async () => {
    const { transport, ledger, calls } = stalling([silent, silent, silent, ok()]);
    await expect(transport.respond(body, { callId: 'c1' })).rejects.toMatchObject({ code: 'timeout' });
    expect(calls).toHaveLength(3);
    expect(statuses(ledger)).toEqual(['unknown', 'unknown', 'unknown']);
  });

  it('never retries a 504 or a cancel', async () => {
    const gateway = stalling([status(504), ok()]);
    await expect(gateway.transport.respond(body, { callId: 'c1' })).rejects.toMatchObject({ code: 'timeout', status: 504 });
    expect(gateway.calls).toHaveLength(1);
    const caller = new AbortController();
    const cancelled = stalling([(url, init) => { setTimeout(() => caller.abort(), 5); return silent(url, init); }, ok()]);
    await expect(cancelled.transport.respond(body, { callId: 'c2', signal: caller.signal })).rejects.toMatchObject({ code: 'cancelled' });
    expect(cancelled.calls).toHaveLength(1);
  });

  it('lets the caller cancel while the answer is streaming', async () => {
    const caller = new AbortController();
    let sent = 0;
    const endless = new ReadableStream({
      pull(c) {
        sent += 1;
        if (sent === 3) caller.abort();
        c.enqueue(encoder.encode(`event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"x"}\n\n`));
      },
    });
    const ledger = createLedger({ file: join(mkdtempSync(join(tmpdir(), 'tr-')), 'ledger.json'), capUsd: 2 });
    const transport = createTransport({ provider, ledger, fetch: async () => new Response(endless, { status: 200 }) });
    await expect(transport.respond(body, { callId: 'c1', signal: caller.signal })).rejects.toMatchObject({ code: 'cancelled' });
    expect(statuses(ledger)).toEqual(['unknown']);
    expect(sent).toBeLessThan(10);
  });
});

describe('transport over Chat Completions', () => {
  const chatProvider = { ...provider, id: 'compatible', wire: 'chat', model: 'stand-in', priceModel: 'muse-spark-1.3' };
  const chunks = (list) => new ReadableStream({ start(c) { c.enqueue(encoder.encode(list.map((x) => `data: ${typeof x === 'string' ? x : JSON.stringify(x)}\n\n`).join(''))); c.close(); } });
  const delta = (content, finish = null) => ({ id: 'm-1', model: 'stand-in', choices: [{ delta: { content }, finish_reason: finish }] });

  it('calls /chat/completions and returns a Responses-shaped answer with its real cost', async () => {
    const usageChunk = { id: 'm-1', model: 'stand-in', choices: [], usage: { prompt_tokens: 1000, completion_tokens: 100, prompt_tokens_details: { cached_tokens: 0 }, completion_tokens_details: { reasoning_tokens: 40 } } };
    const calls = [];
    const ledger = createLedger({ file: join(mkdtempSync(join(tmpdir(), 'tr-')), 'ledger.json'), capUsd: 2 });
    const transport = createTransport({ provider: chatProvider, ledger, fetch: async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return new Response(chunks([delta('{"ok":'), delta('true}', 'stop'), usageChunk, '[DONE]']), { status: 200 }); } });
    const result = await transport.respond({ ...body, instructions: 'x', text: { format: { schema: { type: 'object' } } } }, { callId: 'c1' });
    expect(calls[0].url).toBe('https://api.example.test/v1/chat/completions');
    expect(calls[0].body).toMatchObject({ model: 'stand-in', stream: true });
    expect(result.response.output[0].content[0].text).toBe('{"ok":true}');
    expect(result.costUsd).toBeCloseTo((1000 * 1.25 + 100 * 4.25) / 1e6, 12);
    expect(statuses(ledger)).toEqual(['settled']);
  });

  it('keeps the whole reservation charged when the stream never reports usage', async () => {
    const ledger = createLedger({ file: join(mkdtempSync(join(tmpdir(), 'tr-')), 'ledger.json'), capUsd: 2 });
    const transport = createTransport({ provider: chatProvider, ledger, fetch: async () => new Response(chunks([delta('{"ok":true}', 'stop'), '[DONE]']), { status: 200 }) });
    const result = await transport.respond({ ...body, instructions: 'x', text: { format: { schema: { type: 'object' } } } }, { callId: 'c1' });
    expect(result.costUsd).toBeNull();
    expect(statuses(ledger)).toEqual(['unknown']);
  });

  it('treats [DONE] before any finish reason as a cut stream', async () => {
    const ledger = createLedger({ file: join(mkdtempSync(join(tmpdir(), 'tr-')), 'ledger.json'), capUsd: 2 });
    const transport = createTransport({ provider: chatProvider, ledger, fetch: async () => new Response(chunks([delta('{"ok":'), '[DONE]']), { status: 200 }) });
    await expect(transport.respond({ ...body, instructions: 'x', text: { format: { schema: { type: 'object' } } } }, { callId: 'c1' })).rejects.toMatchObject({ code: 'cut' });
    expect(statuses(ledger)).toEqual(['unknown']);
  });
});

describe('a stream that stalls after it has started', () => {
  const event = (type, data = { type }) => encoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  const transportWith = (responses, opts) => {
    const calls = [];
    const ledger = createLedger({ file: join(mkdtempSync(join(tmpdir(), 'tr-')), 'ledger.json'), capUsd: 2 });
    const fetch = async (url, init) => { calls.push(url); const next = responses.shift(); return typeof next === 'function' ? next(url, init) : next; };
    return { transport: createTransport({ provider, ledger, fetch, sleep: async () => {}, ...opts }), ledger, calls };
  };
  // Sends its first event, then stays silent until the request is aborted.
  const stallsAfterFirst = (_url, init) => new Response(new ReadableStream({ start(c) {
    c.enqueue(event('response.created'));
    init.signal.addEventListener('abort', () => c.error(new Error('aborted')));
  } }), { status: 200 });
  // Sends every event after a pause shorter than the stall limit.
  const trickle = (gapMs) => () => {
    const events = [['response.created'], ['response.output_text.delta', { type: 'response.output_text.delta', delta: '{"ok":' }],
      ...Array.from({ length: 8 }, () => ['response.output_text.delta', { type: 'response.output_text.delta', delta: ' ' }]),
      ['response.output_text.delta', { type: 'response.output_text.delta', delta: 'true}' }], ['response.completed', { type: 'response.completed', response: completed }]];
    let i = 0;
    return new Response(new ReadableStream({ async pull(c) {
      if (i === events.length) { c.close(); return; }
      if (i > 0) await new Promise((r) => setTimeout(r, gapMs));
      const [type, data] = events[i++];
      c.enqueue(event(type, data));
    } }, { highWaterMark: 0 }), { status: 200 });
  };

  it('ends it within the stall limit, keeps it charged and does not retry it', async () => {
    const { transport, ledger, calls } = transportWith([stallsAfterFirst, ok()], { stallTimeoutMs: 30 });
    const started = Date.now();
    await expect(transport.respond(body, { callId: 'c1' })).rejects.toMatchObject({ code: 'timeout', status: null });
    expect(Date.now() - started).toBeLessThan(1000);
    expect(calls).toHaveLength(1);
    expect(statuses(ledger)).toEqual(['unknown']);
  });

  it('lets a stream run past the stall limit while its events keep coming', async () => {
    const { transport, ledger } = transportWith([trickle(50)], { stallTimeoutMs: 400 });
    const result = await transport.respond(body, { callId: 'c1' });
    expect(result.attempts).toBe(1);
    expect(statuses(ledger)).toEqual(['settled']);
  });
});
