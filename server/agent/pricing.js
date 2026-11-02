// Prices in US dollars per million tokens. Meta Muse Spark 1.3 from Meta's
// pricing page (read 26 Oct 2026); Muse Spark Open on Modal costs the same
// per token, so it is priced as muse-spark-1.3 (COMPAT_PRICE_AS). Meta Muse
// Wonder 1.0 standard mode from Meta's pricing page (read 2 November 2026):
// $4 input, $0.20 cached input and $20 output per million tokens.
export const PRICES = {
  'muse-spark-1.3': { input: 1.25, cached: 0.15, output: 4.25 },
  'muse-wonder-1.0': { input: 4, cached: 0.20, output: 20 },
};
// Meta Voice Transcribe price from Meta docs (read 29 Oct 2026).
export const VOICE_USD_PER_HOUR = 0.18;

function priceOf(model) {
  const price = PRICES[model];
  if (!price) throw new Error(`No price for ${model}`);
  return price;
}

// Cached tokens are part of input_tokens; reasoning tokens are already part
// of output_tokens and are never added again.
export function costOf(model, usage) {
  const price = priceOf(model);
  const input = usage.input_tokens ?? 0;
  const cached = usage.input_tokens_details?.cached_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  return ((input - cached) * price.input + cached * price.cached + output * price.output) / 1e6;
}

export function worstCase(model, { inputTokens, maxOutputTokens }) {
  const price = priceOf(model);
  return (inputTokens * price.input + maxOutputTokens * price.output) / 1e6;
}
