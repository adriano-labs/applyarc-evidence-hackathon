// The open-weight edition pings its shared endpoint so a judge after a quiet spell gets no cold start.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { keepWarm } from '../../server/agent/keepWarm.js';

const chat = { wire: 'chat', baseUrl: 'https://host.example/v1', host: 'host.example', model: 'meta-models/muse-spark-open', headers: () => ({ authorization: 'Bearer test' }) };
const ok = () => vi.fn(async () => ({ ok: true, status: 200, text: async () => '{}' }));

describe('keepWarm', () => {
  afterEach(() => vi.useRealTimers());

  it('pings at once, then on every interval, with a one-token chat request', async () => {
    vi.useFakeTimers();
    const fetch = ok();
    const stop = keepWarm({ provider: chat, everyMs: 240000, fetch, log: () => {} });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://host.example/v1/chat/completions');
    expect(init.headers.authorization).toBe('Bearer test');
    expect(JSON.parse(init.body)).toEqual({ model: 'meta-models/muse-spark-open', max_tokens: 1, messages: [{ role: 'user', content: 'ok' }] });
    await vi.advanceTimersByTimeAsync(240000 * 2);
    expect(fetch).toHaveBeenCalledTimes(3);
    stop();
    await vi.advanceTimersByTimeAsync(240000 * 2);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('does nothing for the Responses API provider or without an interval', () => {
    const fetch = ok();
    keepWarm({ provider: { ...chat, wire: 'responses' }, everyMs: 240000, fetch })();
    keepWarm({ provider: chat, everyMs: 0, fetch })();
    keepWarm({ provider: null, everyMs: 240000, fetch })();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('logs a failed ping instead of throwing', async () => {
    const log = vi.fn();
    const stop = keepWarm({ provider: chat, everyMs: 240000, fetch: vi.fn(async () => { throw new Error('offline'); }), log });
    await vi.waitFor(() => expect(log).toHaveBeenCalledWith('keep-warm: host.example offline'));
    stop();
  });
});
