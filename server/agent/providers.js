// Which model service the app talks to, from the server's environment.
// PROVIDER=fixture (default) needs nothing. PROVIDER=meta needs META_API_KEY.
// PROVIDER=compatible serves Meta open-weight models via an OpenAI-compatible host.
import { PRICES } from './pricing.js';

const META_EFFORTS = new Set(['low', 'medium', 'high', 'max']);

function required(env, name) {
  if (!env[name]) throw new Error(`${name} must be set on the server for PROVIDER=${env.PROVIDER}.`);
  return env[name];
}

function meta(env) {
  const key = required(env, 'META_API_KEY');
  const model = env.META_MODEL ?? 'muse-spark-1.3';
  if (!Object.hasOwn(PRICES, model)) throw new Error(`No price for Meta model ${model}.`);
  let effort;
  if (Object.hasOwn(env, 'META_REASONING_EFFORT')) {
    const value = env.META_REASONING_EFFORT;
    if (typeof value !== 'string' || !META_EFFORTS.has(value)) {
      throw new Error('META_REASONING_EFFORT must be low, medium, high or max.');
    }
    effort = value;
  }
  const label = model === 'muse-wonder-1.0' ? 'Meta Muse Wonder 1.0' : 'Meta Muse Spark 1.3';
  return {
    id: 'meta', label, isMeta: true, wire: 'responses',
    baseUrl: env.META_BASE_URL ?? 'https://api.meta.ai/v1', model,
    promptCacheKey: true, safetyIdentifier: true,
    effort: effort ?? null,
    headers: () => ({ authorization: `Bearer ${key}` }),
  };
}

function compatible(env) {
  const baseUrl = required(env, 'COMPAT_BASE_URL');
  const apiKey = required(env, 'COMPAT_API_KEY');
  const model = required(env, 'COMPAT_MODEL');
  const priceModel = required(env, 'COMPAT_PRICE_AS');
  if (!PRICES[priceModel]) throw new Error(`Set COMPAT_PRICE_AS to a priced model so the spend cap can count ${model}.`);
  const label = env.COMPAT_LABEL ?? `Meta open-weight model (${model})`;
  const wire = env.COMPAT_WIRE ?? 'chat';
  const structured = env.COMPAT_STRUCTURED === '1';
  const reasoning = env.COMPAT_REASONING !== '0';
  const firstEventTimeoutMs = Number(env.COMPAT_FIRST_EVENT_TIMEOUT_MS ?? 45000);
  return {
    id: 'compatible', label, isMeta: true, wire,
    baseUrl, model, priceModel,
    structured, reasoning,
    promptCacheKey: false, safetyIdentifier: false,
    effort: null,
    firstEventTimeoutMs,
    headers: () => ({ authorization: `Bearer ${apiKey}` }),
  };
}

export function providerFromEnv(env) {
  const id = env.PROVIDER ?? 'fixture';
  if (id === 'fixture') return null;
  if (id === 'meta') return meta(env);
  if (id === 'compatible') return compatible(env);
  throw new Error(`Unknown PROVIDER ${id}: use fixture, meta or compatible.`);
}
