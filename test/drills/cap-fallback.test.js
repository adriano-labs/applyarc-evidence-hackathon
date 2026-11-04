// @vitest-environment node
// Failure drill: a hosted visitor who has used their live Meta allowance in an earlier workspace
// starts again. Ana's written note runs on the labelled fixture, her voice is off, and Meta is never
// called (any real request fails this test). Ellie's sample is covered in test/allowance.test.js.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../scripts/journey.mjs';
import { buildApp } from '../../server/build.js';

const noNetwork = vi.fn(async () => { throw new Error('no network in this test'); });
beforeEach(() => { noNetwork.mockClear(); vi.stubGlobal('fetch', noNetwork); });
afterEach(() => vi.unstubAllGlobals());

async function visitorOverAllowance() {
  const dataDir = mkdtempSync(join(tmpdir(), 'cap-fallback-'));
  const app = buildApp({ dataDir, env: { PROVIDER: 'meta', META_API_KEY: 'k', VISITOR_COOKIE: '1', VISITOR_CAP_USD: '1.5', SPEND_LEDGER_FILE: join(dataDir, 'ledger.json') } });
  const id = /ae_visitor=([^;]+)/.exec((await app.request('/api/state')).headers.get('set-cookie'))[1];
  mkdirSync(join(dataDir, 'users', id), { recursive: true });
  writeFileSync(join(dataDir, 'users', id, 'receipts.jsonl'), `${JSON.stringify({ provider: 'meta', isMeta: true, costUsd: 1.6, flow: 'draft', at: '2026-01-01T00:00:00.000Z' })}\n`);
  const headers = { cookie: `ae_visitor=${id}`, 'content-type': 'application/json' };
  return { app, headers, api: apiClient((method, path, body) => app.request(path, { method, headers, body: body && JSON.stringify(body) })) };
}

describe('the live allowance used up', () => {
  it('runs Ana’s written note on the labelled fixture, with her voice off, and never calls Meta', async () => {
    const { app, headers, api } = await visitorOverAllowance();
    const fresh = await api.get('/api/state');
    expect(fresh.voice).toBe(false);
    expect(fresh.mode).toMatchObject({ id: 'fixture', label: 'Fixture: the live Meta allowance for this demo is used up', fallbackReason: 'live-allowance-unavailable' });
    const ana = (await api.get('/api/sample')).samples.find((s) => s.id === 'ana');
    let next = await api.act('startSample', { sampleId: 'ana', text: 'Words a voice call would have heard.' });
    expect(next.workspace.applicant.sources[0]).toMatchObject({ text: ana.notes, language: 'pt-PT' });
    expect(next.workspace.applicant.sources[0]).not.toHaveProperty('spoken');
    next = await api.run('read', { sourceId: next.result.id });
    expect(next.mode.id).toBe('fixture');
    expect(next.result.accepted.length).toBeGreaterThan(0);
    expect(next.workspace.applicant.facts.every((f) => f.language === 'pt-PT')).toBe(true);
    const voice = await app.request('/api/voice', { method: 'POST', headers: { ...headers, 'content-type': 'audio/wav' }, body: new Uint8Array(64) });
    expect(voice.status).toBe(429);
    expect((await voice.json()).error).toEqual({ code: 'limit', message: 'You have used this demo’s live Meta allowance. Type your notes instead.' });
    expect(noNetwork).not.toHaveBeenCalled();
  });
});
