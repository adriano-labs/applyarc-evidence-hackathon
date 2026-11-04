// Keeps a shared open-weight endpoint warm between visitors: one tiny chat request every
// few minutes, so the first visitor after a quiet spell does not wait out a cold start.
// Off unless KEEP_WARM_MS is set; the pings cost a fraction of a cent a day and are not
// any visitor's step, so they appear in no receipt.
export function keepWarm({ provider, everyMs, fetch = globalThis.fetch, log = console.log }) {
  if (provider?.wire !== 'chat' || !(everyMs > 0)) return () => {};
  const ping = async () => {
    try {
      const res = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { ...provider.headers(), 'content-type': 'application/json' },
        body: JSON.stringify({ model: provider.model, max_tokens: 1, messages: [{ role: 'user', content: 'ok' }] }),
        signal: AbortSignal.timeout(120000),
      });
      await res.text();
      if (!res.ok) log(`keep-warm: ${provider.host} answered ${res.status}`);
    } catch (error) {
      log(`keep-warm: ${provider.host} ${error.message}`);
    }
  };
  const timer = setInterval(ping, everyMs);
  timer.unref?.();
  ping();
  return () => clearInterval(timer);
}
