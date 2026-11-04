// @vitest-environment node
// Failure drill: input a judge could send by accident. Each is refused with a plain message and the
// saved work is left as it was; nothing answers 500, and Meta is never reached for a bad recording.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createLedger } from '../../server/agent/budget.js';
import { createVoice } from '../../server/agent/voice.js';
import { buildApp } from '../../server/build.js';
import { createApp } from '../../server/app.js';
import { draftedWorkspace } from '../helpers.js';

const tmp = () => mkdtempSync(join(tmpdir(), 'bad-input-'));
const post = (app, path, body) => app.request(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const state = async (app) => (await app.request('/api/state')).json();

// The real voice module, with Meta's endpoint stubbed: a refusal must come before any call to it.
async function voiceApp() {
  const ws = await draftedWorkspace();
  const fetch = vi.fn();
  const voice = createVoice({ key: 'k', ledger: createLedger({ file: join(tmp(), 'ledger.json'), capUsd: 5 }), fetch });
  const app = createApp({ dataDir: tmp(), form: ws.application.form, agent: { provider: { id: 'test-double', label: 'Test only' } }, voice });
  return { app, fetch };
}

describe('bad input', () => {
  it('refuses an empty note, a whitespace-only note and a 5,000-word note with a plain message, and saves nothing', async () => {
    const app = buildApp({ dataDir: tmp(), env: {} });
    const notes = ['', '   \n\t  ', Array(5000).fill('word').join(' ')];
    const messages = ['Paste or type your notes first.', 'Paste or type your notes first.', 'Notes are limited to 20,000 characters.'];
    for (const [i, text] of notes.entries()) {
      const before = (await state(app)).workspace;
      const res = await post(app, '/api/actions/notes', { revision: before.revision, text });
      expect(res.status).toBe(422);
      expect((await res.json()).error).toMatchObject({ code: 'invalid', message: messages[i] });
      expect((await state(app)).workspace.applicant.sources).toEqual([]);
    }
  });

  it('refuses a voice upload over the route’s limit with a plain JSON message, before Meta', async () => {
    const { app, fetch } = await voiceApp();
    const res = await app.request('/api/voice', { method: 'POST', headers: { 'content-type': 'audio/wav' }, body: new Uint8Array(7 * 1024 * 1024) });
    expect(res.status).toBe(413);
    expect((await res.json()).error).toEqual({ code: 'invalid', message: 'Keep a spoken note under 3 minutes.' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('refuses a body that is not a WAV recording with a plain JSON message, before Meta and with no receipt', async () => {
    const { app, fetch } = await voiceApp();
    const res = await app.request('/api/voice', { method: 'POST', headers: { 'content-type': 'audio/wav' }, body: new Uint8Array([1, 2, 3, 4, 5]) });
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatchObject({ code: 'invalid', message: 'Send the recording as a mono 16-bit WAV at 16 or 24 kHz.' });
    expect(fetch).not.toHaveBeenCalled();
    expect((await (await app.request('/api/receipts')).json()).receipts).toEqual([]);
  });

  it('refuses an unknown sample id for startPrepared and startSample', async () => {
    const app = buildApp({ dataDir: tmp(), env: {} });
    for (const name of ['startPrepared', 'startSample']) {
      const res = await post(app, `/api/actions/${name}`, { revision: (await state(app)).workspace.revision, sampleId: 'nope' });
      expect(res.status).toBe(422);
      expect((await res.json()).error).toMatchObject({ code: 'invalid', message: 'There is no such sample.' });
    }
    expect((await state(app)).workspace.applicant.sources).toEqual([]);
  });
});
