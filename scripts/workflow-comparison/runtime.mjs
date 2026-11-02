import { createHash, randomUUID } from 'node:crypto';
import { worstCase } from '../../server/agent/pricing.js';
import { fail, safeFailure } from './shared.mjs';

export const digest = (text) => createHash('sha256').update(text).digest('hex');

// The same ceiling and serial provider scheduling apply to both arms. The app
// may normally draft concurrently; this protocol measures serial model work.
export function scopedTransport({ transport, ledger, provider, armCapUsd, maxAttempts = 3 }) {
  let tail = Promise.resolve();
  let calls = 0;
  const start = ledger.summary().spentUsd;
  const receipts = [];
  const run = async (body, options) => {
    const price = worstCase(provider.priceModel ?? provider.model, {
      inputTokens: Math.ceil(JSON.stringify(body).length / 3), maxOutputTokens: body.max_output_tokens });
    if (ledger.summary().spentUsd - start + price * maxAttempts > armCapUsd) fail('arm-budget-cap');
    if (++calls > 40) fail('arm-call-cap');
    const callId = options?.callId ?? randomUUID();
    const began = performance.now();
    try {
      const result = await transport.respond(body, { ...options, callId });
      receipts.push({ callId, model: provider.model, effort: body.reasoning?.effort ?? null,
        usage: result.usage, costUsd: result.costUsd, requestId: result.requestId,
        attempts: result.attempts, unsettled: result.unsettled, timings: result.timings });
      return result;
    } catch (error) {
      receipts.push({ callId, failure: safeFailure(error), machineElapsedMs: Math.round(performance.now() - began) });
      throw error;
    }
  };
  return {
    respond(body, options) {
      const pending = tail.then(() => run(body, options));
      tail = pending.catch(() => {});
      return pending;
    },
    evidence: () => ({ receipts, chargedUsdIncludingUnknown: ledger.summary().spentUsd - start, armCapUsd }),
  };
}

export function liveOptions(env, args, sha) {
  if (!args.includes('--run-live')) return null;
  if (env.WORKFLOW_REVIEWED_CORPUS_SHA256 !== sha) fail('corpus-review-required');
  const fields = ['PROVIDER', 'WORKFLOW_OUTPUT_DIR', 'WORKFLOW_LEDGER_FILE', 'WORKFLOW_CAP_USD', 'WORKFLOW_ARM_CAP_USD', 'WORKFLOW_EFFORT'];
  if (fields.some((key) => !env[key])) fail('explicit-live-options-required');
  if (env.PROVIDER === 'fixture') fail('live-provider-required');
  const capUsd = Number(env.WORKFLOW_CAP_USD);
  const armCapUsd = Number(env.WORKFLOW_ARM_CAP_USD);
  if (![capUsd, armCapUsd].every((v) => Number.isFinite(v) && v > 0) || armCapUsd > capUsd) fail('invalid-budget');
  if (!['low', 'medium', 'high', 'xhigh'].includes(env.WORKFLOW_EFFORT)) fail('invalid-effort');
  return { capUsd, armCapUsd, effort: env.WORKFLOW_EFFORT, outputDir: env.WORKFLOW_OUTPUT_DIR, ledgerFile: env.WORKFLOW_LEDGER_FILE };
}
