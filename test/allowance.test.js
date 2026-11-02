// A hosted visitor's live allowance. The model is decided once per workspace,
// so a journey never switches from Meta to the fixture half-way (the fixture's
// facts would not match Meta's).
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { apiClient } from '../scripts/journey.mjs';
import { buildApp } from '../server/build.js';
import { workspaceMode } from '../server/http/allowance.js';

const createdAt = '2026-10-27T10:00:00.000Z';
const receipt = (provider, costUsd, at) => ({ provider, costUsd, at });

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
    expect(state.mode).toMatchObject({ id: 'fixture', isMeta: false, label: 'Fixture: the live Meta allowance for this demo is used up' });
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
    await expect(api.run('read', { sourceId: state.result.id })).rejects.toThrow('limit: You have used this demo’s live Meta allowance. Ellie’s sample still runs on the hand-written fixture.');
  });
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
    expect(state.mode).toMatchObject({ id: 'fixture', label: 'Fixture: the live Meta allowance for this demo is used up' });
  });
});

describe('new visitors per network', () => {
  it('lets a network start only so many new visitors a day, and never counts a returning one', async () => {
    const app = buildApp({ dataDir: mkdtempSync(join(tmpdir(), 'allowance-')), env: { VISITOR_COOKIE: '1', VISITOR_IDS_PER_IP_PER_DAY: '3' } });
    const from = (ip, cookie) => app.request('/api/state', { headers: { 'x-forwarded-for': `${ip}, 10.0.0.1`, ...(cookie ? { cookie } : {}) } });
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
});
