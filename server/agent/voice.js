// Spoken notes through Meta Voice Transcribe (file API, read 29 Oct 2026 on
// dev.meta.ai/docs/speech-to-text). The recording is a mono 16-bit WAV at 16 or
// 24 kHz, and the call is reserved in the spend ledger at its exact length.
import { VOICE_USD_PER_HOUR } from './pricing.js';
import { LANGUAGES } from '../domain/languages.js';

const MODEL = 'muse-voice-transcribe-1.0';
const HOST = 'api.meta.ai';
const MAX_MS = 3 * 60 * 1000;
const costOf = (ms) => (ms / 3_600_000) * VOICE_USD_PER_HOUR;
const fail = (code, message) => Object.assign(new Error(message), { code });

// The 44-byte header a browser recording has once converted; null if it is not PCM WAV.
export function wavInfo(bytes) {
  const tag = (at) => String.fromCharCode(...bytes.subarray(at, at + 4));
  if (bytes.byteLength < 44 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint16(20, true) !== 1 || !view.getUint32(28, true)) return null;
  return {
    sampleRate: view.getUint32(24, true),
    channels: view.getUint16(22, true),
    bitsPerSample: view.getUint16(34, true),
    durationMs: Math.round((view.getUint32(40, true) / view.getUint32(28, true)) * 1000),
  };
}

const tooLong = () => fail('timeout', 'Meta Voice Transcribe took too long. Try again, or type your notes.');

export function createVoice({ key, ledger, fetch = globalThis.fetch, timeoutMs = 60000 }) {
  return {
    // language: the applicant's chosen language, sent as Meta's languageBias hint (a nudge, not a constraint).
    // keywords: a bundled sample's own names and places, sent as Meta's `keywords` (a bias toward
    // those words; Meta's docs say it does not guarantee their spelling). An own recording has none.
    async transcribe(bytes, { callId, language, keywords = [] }) {
      const info = wavInfo(bytes);
      if (!info || info.channels !== 1 || info.bitsPerSample !== 16 || ![16000, 24000].includes(info.sampleRate)) {
        throw fail('invalid', 'Send the recording as a mono 16-bit WAV at 16 or 24 kHz.');
      }
      if (info.durationMs > MAX_MS) throw fail('invalid', 'Keep a spoken note under 3 minutes.');
      const id = `voice-${callId}`;
      ledger.reserve(id, costOf(info.durationMs));
      const body = new FormData();
      const hint = LANGUAGES[language]?.name;
      const settings = { mode: 'PUSH_TO_TALK', model: MODEL, audioEncoding: 'WAV', ...(hint ? { languageBias: [hint] } : {}), ...(keywords.length ? { keywords } : {}) };
      body.append('request', new Blob([JSON.stringify(settings)], { type: 'application/json' }));
      body.append('audio', new Blob([bytes], { type: 'audio/wav' }), 'note.wav');
      let res;
      const signal = AbortSignal.timeout(timeoutMs); // also bounds reading the reply
      try {
        res = await fetch(`https://${HOST}/v1/asr/transcribe`, { method: 'POST', headers: { authorization: `Bearer ${key}`, accept: 'application/json' }, body, signal });
      } catch {
        ledger.unknown(id); // it may have run
        throw signal.aborted ? tooLong() : fail('network', 'Could not reach Meta Voice Transcribe. Try again, or type your notes.');
      }
      if (!res.ok) {
        ledger.release(id); // Meta bills neither failed requests nor 429s
        throw res.status === 429
          ? fail('busy', 'Meta Voice Transcribe is busy. Try again in a minute, or type your notes.')
          : fail('provider', 'Meta Voice Transcribe could not read that recording. Try again, or type your notes.');
      }
      let reply;
      try { reply = await res.json(); } catch {
        ledger.unknown(id);
        if (signal.aborted) throw tooLong();
        throw fail('provider', 'Meta Voice Transcribe sent an answer that could not be read. Try again, or type your notes.');
      }
      const durationMs = Number.isFinite(reply.audioDurationMs) ? reply.audioDurationMs : info.durationMs;
      const costUsd = costOf(durationMs);
      ledger.settle(id, costUsd);
      const heard = { text: String(reply.transcript ?? '').trim(), durationMs, costUsd, model: MODEL, host: HOST, ...(hint ? { hint } : {}), ...(keywords.length ? { keywords } : {}) };
      // Charged even with no words: the refusal carries what was heard, so the visitor's receipt still counts it.
      if (!heard.text) throw Object.assign(fail('invalid', 'No words were heard. Try again closer to the microphone, or type your notes.'), { heard });
      return heard;
    },
  };
}
