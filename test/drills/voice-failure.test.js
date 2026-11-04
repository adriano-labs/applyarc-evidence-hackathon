// @vitest-environment node
// Failure drill: Meta's voice service answers 500. The voice module gives a plain refusal and frees
// the spend it reserved; the route answers clean JSON, never a stack trace or a 200, and keeps no
// receipt for a call Meta did not bill. (A network failure is covered in test/voice.test.js.)
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createLedger } from '../../server/agent/budget.js';
import { createVoice } from '../../server/agent/voice.js';
import { createApp } from '../../server/app.js';
import { draftedWorkspace } from '../helpers.js';

function wav(seconds = 1, rate = 16000) {
  const dataBytes = Math.round(seconds * rate) * 2;
  const view = new DataView(new ArrayBuffer(44 + dataBytes));
  const text = (at, s) => [...s].forEach((ch, i) => view.setUint8(at + i, ch.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, 36 + dataBytes, true); text(8, 'WAVE');
  text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(36, 'data'); view.setUint32(40, dataBytes, true);
  return new Uint8Array(view.buffer);
}

const tmp = () => mkdtempSync(join(tmpdir(), 'voice-fail-'));
const PLAIN = 'Meta Voice Transcribe could not read that recording. Try again, or type your notes.';
const metaFails = () => vi.fn(async () => new Response(JSON.stringify({ error: 'bad' }), { status: 500, headers: { 'content-type': 'application/json' } }));

describe('Meta’s voice service failing', () => {
  it('is a plain provider refusal, and the reserved spend is released', async () => {
    const ledger = createLedger({ file: join(tmp(), 'ledger.json'), capUsd: 5 });
    const voice = createVoice({ key: 'k', ledger, fetch: metaFails() });
    await expect(voice.transcribe(wav(), { callId: 'c1' })).rejects.toMatchObject({ code: 'provider', message: PLAIN });
    expect(ledger.summary()).toMatchObject({ spentUsd: 0, reservedUsd: 0 });
  });

  it('reaches the browser as clean JSON, never a stack trace or a 200, with no receipt', async () => {
    const ws = await draftedWorkspace();
    const voice = createVoice({ key: 'k', ledger: createLedger({ file: join(tmp(), 'ledger.json'), capUsd: 5 }), fetch: metaFails() });
    const app = createApp({ dataDir: tmp(), form: ws.application.form, agent: { provider: { id: 'test-double', label: 'Test only' } }, voice });
    const res = await app.request('/api/voice', { method: 'POST', headers: { 'content-type': 'audio/wav' }, body: wav(5) });
    expect(res.status).toBe(502);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
    const body = await res.json();
    expect(body).toEqual({ error: { code: 'provider', message: PLAIN } });
    expect((await (await app.request('/api/receipts')).json()).receipts).toEqual([]);
  });
});
