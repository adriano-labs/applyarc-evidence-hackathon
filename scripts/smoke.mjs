// The first call on a new key: list the models, then one small real step.
// `PROVIDER=meta META_API_KEY=… node scripts/smoke.mjs` costs a few cents. It
// stops before any paid call when the key is unfunded or the model is not
// listed, and says whether the tool round trip (a tool call, then its result
// sent back with the encrypted reasoning) actually ran.
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createLedger } from '../server/agent/budget.js';
import { createModelAgent } from '../server/agent/model.js';
import { providerFromEnv } from '../server/agent/providers.js';
import { createTransport } from '../server/agent/transport.js';
import { fromRoot } from '../server/paths.js';

const NOTE = 'We built a self-service GPU job runner for the department. I wrote the per-course quota check.';

export async function runSmoke({ env = process.env, fetch = globalThis.fetch } = {}) {
  const provider = providerFromEnv(env);
  if (!provider) return { ok: false, reason: 'Set PROVIDER to a model provider first.' };

  const listed = await fetch(`${provider.baseUrl}/models`, { method: 'GET', headers: provider.headers() });
  if (!listed.ok) return { ok: false, reason: `The models list returned HTTP ${listed.status}.` };
  const ids = ((await listed.json()).data ?? []).map((m) => m.id);
  if (!ids.length) return { ok: false, reason: 'Not funded yet: the models list is empty.' };
  if (!ids.includes(provider.model)) return { ok: false, reason: `${provider.model} is not in the models list.` };

  // The shared spend file and its cap when set (every run counts against one total);
  // otherwise a throwaway ledger. Worst case is about $0.04 a turn, so $0.50 covers six turns.
  const ledger = env.SPEND_LEDGER_FILE
    ? createLedger({ file: env.SPEND_LEDGER_FILE, capUsd: Number(env.SPEND_CAP_USD ?? 2) })
    : createLedger({ file: join(mkdtempSync(join(tmpdir(), 'smoke-')), 'ledger.json'), capUsd: Number(env.SMOKE_CAP_USD ?? 0.5) });
  const agent = createModelAgent({ provider, transport: createTransport({ provider, fetch, ledger }) });
  const form = JSON.parse(readFileSync(fromRoot('fixtures', 'graphcore-form-2026-10-26.json'), 'utf8'));
  let receipt = null;
  const { facts } = await agent.extract({ form, source: { id: 's1', kind: 'notes', text: NOTE }, emit: (e) => { if (e.type === 'receipt') receipt = e.receipt; } });
  const toolRoundTrip = receipt.turns >= 2 && receipt.toolCalls.length >= 1;
  return { ok: true, models: ids.length, facts: facts.length, toolRoundTrip, toolRoundTripSupported: provider.wire !== 'chat', receipt };
}

async function main() {
  const result = await runSmoke();
  const output = JSON.stringify(result, null, 2);
  console.log(output);
  if (process.env.SMOKE_OUT) writeFileSync(process.env.SMOKE_OUT, output);
  if (!result.ok) process.exit(1);
  if (result.toolRoundTripSupported && !result.toolRoundTrip) {
    console.error('The API works, but the model answered without a tool call: the tool round trip was NOT exercised. Run it again.');
    process.exit(2);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
