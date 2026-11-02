import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createLedger } from '../../server/agent/budget.js';
import { createModelAgent } from '../../server/agent/model.js';
import { costOf, PRICES, worstCase } from '../../server/agent/pricing.js';
import { providerFromEnv } from '../../server/agent/providers.js';
import { createTransport } from '../../server/agent/transport.js';

const env = { PROVIDER: 'meta', META_API_KEY: 'test-only-placeholder', META_MODEL: 'muse-wonder-1.0' };
const usage = { input_tokens: 1000, input_tokens_details: { cached_tokens: 400 }, output_tokens: 500, output_tokens_details: { reasoning_tokens: 450 } };
const facts = [{ id: 'f1', statement: 'My teammate wrote it; I tested it.', quote: 'My teammate wrote it; I tested it.' }];
const form = { documents: [{ id: 'answer', title: 'Answer', question: 'What did you do?', wordLimit: 300, requirements: [] }] };
const args = { fact: { ...facts[0], history: [{ statement: 'I wrote it.', quote: 'I wrote it.' }] }, items: [{ segmentId: 'answer-1', docId: 'answer', before: 'I wrote it.', factIds: ['f1'] }], facts, form };

function recordingTransport(provider) {
  const bodies = [];
  const ledger = createLedger({ file: join(mkdtempSync(join(tmpdir(), 'wonder-transport-')), 'ledger.json'), capUsd: 5 });
  const fetch = async (_, options) => {
    bodies.push(JSON.parse(options.body));
    const response = { model: provider.model, usage, output: [{ type: 'message', content: [{ type: 'output_text', text: '{"rewrites":[]}' }] }] };
    return new Response(`event: response.completed\ndata: ${JSON.stringify({ type: 'response.completed', response })}\n\n`, {
      headers: { 'content-type': 'text/event-stream', 'x-request-id': 'test-request' },
    });
  };
  return { bodies, ...createTransport({ provider, ledger, fetch }) };
}

describe('Wonder configuration and budgeting', () => {
  it('uses its published standard-mode rates and counts reasoning only inside output', () => {
    expect(PRICES['muse-wonder-1.0']).toEqual({ input: 4, cached: 0.20, output: 20 });
    expect(costOf('muse-wonder-1.0', usage)).toBeCloseTo((600 * 4 + 400 * 0.20 + 500 * 20) / 1e6, 12);
    expect(worstCase('muse-wonder-1.0', { inputTokens: 2000, maxOutputTokens: 8000 })).toBeCloseTo(0.168, 12);
  });

  it('reserves at Wonder rates and prevents another call from exceeding the cap', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'wonder-budget-')), 'ledger.json');
    const ledger = createLedger({ file, capUsd: 0.20 });
    const reservation = worstCase('muse-wonder-1.0', { inputTokens: 2000, maxOutputTokens: 8000 });
    ledger.reserve('first', reservation);
    expect(ledger.summary().reservedUsd).toBe(0.168);
    expect(() => ledger.reserve('second', reservation)).toThrow(/Spend cap reached/);
    ledger.settle('first', costOf('muse-wonder-1.0', usage));
    expect(ledger.summary()).toMatchObject({ spentUsd: 0.01248, reservedUsd: 0 });
  });

  it('names the actual configured Meta model without exposing its key', () => {
    const wonder = providerFromEnv(env);
    expect(wonder).toMatchObject({ model: 'muse-wonder-1.0', label: 'Meta Muse Wonder 1.0', id: 'meta', wire: 'responses' });
    expect(JSON.stringify(wonder)).not.toContain(env.META_API_KEY);
    expect(providerFromEnv({ PROVIDER: 'meta', META_API_KEY: 'test' })).toMatchObject({ model: 'muse-spark-1.3', label: 'Meta Muse Spark 1.3' });
  });

  it.each(['unknown', '', 'constructor', 'toString'])('rejects unpriced Meta model %s during configuration', (model) => {
    expect(() => providerFromEnv({ ...env, META_MODEL: model })).toThrow(/price|model/i);
  });

  it.each(['low', 'medium', 'high', 'max'])('passes the explicit %s effort into requests and receipts', async (effort) => {
    const provider = providerFromEnv({ ...env, META_REASONING_EFFORT: effort });
    const transport = recordingTransport(provider);
    const events = [];
    await createModelAgent({ provider, transport }).repair({ ...args, emit: (event) => events.push(event) });
    expect(transport.bodies[0]).toMatchObject({ model: 'muse-wonder-1.0', stream: true, reasoning: { effort } });
    expect(events.find((event) => event.type === 'receipt').receipt).toMatchObject({ model: 'muse-wonder-1.0', effort });
  });

  it('preserves the existing per-step policy when no effort override is configured', async () => {
    const provider = providerFromEnv(env);
    const transport = recordingTransport(provider);
    await createModelAgent({ provider, transport }).repair(args);
    expect(transport.bodies[0].reasoning.effort).toBe('medium');
  });

  it.each(['none', 'HIGH', '', 'unlimited', 3])('rejects invalid explicit effort %s before any inference', (effort) => {
    expect(() => providerFromEnv({ ...env, META_REASONING_EFFORT: effort })).toThrow(/META_REASONING_EFFORT/);
  });
});
