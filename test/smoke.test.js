// The first-call gate for a new Meta key: list the models, then one small real step.
import { describe, expect, it } from 'vitest';
import { runSmoke } from '../scripts/smoke.mjs';

const encoder = new TextEncoder();
const env = { PROVIDER: 'meta', META_API_KEY: 'test-key' };
const answer = { facts: [{ statement: 'Built a GPU job runner.', quote: 'We built a self-service GPU job runner', requirementIds: ['goal'] }], conflicts: [] };
const completed = {
  id: 'resp_1', model: 'muse-spark-1.3', status: 'completed',
  output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(answer) }] }],
  usage: { input_tokens: 900, input_tokens_details: { cached_tokens: 0 }, output_tokens: 120, output_tokens_details: { reasoning_tokens: 40 } },
};
const sse = (events) => new ReadableStream({ start(c) { c.enqueue(encoder.encode(events.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join(''))); c.close(); } });

function fakeFetch(models) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method ?? 'GET', auth: init.headers?.authorization });
    if (String(url).endsWith('/models')) return new Response(JSON.stringify({ object: 'list', data: models.map((id) => ({ id, object: 'model' })) }), { status: 200 });
    return new Response(sse([['response.created', { type: 'response.created' }], ['response.completed', { type: 'response.completed', response: completed }]]), { status: 200, headers: { 'x-request-id': 'req-9' } });
  };
  return { fetch, calls };
}

describe('the smoke check', () => {
  it('stops before any paid call when the models list is empty', async () => {
    const { fetch, calls } = fakeFetch([]);
    expect(await runSmoke({ env, fetch })).toMatchObject({ ok: false, reason: 'Not funded yet: the models list is empty.' });
    expect(calls.map((c) => c.method)).toEqual(['GET']);
  });

  it('stops when the configured model is not listed', async () => {
    const { fetch, calls } = fakeFetch(['muse-glimmer-1.0']);
    expect(await runSmoke({ env, fetch })).toMatchObject({ ok: false, reason: 'muse-spark-1.3 is not in the models list.' });
    expect(calls).toHaveLength(1);
  });

  it('runs one small real step and returns its receipt', async () => {
    const { fetch, calls } = fakeFetch(['muse-spark-1.3']);
    const out = await runSmoke({ env, fetch });
    // One turn, no tool call: the API works, and the smoke says the round trip did not run.
    expect(out).toMatchObject({ ok: true, models: 1, facts: 1, toolRoundTrip: false, toolRoundTripSupported: true, receipt: { step: 'extract', isMeta: true, model: 'muse-spark-1.3', requestIds: ['req-9'], turns: 1 } });
    expect(calls.map((c) => [c.method, c.url, c.auth])).toEqual([
      ['GET', 'https://api.meta.ai/v1/models', 'Bearer test-key'],
      ['POST', 'https://api.meta.ai/v1/responses', 'Bearer test-key'],
    ]);
  });

  it('reports a refused models list as what it is, not as unfunded', async () => {
    const fetch = async () => Response.json({ error: { message: 'Invalid key.' } }, { status: 401 });
    expect(await runSmoke({ env, fetch })).toMatchObject({ ok: false, reason: 'The models list returned HTTP 401.' });
  });

  it('labels structured chat as not exercising native tools, without demanding an impossible retry', async () => {
    const model = 'meta-models/Muse-Spark-Open-816B-A42B';
    const chatEnv = { PROVIDER: 'compatible', COMPAT_BASE_URL: 'https://modal.test/v1', COMPAT_API_KEY: 'test', COMPAT_MODEL: model, COMPAT_PRICE_AS: 'muse-spark-1.3', COMPAT_STRUCTURED: '1' };
    const fetch = async (url) => {
      if (url.endsWith('/models')) return Response.json({ data: [{ id: model }] });
      const chunk = { id: 'chat1', model, choices: [{ delta: { content: JSON.stringify(answer) }, finish_reason: 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 40 } };
      return new Response(`data: ${JSON.stringify(chunk)}\n\ndata: [DONE]\n\n`, { headers: { 'content-type': 'text/event-stream' } });
    };
    expect(await runSmoke({ env: chatEnv, fetch })).toMatchObject({ ok: true, facts: 1, toolRoundTrip: false, toolRoundTripSupported: false, receipt: { model, toolCalls: [] } });
  });

  it('counts against the shared spend file and its cap when they are set', async () => {
    const { mkdtempSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const file = join(mkdtempSync(join(tmpdir(), 'smoke-shared-')), 'meta-ledger.json');
    writeFileSync(file, JSON.stringify({ entries: [{ id: 'earlier', status: 'settled', reservedUsd: 129.99, chargedUsd: 129.99, at: '2026-10-27T09:00:00.000Z' }] }));
    const { fetch, calls } = fakeFetch(['muse-spark-1.3']);
    await expect(runSmoke({ env: { ...env, SPEND_LEDGER_FILE: file, SPEND_CAP_USD: '130' }, fetch })).rejects.toMatchObject({ code: 'cap' });
    expect(calls.map((c) => c.method)).toEqual(['GET']);
  });

  it('refuses to run in fixture mode', async () => {
    expect(await runSmoke({ env: {}, fetch: async () => { throw new Error('no call expected'); } })).toMatchObject({ ok: false, reason: 'Set PROVIDER to a model provider first.' });
  });
});
