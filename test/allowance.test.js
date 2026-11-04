// A hosted visitor's live allowance. The model is decided once per workspace,
// so a journey never switches from Meta to the fixture half-way (the fixture's
// facts would not match Meta's).
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../scripts/journey.mjs';
import { createApp } from '../server/app.js';
import { buildApp } from '../server/build.js';
import { overCeiling, spentUsd, UNKNOWN_COST_USD, workspaceMode } from '../server/http/allowance.js';
import { form } from './helpers.js';

const createdAt = '2026-10-27T10:00:00.000Z';
const receipt = (provider, costUsd, at) => ({ provider, costUsd, at });
const CEILING = 'This visit has used its live Meta allowance. Press Start again to continue with Ellie’s or Ana’s labelled sample.';

describe('workspaceMode', () => {
  it('runs live while the visitor is under the cap', () => {
    expect(workspaceMode({ receipts: [receipt('meta', 0.4, '2026-10-27T09:00:00.000Z')], createdAt, capUsd: 1.5 })).toBe('model');
  });

  it('puts a new workspace on the fixture once the visitor has spent the cap', () => {
    const spent = [receipt('meta', 0.9, '2026-10-27T08:00:00.000Z'), receipt('meta', 0.7, '2026-10-27T09:00:00.000Z')];
    expect(workspaceMode({ receipts: spent, createdAt, capUsd: 1.5 })).toBe('fixture');
  });

  it('never switches a journey half-way: a workspace keeps the provider it started with', () => {
    expect(workspaceMode({ receipts: [receipt('meta', 2, '2026-10-27T08:00:00.000Z'), receipt('meta', 0.1, '2026-10-27T10:01:00.000Z')], createdAt, capUsd: 1.5 })).toBe('model');
    expect(workspaceMode({ receipts: [receipt('fixture', 0, '2026-10-27T10:01:00.000Z')], createdAt, capUsd: 1.5 })).toBe('fixture');
  });

  it('puts a new workspace on the fixture when the demo’s own budget has less than a journey left', () => {
    expect(workspaceMode({ receipts: [], createdAt, capUsd: 1.5, ledgerLeftUsd: 0.3 })).toBe('fixture');
    expect(workspaceMode({ receipts: [], createdAt, capUsd: 1.5, ledgerLeftUsd: 5 })).toBe('model');
    expect(workspaceMode({ receipts: [receipt('meta', 0.2, '2026-10-27T10:01:00.000Z')], createdAt, capUsd: 1.5, ledgerLeftUsd: 0.3 })).toBe('model');
  });

  it('counts a step of unknown cost as spent, and runs live when there is no cap', () => {
    expect(workspaceMode({ receipts: [receipt('meta', null, '2026-10-27T08:00:00.000Z')], createdAt, capUsd: 0.05 })).toBe('fixture');
    expect(workspaceMode({ receipts: [receipt('meta', 5, '2026-10-27T08:00:00.000Z')], createdAt, capUsd: undefined })).toBe('model');
  });

  it('starts a new workspace live only while the demo’s budget still covers a whole visitor allowance', () => {
    expect(workspaceMode({ receipts: [], createdAt, capUsd: 3, ledgerLeftUsd: 2.99 })).toBe('fixture');
    expect(workspaceMode({ receipts: [], createdAt, capUsd: 3, ledgerLeftUsd: 3 })).toBe('model');
    // A small allowance still keeps one whole journey in hand.
    expect(workspaceMode({ receipts: [], createdAt, capUsd: 0.2, ledgerLeftUsd: 0.49 })).toBe('fixture');
    expect(workspaceMode({ receipts: [], createdAt, capUsd: 0.2, ledgerLeftUsd: 0.5 })).toBe('model');
    // A journey already running keeps going on what is left.
    expect(workspaceMode({ receipts: [receipt('meta', 0.2, '2026-10-27T10:01:00.000Z')], createdAt, capUsd: 3, ledgerLeftUsd: 0.1 })).toBe('model');
  });
});

describe('the hard ceiling on a visitor’s live spend', () => {
  it('counts every workspace the visitor started, an unknown cost as UNKNOWN_COST_USD and the fixture as nothing', () => {
    const receipts = [receipt('meta', 1, '2026-10-20T09:00:00.000Z'), receipt('meta', null, '2026-10-27T10:01:00.000Z'), receipt('fixture', 0, '2026-10-28T10:00:00.000Z')];
    expect(spentUsd(receipts)).toBeCloseTo(1 + UNKNOWN_COST_USD, 9);
  });

  it('is reached at twice the visitor cap, and is off without one', () => {
    expect(overCeiling([receipt('meta', 2.5, createdAt), receipt('meta', 0.49, createdAt)], 1.5)).toBe(false);
    expect(overCeiling([receipt('meta', 2.5, createdAt), receipt('meta', 0.5, createdAt)], 1.5)).toBe(true);
    expect(overCeiling([receipt('meta', 100, createdAt)], undefined)).toBe(false);
  });

  describe('on a hosted visit', () => {
    // Any model or Voice Transcribe call would land here, and fail the test.
    const noModel = vi.fn(async () => { throw new Error('No model call may be made in this test.'); });
    beforeEach(() => { noModel.mockClear(); vi.stubGlobal('fetch', noModel); });
    afterEach(() => vi.unstubAllGlobals());

    // $1.40 in an earlier workspace and $1.70 in this live one: past twice the $1.50 allowance.
    async function visitorPastCeiling() {
      const dataDir = mkdtempSync(join(tmpdir(), 'ceiling-'));
      const app = buildApp({ dataDir, env: { PROVIDER: 'meta', META_API_KEY: 'k', VISITOR_COOKIE: '1', VISITOR_CAP_USD: '1.5', SPEND_LEDGER_FILE: join(dataDir, 'ledger.json') } });
      const id = /ae_visitor=([^;]+)/.exec((await app.request('/api/state')).headers.get('set-cookie'))[1];
      const headers = { cookie: `ae_visitor=${id}`, 'content-type': 'application/json' };
      const api = apiClient((method, path, body) => app.request(path, { method, headers, body: body && JSON.stringify(body) }));
      await api.get('/api/state');
      const state = await api.act('notes', { text: 'I built a GPU job runner with three classmates.' });
      // Fixed past times, so Start again's new workspace is always later than both.
      writeFileSync(join(dataDir, 'users', id, 'workspace.json'), JSON.stringify({ ...state.workspace, createdAt }));
      const spent = [receipt('meta', 1.4, '2026-10-26T09:00:00.000Z'), receipt('meta', 1.7, '2026-10-27T10:30:00.000Z')];
      writeFileSync(join(dataDir, 'users', id, 'receipts.jsonl'), spent.map((r) => `${JSON.stringify(r)}\n`).join(''));
      return { app, api, headers, sourceId: state.result.id };
    }

    it('refuses the next live step and spoken note half-way through a journey, without calling Meta', async () => {
      const { app, api, headers, sourceId } = await visitorPastCeiling();
      expect((await api.get('/api/state')).mode.id).toBe('meta');
      await expect(api.run('read', { sourceId })).rejects.toThrow(`limit: ${CEILING}`);
      const voice = await app.request('/api/voice', { method: 'POST', headers: { ...headers, 'content-type': 'audio/wav' }, body: new Uint8Array(64) });
      expect(voice.status).toBe(429);
      expect((await voice.json()).error).toEqual({ code: 'limit', message: CEILING });
      expect(noModel).not.toHaveBeenCalled();
    });

    it('is not reset by Start again, and never stops Ellie’s labelled sample on the fixture', async () => {
      const { api } = await visitorPastCeiling();
      expect((await api.reset()).mode).toMatchObject({ id: 'fixture', fallbackReason: 'live-allowance-unavailable' });
      const sample = await api.get('/api/sample');
      let state = await api.act('notes', { text: sample.notes });
      state = await api.run('read', { sourceId: state.result.id });
      expect(state.mode.id).toBe('fixture');
      expect(state.result.accepted.length).toBeGreaterThan(0);
      expect(noModel).not.toHaveBeenCalled();
    });
  });

  it('is checked as each step starts, so steps sent together cannot spend past it', async () => {
    let release;
    const held = new Promise((resolve) => { release = resolve; });
    const extract = vi.fn(async ({ emit }) => {
      await held;
      emit({ type: 'receipt', receipt: { step: 'extract', provider: 'meta', costUsd: 3 } });
      return { facts: [], conflicts: [] };
    });
    const agent = { provider: { id: 'meta', label: 'Meta (test double)', isMeta: true }, extract, forUser: vi.fn(() => agent) };
    const app = createApp({ dataDir: mkdtempSync(join(tmpdir(), 'ceiling-')), form, agent, fallback: { provider: { id: 'fixture', label: 'Fixture' } }, visitorCapUsd: 1.5 });
    const headers = { 'content-type': 'application/json' };
    const api = apiClient((method, path, body) => app.request(path, { method, headers, body: body && JSON.stringify(body) }));
    await api.get('/api/state');
    const a = await api.act('notes', { text: 'First note.' });
    const b = await api.act('notes', { text: 'Second note.' });
    const read = (sourceId, revision) => app.request('/api/run/read', { method: 'POST', headers, body: JSON.stringify({ revision, sourceId }) }).then((r) => r.text());
    const first = read(a.result.id, b.workspace.revision);
    await vi.waitFor(() => expect(extract).toHaveBeenCalledTimes(1));
    const second = read(b.result.id, b.workspace.revision + 1);
    await vi.waitFor(() => expect(agent.forUser).toHaveBeenCalledTimes(2)); // queued while nothing is spent yet
    release();
    const [done, refused] = (await Promise.all([first, second])).map((text) => JSON.parse(text.trim().split('\n').at(-1)));
    expect(done.type).toBe('done');
    expect(refused).toMatchObject({ type: 'error', error: { code: 'limit', message: CEILING } });
    expect(extract).toHaveBeenCalledTimes(1);
  });
});

describe('a hosted visitor over the cap', () => {
  async function visitorOverCap() {
    const dataDir = mkdtempSync(join(tmpdir(), 'allowance-'));
    const env = { PROVIDER: 'meta', META_API_KEY: 'k', VISITOR_COOKIE: '1', VISITOR_CAP_USD: '1.5', SPEND_LEDGER_FILE: join(dataDir, 'ledger.json') };
    const app = buildApp({ dataDir, env });
    const id = /ae_visitor=([^;]+)/.exec((await app.request('/api/state')).headers.get('set-cookie'))[1];
    mkdirSync(join(dataDir, 'users', id), { recursive: true });
    writeFileSync(join(dataDir, 'users', id, 'receipts.jsonl'), `${JSON.stringify({ provider: 'meta', isMeta: true, costUsd: 1.6, flow: 'draft', at: '2026-01-01T00:00:00.000Z' })}\n`);
    const headers = { cookie: `ae_visitor=${id}`, 'content-type': 'application/json' };
    return apiClient((method, path, body) => app.request(path, { method, headers, body: body && JSON.stringify(body) }));
  }

  it('runs Ellie’s sample on the hand-written fixture, and says so', async () => {
    const api = await visitorOverCap();
    const sample = await api.get('/api/sample');
    let state = await api.act('notes', { text: sample.notes });
    state = await api.run('read', { sourceId: state.result.id });
    expect(state.mode).toMatchObject({ id: 'fixture', isMeta: false, label: 'Fixture: the live Meta allowance for this demo is used up', fallbackReason: 'live-allowance-unavailable' });
    expect(state.result.accepted.length).toBeGreaterThan(0);
    expect((await api.get('/api/receipts')).mode.id).toBe('fixture');
  });

  it('will not start Marcus’s live-only sample once the visitor’s allowance is used up', async () => {
    const api = await visitorOverCap();
    await expect(api.act('startSample', { sampleId: 'marcus' })).rejects.toThrow('Marcus’s sample needs the live model');
  });

  it('will not run the applicant’s own notes on the fixture, and says why', async () => {
    const api = await visitorOverCap();
    await api.get('/api/state');
    const state = await api.act('notes', { text: 'I built a GPU job runner with three classmates.' });
    await expect(api.run('read', { sourceId: state.result.id })).rejects.toThrow('limit: You have used this demo’s live Meta allowance. Ellie’s sample and Ana’s written note still run on the hand-written fixture.');
  });
});

it('explains the allowance fallback after reset without deleting prior spend', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'allowance-reset-'));
  const app = buildApp({ dataDir, env: { PROVIDER: 'meta', META_API_KEY: 'k', VISITOR_COOKIE: '1', VISITOR_CAP_USD: '1.5', SPEND_LEDGER_FILE: join(dataDir, 'ledger.json') } });
  const first = await app.request('/api/state');
  const id = /ae_visitor=([^;]+)/.exec(first.headers.get('set-cookie'))[1];
  const initial = await first.json();
  initial.workspace.createdAt = '2026-10-27T00:00:00.000Z';
  mkdirSync(join(dataDir, 'users', id), { recursive: true });
  writeFileSync(join(dataDir, 'users', id, 'workspace.json'), JSON.stringify(initial.workspace));
  writeFileSync(join(dataDir, 'users', id, 'receipts.jsonl'), JSON.stringify(receipt('meta', 1.6, '2026-10-27T01:00:00.000Z')) + '\n');
  const headers = { cookie: `ae_visitor=${id}`, 'content-type': 'application/json' };
  const api = apiClient((method, path, body) => app.request(path, { method, headers, body: body && JSON.stringify(body) }));
  expect((await api.get('/api/state')).mode.id).toBe('meta');
  const reset = await api.reset();
  expect(reset.mode).toMatchObject({ id: 'fixture', fallbackReason: 'live-allowance-unavailable' });
  expect((await api.get('/api/receipts')).receipts).toEqual([]);
  expect((await api.reset()).mode.fallbackReason).toBe('live-allowance-unavailable');
});

describe('a hosted demo whose own budget is nearly spent', () => {
  it('runs a new visitor’s sample on the labelled fixture instead of failing', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'allowance-'));
    const ledger = join(dataDir, 'ledger.json');
    writeFileSync(ledger, JSON.stringify({ entries: [{ id: 'earlier', status: 'settled', reservedUsd: 39.8, chargedUsd: 39.8, at: '2026-10-27T09:00:00.000Z' }] }));
    const app = buildApp({ dataDir, env: { PROVIDER: 'meta', META_API_KEY: 'k', VISITOR_COOKIE: '1', VISITOR_CAP_USD: '1.5', SPEND_CAP_USD: '40', SPEND_LEDGER_FILE: ledger } });
    const id = /ae_visitor=([^;]+)/.exec((await app.request('/api/state')).headers.get('set-cookie'))[1];
    const headers = { cookie: `ae_visitor=${id}`, 'content-type': 'application/json' };
    const api = apiClient((method, path, body) => app.request(path, { method, headers, body: body && JSON.stringify(body) }));
    const sample = await api.get('/api/sample');
    let state = await api.act('notes', { text: sample.notes });
    state = await api.run('read', { sourceId: state.result.id });
    expect(state.mode).toMatchObject({ id: 'fixture', label: 'Fixture: the live Meta allowance for this demo is used up', fallbackReason: 'live-allowance-unavailable' });
  });
});

describe('new visitors per network', () => {
  it('lets a network start only so many new visitors a day, and never counts a returning one', async () => {
    const app = buildApp({ dataDir: mkdtempSync(join(tmpdir(), 'allowance-')), env: { VISITOR_COOKIE: '1', VISITOR_IDS_PER_IP_PER_DAY: '3' } });
    // The ingress appends the client's real address after anything the client sent.
    const from = (ip, cookie) => app.request('/api/state', { headers: { 'x-forwarded-for': `10.0.0.1, ${ip}`, ...(cookie ? { cookie } : {}) } });
    const first = await from('203.0.113.9');
    const cookie = `ae_visitor=${/ae_visitor=([^;]+)/.exec(first.headers.get('set-cookie'))[1]}`;
    expect((await from('203.0.113.9')).status).toBe(200);
    expect((await from('203.0.113.9')).status).toBe(200);
    const over = await from('203.0.113.9');
    expect(over.status).toBe(429);
    expect(over.headers.get('set-cookie')).toBeNull();
    expect((await over.json()).error).toEqual({ code: 'limit', message: 'Too many new visits from this network today. Open the link in the same browser, or try again tomorrow.' });
    expect((await from('203.0.113.9', cookie)).status).toBe(200);
    expect((await from('198.51.100.7')).status).toBe(200);
  });

  it('counts the address the ingress appends, so a forged X-Forwarded-For entry cannot dodge the limit', async () => {
    const app = buildApp({ dataDir: mkdtempSync(join(tmpdir(), 'allowance-')), env: { VISITOR_COOKIE: '1', VISITOR_IDS_PER_IP_PER_DAY: '2' } });
    const claiming = (claimed) => app.request('/api/state', { headers: { 'x-forwarded-for': `${claimed}, 203.0.113.9` } });
    expect((await claiming('192.0.2.1')).status).toBe(200);
    expect((await claiming('192.0.2.2')).status).toBe(200);
    expect((await claiming('192.0.2.3')).status).toBe(429);
  });
});
