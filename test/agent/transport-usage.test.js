import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createLedger } from '../../server/agent/budget.js';
import { createModelAgent } from '../../server/agent/model.js';
import { createTransport } from '../../server/agent/transport.js';

const provider = { id: 'meta', isMeta: true, wire: 'responses', model: 'muse-wonder-1.0', baseUrl: 'https://example.test/v1', headers: () => ({}) };
const body = { input: [], max_output_tokens: 8000 };
const valid = { input_tokens: 1000, output_tokens: 500, input_tokens_details: { cached_tokens: 400 }, output_tokens_details: { reasoning_tokens: 450 } };

function setup(usage, status = 'completed') {
  const ledger = createLedger({ file: join(mkdtempSync(join(tmpdir(), 'usage-guard-')), 'ledger.json'), capUsd: 2 });
  const response = { status, model: provider.model, usage, output: [{ type: 'message', content: [{ type: 'output_text', text: '{"rewrites":[]}' }] }], incomplete_details: { reason: 'max_output_tokens' } };
  let calls = 0;
  const fetch = async () => {
    calls += 1;
    return new Response(`event: response.${status}\ndata: ${JSON.stringify({ type: `response.${status}`, response })}\n\n`, { headers: { 'content-type': 'text/event-stream' } });
  };
  return { ledger, calls: () => calls, transport: createTransport({ provider, ledger, fetch }) };
}

function unknown(ledger) {
  const [entry] = ledger.summary().entries;
  expect(entry.status).toBe('unknown');
  expect(entry.chargedUsd).toBe(entry.reservedUsd);
  expect(entry.chargedUsd).toBeGreaterThan(0);
}

const invalidUsage = [
  ['missing', undefined], ['null', null], ['empty', {}], ['array', []],
  ['missing input', { output_tokens: 1 }], ['missing output', { input_tokens: 1 }],
  ['negative input', { ...valid, input_tokens: -1 }], ['negative output', { ...valid, output_tokens: -1 }],
  ['string output', { ...valid, output_tokens: '500' }], ['fractional input', { ...valid, input_tokens: 1.5 }],
  ['nonfinite output', { ...valid, output_tokens: Infinity }],
  ['null cached', { ...valid, input_tokens_details: { cached_tokens: null } }],
  ['null reasoning', { ...valid, output_tokens_details: { reasoning_tokens: null } }],
  ['null input details', { ...valid, input_tokens_details: null }],
  ['array output details', { ...valid, output_tokens_details: [] }],
  ['negative cached', { ...valid, input_tokens_details: { cached_tokens: -1 } }],
  ['cached above input', { ...valid, input_tokens_details: { cached_tokens: 1001 } }],
  ['string cached', { ...valid, input_tokens_details: { cached_tokens: '400' } }],
  ['negative reasoning', { ...valid, output_tokens_details: { reasoning_tokens: -1 } }],
  ['reasoning above output', { ...valid, output_tokens_details: { reasoning_tokens: 501 } }],
];

describe('Responses usage accounting fails closed', () => {
  it.each(invalidUsage)('retains the reservation and reports unknown cost for %s usage', async (_, usage) => {
    const { transport, ledger, calls } = setup(usage);
    const result = await transport.respond(body, { callId: 'test' });
    expect(result).toMatchObject({ costUsd: null, unsettled: 1, usage: {} });
    expect(calls()).toBe(1);
    unknown(ledger);
  });

  it.each(['completed', 'failed', 'incomplete'])('propagates unknown cost to the app receipt for %s without usage', async (status) => {
    const { transport, ledger, calls } = setup(undefined, status);
    const events = [];
    const agent = createModelAgent({ provider, transport });
    const result = await agent.repair({
      fact: { id: 'f1', statement: 'I tested it.', quote: 'I tested it.', history: [] },
      items: [], facts: [{ id: 'f1', statement: 'I tested it.', quote: 'I tested it.' }],
      form: { documents: [] }, emit: (event) => events.push(event),
    }).catch((error) => error);
    if (status !== 'completed') expect(result).toMatchObject({ code: status, unsettled: 1 });
    const receipt = events.find((event) => event.type === 'receipt').receipt;
    expect(receipt).toMatchObject({ costUsd: null, unsettled: 1 });
    expect(calls()).toBe(1);
    unknown(ledger);
  });

  it.each([
    ['ordinary', { input_tokens: 1000, output_tokens: 500 }, 0.014],
    ['cached and reasoning', valid, 0.01248],
    ['explicit zero', { input_tokens: 0, output_tokens: 0, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } }, 0],
  ])('settles valid %s usage once without charging reasoning twice', async (_, usage, expected) => {
    const { transport, ledger } = setup(usage);
    const result = await transport.respond(body, { callId: 'valid' });
    expect(result).toMatchObject({ usage, costUsd: expected, unsettled: 0 });
    expect(ledger.summary().entries[0]).toMatchObject({ status: 'settled', chargedUsd: expected });
  });
});
