// Spoken notes: the applicant records what they did, and Meta Voice Transcribe
// (muse-voice-transcribe-1.0) turns it into text they check before going on.
// File API, read 29 Oct 2026: POST https://api.meta.ai/v1/asr/transcribe, multipart
// "request" (JSON settings) plus "audio" (mono 16-bit WAV, 16 or 24 kHz), $0.18 per hour.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createLedger } from '../server/agent/budget.js';
import { createVoice, wavInfo } from '../server/agent/voice.js';
import { createApp } from '../server/app.js';
import { writeJsonAtomic } from '../server/store/jsonFile.js';
import { buildApp } from '../server/build.js';
import { draftedWorkspace } from './helpers.js';

// A mono 16-bit PCM WAV of the given length, like a browser recording after conversion.
function wav({ seconds = 1, rate = 16000, channels = 1, bits = 16 } = {}) {
  const dataBytes = Math.round(seconds * rate) * channels * (bits / 8);
  const view = new DataView(new ArrayBuffer(44 + dataBytes));
  const text = (at, s) => [...s].forEach((ch, i) => view.setUint8(at + i, ch.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, 36 + dataBytes, true); text(8, 'WAVE');
  text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true);
  view.setUint32(24, rate, true); view.setUint32(28, (rate * channels * bits) / 8, true);
  view.setUint16(32, (channels * bits) / 8, true); view.setUint16(34, bits, true);
  text(36, 'data'); view.setUint32(40, dataBytes, true);
  return new Uint8Array(view.buffer);
}

const tmp = () => mkdtempSync(join(tmpdir(), 'voice-'));
const ledgerIn = (dir) => createLedger({ file: join(dir, 'ledger.json'), capUsd: 5 });
const metaReplies = (body, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

describe('spoken notes through Meta Voice Transcribe', () => {
  it('reads the format and length of a WAV recording', () => {
    expect(wavInfo(wav({ seconds: 2 }))).toEqual({ sampleRate: 16000, channels: 1, bitsPerSample: 16, durationMs: 2000 });
    expect(wavInfo(wav({ rate: 24000 })).durationMs).toBe(1000);
  });

  it('refuses audio Meta cannot read, or longer than 3 minutes, before calling Meta', async () => {
    const fetch = metaReplies({ transcript: 'x' });
    const ledger = ledgerIn(tmp());
    const voice = createVoice({ key: 'test-key', ledger, fetch });
    for (const bad of [new Uint8Array([1, 2, 3]), wav({ channels: 2 }), wav({ bits: 8 }), wav({ rate: 44100 }), wav({ seconds: 181 })]) {
      await expect(voice.transcribe(bad, { callId: 'c' })).rejects.toMatchObject({ code: 'invalid' });
    }
    expect(fetch).not.toHaveBeenCalled();
    expect(ledger.summary().entries).toEqual([]);
  });

  it('sends Meta\'s file request and returns the applicant\'s words, charged by audio length', async () => {
    const fetch = metaReplies({ sessionId: 's1', transcript: '  I rang eight local suppliers. ', audioDurationMs: 60000, turns: [] });
    const ledger = ledgerIn(tmp());
    const audio = wav({ seconds: 60 });
    const result = await createVoice({ key: 'test-key', ledger, fetch }).transcribe(audio, { callId: 'c1' });
    expect(result).toMatchObject({ text: 'I rang eight local suppliers.', durationMs: 60000, model: 'muse-voice-transcribe-1.0' });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.meta.ai/v1/asr/transcribe');
    expect(init.method).toBe('POST');
    expect(init.headers.authorization).toBe('Bearer test-key');
    expect(init.body.get('request').type).toBe('application/json');
    expect(JSON.parse(await init.body.get('request').text())).toEqual({ mode: 'PUSH_TO_TALK', model: 'muse-voice-transcribe-1.0', audioEncoding: 'WAV' });
    expect(new Uint8Array(await init.body.get('audio').arrayBuffer())).toEqual(audio);
    // $0.18 per hour of audio: one minute costs $0.003.
    expect(result.costUsd).toBeCloseTo(0.003, 6);
    expect(ledger.summary()).toMatchObject({ spentUsd: 0.003, reservedUsd: 0 });
  });

  it('charges nothing when Meta refuses or is busy, and says so plainly', async () => {
    const ledger = ledgerIn(tmp());
    await expect(createVoice({ key: 'k', ledger, fetch: metaReplies({ error: 'slow down' }, 429) }).transcribe(wav(), { callId: 'b' }))
      .rejects.toMatchObject({ code: 'busy' });
    await expect(createVoice({ key: 'k', ledger, fetch: metaReplies({ error: 'bad audio' }, 400) }).transcribe(wav(), { callId: 'r' }))
      .rejects.toMatchObject({ code: 'provider' });
    expect(ledger.summary()).toMatchObject({ spentUsd: 0, reservedUsd: 0 });
  });

  it('keeps the reserved cost when the call may have run but no answer came back', async () => {
    const ledger = ledgerIn(tmp());
    const fetch = vi.fn(async () => { throw new TypeError('fetch failed'); });
    await expect(createVoice({ key: 'k', ledger, fetch }).transcribe(wav({ seconds: 60 }), { callId: 'n' })).rejects.toMatchObject({ code: 'network' });
    expect(ledger.summary().entries[0]).toMatchObject({ status: 'unknown' });
  });

  it('says so when no words were heard', async () => {
    const voice = createVoice({ key: 'k', ledger: ledgerIn(tmp()), fetch: metaReplies({ transcript: '   ', audioDurationMs: 1000 }) });
    await expect(voice.transcribe(wav(), { callId: 'e' })).rejects.toMatchObject({ code: 'invalid', message: expect.stringMatching(/no words/i) });
  });
});

describe('the spoken-notes route', () => {
  // The applicant's drafted work is already saved, so any change to it would show.
  async function appWith(voice, options = {}) {
    const ws = await draftedWorkspace();
    const dataDir = tmp();
    writeJsonAtomic(join(dataDir, 'users/local/workspace.json'), ws);
    return createApp({ dataDir, form: ws.application.form, agent: { provider: { id: 'test-double', label: 'Test only' } }, voice, ...options });
  }
  const post = (app, body) => app.request('/api/voice', { method: 'POST', headers: { 'content-type': 'audio/wav' }, body });

  it('takes a recording larger than the 100 KB text limit and returns the words, with a receipt', async () => {
    const voice = { transcribe: vi.fn(async () => ({ text: 'I rang eight local suppliers.', durationMs: 10000, costUsd: 0.0005, model: 'muse-voice-transcribe-1.0' })) };
    const app = await appWith(voice);
    const audio = wav({ seconds: 10 }); // about 320 KB
    const res = await post(app, audio);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: 'I rang eight local suppliers.', durationMs: 10000 });
    expect(new Uint8Array(voice.transcribe.mock.calls[0][0])).toEqual(audio);
    const { receipts } = await (await app.request('/api/receipts')).json();
    expect(receipts.at(-1)).toMatchObject({ step: 'transcribe', flow: 'voice', provider: 'meta', isMeta: true, model: 'muse-voice-transcribe-1.0', costUsd: 0.0005 });
    expect((await (await app.request('/api/state')).json()).voice).toBe(true);
  });

  // Live check, 29 Oct: a first spoken note on a fresh visit was charged but missing from
  // What Meta did, because an unsaved workspace got a new start time on every read.
  it('lists a spoken note in What Meta did even before anything else is saved', async () => {
    const voice = { transcribe: vi.fn(async () => ({ text: 'Words.', durationMs: 1000, costUsd: 0.00005, model: 'muse-voice-transcribe-1.0' })) };
    const ws = await draftedWorkspace();
    const app = createApp({ dataDir: tmp(), form: ws.application.form, agent: { provider: { id: 'test-double', label: 'Test only' } }, voice });
    await post(app, wav());
    const { receipts } = await (await app.request('/api/receipts')).json();
    expect(receipts.map((r) => r.step)).toEqual(['transcribe']);
  });

  it('never changes the applicant\'s work', async () => {
    const voice = { transcribe: vi.fn(async () => ({ text: 'Words.', durationMs: 1000, costUsd: 0.00005, model: 'muse-voice-transcribe-1.0' })) };
    const app = await appWith(voice);
    const before = (await (await app.request('/api/state')).json()).workspace;
    await post(app, wav());
    expect((await (await app.request('/api/state')).json()).workspace).toEqual(before);
  });

  it('is off for a visitor whose live allowance is used up', async () => {
    const voice = { transcribe: vi.fn() };
    const app = await appWith(voice, { fallback: { provider: { id: 'fixture', label: 'Fixture' } }, visitorCapUsd: 0 });
    expect((await post(app, wav())).status).toBe(429);
    expect(voice.transcribe).not.toHaveBeenCalled();
    expect((await (await app.request('/api/state')).json()).voice).toBe(false);
  });

  it('refuses a recording over the size limit without calling Meta', async () => {
    const voice = { transcribe: vi.fn() };
    const res = await post(await appWith(voice), new Uint8Array(7 * 1024 * 1024));
    expect(res.status).toBe(413);
    expect(voice.transcribe).not.toHaveBeenCalled();
  });

  it('is off without the live Meta model, and says so', async () => {
    const app = await appWith(null);
    expect((await post(app, wav())).status).toBe(404);
    expect((await (await app.request('/api/state')).json()).voice).toBe(false);
  });

  it('is on when the server has Meta\'s key, and off in fixture mode', async () => {
    const live = buildApp({ dataDir: tmp(), env: { PROVIDER: 'meta', META_API_KEY: 'test-key', SPEND_CAP_USD: '1' } });
    expect((await (await live.request('/api/state')).json()).voice).toBe(true);
    const fixture = buildApp({ dataDir: tmp(), env: {} });
    expect((await (await fixture.request('/api/state')).json()).voice).toBe(false);
  });
});

describe('a transcription that never answers', () => {
  it('is ended within its time limit with a plain message, and its spend stays reserved', async () => {
    const fetch = vi.fn((_url, init) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }));
    const ledger = ledgerIn(tmp());
    const voice = createVoice({ key: 'test-key', ledger, fetch, timeoutMs: 30 });
    const started = Date.now();
    await expect(voice.transcribe(wav({ seconds: 2 }), { callId: 'c1' })).rejects.toMatchObject({
      code: 'timeout', message: 'Meta Voice Transcribe took too long. Try again, or type your notes.' });
    expect(Date.now() - started).toBeLessThan(1000);
    expect(ledger.summary().entries.map((e) => e.status)).toEqual(['unknown']);
  });
});

describe('a transcription reply that starts but never finishes', () => {
  it('is ended by the same time limit, and its spend stays reserved', async () => {
    const fetch = vi.fn(async (_url, init) => new Response(new ReadableStream({ start(c) {
      c.enqueue(new TextEncoder().encode('{"transcript":'));
      init.signal.addEventListener('abort', () => c.error(new Error('aborted')));
    } }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const ledger = ledgerIn(tmp());
    const voice = createVoice({ key: 'test-key', ledger, fetch, timeoutMs: 30 });
    await expect(voice.transcribe(wav({ seconds: 2 }), { callId: 'c1' })).rejects.toMatchObject({
      code: 'timeout', message: 'Meta Voice Transcribe took too long. Try again, or type your notes.' });
    expect(ledger.summary().entries.map((e) => e.status)).toEqual(['unknown']);
  });
});
