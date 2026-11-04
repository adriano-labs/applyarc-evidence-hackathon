// Start at the key moment: Ellie's sample as a real Muse Wonder run saved it, loaded as a visitor's
// own workspace. Only the live model may load it, nothing is charged for it, Start again clears it,
// and the correction that follows runs through the smart path with every invariant kept.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { apiClient } from '../scripts/journey.mjs';
import { createApp } from '../server/app.js';
import { buildApp } from '../server/build.js';
import { fromRoot } from '../server/paths.js';

const saved = JSON.parse(readFileSync(fromRoot('fixtures', 'ellie-prepared-wonder-20261103.json'), 'utf8'));
const NOTE = 'Sam wrote the Helm patch. I reproduced the failure, tested his fix and wrote the incident notes.';
const EARLIER = 'I wrote the helm patch that fixed it.';
const NEEDS_LIVE = 'Starting at the key moment needs the live model.';
const dir = () => mkdtempSync(join(tmpdir(), 'prepared-'));
const clientFor = (app, headers = {}) => apiClient((method, path, body) => app.request(path, { method, headers: { 'content-type': 'application/json', ...headers }, body: body && JSON.stringify(body) }));
const visitorOf = async (app) => ({ cookie: `ae_visitor=${/ae_visitor=([^;]+)/.exec((await app.request('/api/state')).headers.get('set-cookie'))[1]}` });
const liveEnv = { PROVIDER: 'meta', META_API_KEY: 'k', VISITOR_COOKIE: '1' };

// A stand-in for the live model: it flags the note's contradiction, rewrites each reopened sentence
// as the corrected fact's own words, and finds its own rewrites supported. Never a real call.
function liveAgent() {
  const receipt = (step, emit) => emit({ type: 'receipt', receipt: { step, provider: 'meta', isMeta: true, model: 'muse-wonder-1.0', costUsd: 0.01, totalMs: 1000, toolCalls: [] } });
  return {
    provider: { id: 'meta', label: 'Meta Muse Wonder 1.0', model: 'muse-wonder-1.0', isMeta: true },
    extract: vi.fn(async ({ source, emit }) => {
      receipt('extract', emit);
      return { facts: [], conflicts: [{ quote: source.text, priorSourceId: 's2', priorQuote: EARLIER, question: 'Who wrote the Helm patch?' }] };
    }),
    repair: vi.fn(async ({ fact, items, emit }) => {
      receipt('repair', emit);
      return { rewrites: items.map((i) => ({ segmentId: i.segmentId, text: fact.quote, factIds: [fact.id] })) };
    }),
    review: vi.fn(async ({ claims }) => ({ decisions: claims.map((c) => ({ id: c.id, verdict: 'supported', reason: 'Faithful to the correction.' })) })),
  };
}

describe('the prepared state', () => {
  it('is Ellie’s sample as a real Muse Wonder run saved it, with a marker saying so', () => {
    expect(saved.prepared).toMatchObject({ sample: 'ellie', provider: 'meta', model: 'muse-wonder-1.0', ranAt: '2026-11-03T16:03:18.705Z', ranUntil: '2026-11-03T16:05:36.316Z', note: NOTE });
    expect(saved.applicant.name).toBe('Ellie');
    expect(saved.applicant.sources.map((s) => [s.kind, s.read])).toEqual([['notes', true], ['answer', true]]);
    expect(saved.applicant.sources[0].text).toBe(readFileSync(fromRoot('fixtures', 'ellie-notes.md'), 'utf8'));
    expect(saved.applicant.facts).toHaveLength(12);
    expect(saved.applicant.facts.every((f) => f.status === 'confirmed')).toBe(true);
    const { documents, approvals, repair, lastRepair } = saved.application;
    expect([documents.answer.revision, documents.letter.revision]).toEqual([2, 1]);
    expect(documents.answer.segments[0].author).toBe('user'); // her own rewritten opening
    expect(approvals).toEqual({ answer: { revision: 2, at: expect.any(String) }, letter: { revision: 1, at: expect.any(String) } });
    expect([repair, lastRepair]).toEqual([null, undefined]);
  });

  it('is announced on Ellie’s sample, so the card can offer it', async () => {
    const { samples } = await (await buildApp({ dataDir: dir(), env: {} }).request('/api/sample')).json();
    expect(samples[0].prepared).toMatchObject({ model: 'muse-wonder-1.0', ranAt: '2026-11-03T16:03:18.705Z', note: NOTE });
    expect(samples[1].prepared).toBeUndefined();
  });
});

describe('starting at the key moment', () => {
  it('loads the saved state as this visitor’s own workspace, marked with when and from what', async () => {
    const app = buildApp({ dataDir: dir(), env: liveEnv });
    const api = clientFor(app, await visitorOf(app));
    const before = Date.now();
    const state = await api.act('startPrepared');
    const { workspace, view, mode } = state;
    expect(workspace.applicant).toEqual(saved.applicant);
    expect(workspace.application).toEqual(saved.application);
    expect(workspace.prepared).toEqual({ ...saved.prepared, loadedAt: workspace.createdAt });
    expect(Date.parse(workspace.createdAt)).toBeGreaterThanOrEqual(before - 1000);
    expect(view.next).toBe('export');
    expect(view.approvals).toEqual({ answer: 'approved', letter: 'approved' });
    expect(mode.id).toBe('meta');
    expect((await api.get('/api/state')).workspace).toEqual(workspace);
  });

  it('charges the visitor nothing: the run’s receipts are not theirs', async () => {
    const app = buildApp({ dataDir: dir(), env: liveEnv });
    const api = clientFor(app, await visitorOf(app));
    await api.act('startPrepared');
    const { receipts, budget } = await api.get('/api/receipts');
    expect(receipts).toEqual([]);
    expect(budget).toMatchObject({ spentUsd: 0, reservedUsd: 0 });
  });

  it('keeps it to the visitor who asked, and Start again clears it as usual', async () => {
    const app = buildApp({ dataDir: dir(), env: liveEnv });
    const a = clientFor(app, await visitorOf(app));
    const b = clientFor(app, await visitorOf(app));
    await a.act('startPrepared');
    expect((await b.get('/api/state')).workspace).toMatchObject({ applicant: { sources: [] } });
    expect((await b.get('/api/state')).workspace.prepared).toBeUndefined();
    const fresh = await a.reset();
    expect(fresh.workspace.applicant.sources).toEqual([]);
    expect(fresh.workspace.prepared).toBeUndefined();
    expect((await a.act('startPrepared')).workspace.prepared.sample).toBe('ellie');
  });

  it('never replaces a workspace that has started', async () => {
    const app = buildApp({ dataDir: dir(), env: liveEnv });
    const api = clientFor(app, await visitorOf(app));
    await api.act('startPrepared');
    await expect(api.act('startPrepared')).rejects.toThrow('Press Start again first.');
    await api.reset();
    await api.act('notes', { text: 'I built a GPU job runner with three classmates.' });
    await expect(api.act('startPrepared')).rejects.toThrow('Press Start again first.');
  });

  it('is refused on the hand-written fixture', async () => {
    const api = clientFor(buildApp({ dataDir: dir(), env: {} }));
    await api.get('/api/state');
    await expect(api.act('startPrepared')).rejects.toThrow(NEEDS_LIVE);
  });

  it('is refused once a hosted visitor’s live allowance is used up', async () => {
    const dataDir = dir();
    const app = buildApp({ dataDir, env: { ...liveEnv, VISITOR_CAP_USD: '1.5', SPEND_LEDGER_FILE: join(dataDir, 'ledger.json') } });
    const headers = await visitorOf(app);
    const id = headers.cookie.slice('ae_visitor='.length);
    mkdirSync(join(dataDir, 'users', id), { recursive: true });
    writeFileSync(join(dataDir, 'users', id, 'receipts.jsonl'), `${JSON.stringify({ provider: 'meta', isMeta: true, costUsd: 1.6, flow: 'draft', at: '2026-01-01T00:00:00.000Z' })}\n`);
    const api = clientFor(app, headers);
    expect((await api.get('/api/state')).mode.id).toBe('fixture');
    await expect(api.act('startPrepared')).rejects.toThrow(NEEDS_LIVE);
  });
});

describe('the correction after the key moment', () => {
  it('runs the smart path live and keeps every invariant', async () => {
    const agent = liveAgent();
    const api = clientFor(createApp({ dataDir: dir(), form: saved.application.form, agent, prepared: saved }));
    await api.get('/api/state');
    let state = await api.act('startPrepared');
    const before = structuredClone(state.workspace.application.documents);

    // New evidence clears the approvals; the live model reads it against every active source.
    state = await api.act('notes', { text: NOTE });
    expect(state.workspace.application.approvals).toEqual({ answer: null, letter: null });
    state = await api.run('read', { sourceId: state.result.id });
    expect(agent.extract.mock.calls[0][0].evidence.map((s) => s.id)).toEqual(['s1', 's2', 's3']);
    expect(state.view.next).toBe('question');
    expect(state.view.sourceCorrections).toEqual([{ questionId: 'q2', sourceId: 's3', factId: 'f12', before: EARLIER, text: NOTE }]);
    expect(state.view.exportBlockers[0]).toMatch(/conflicting details/);
    expect(state.workspace.application.documents).toEqual(before);

    // Use this correction: the fact changes, and only the sentences that cite it reopen.
    state = await api.act('resolveSourceConflict', state.view.sourceCorrections[0]);
    expect(state.workspace.applicant.facts.find((f) => f.id === 'f12')).toMatchObject({ statement: NOTE, sourceId: 's4', history: [{ quote: EARLIER, sourceId: 's2' }] });
    expect(state.workspace.application.repair.items.map((i) => [i.docId, i.segmentId, i.status])).toEqual([['answer', 'answer-10', 'pending'], ['letter', 'letter-9', 'pending']]);
    expect(state.view.next).toBe('repair-proposal');
    state = await api.run('repair');
    expect(state.workspace.application.repair.items.every((i) => i.status === 'proposed' && i.after === NOTE)).toBe(true);
    await expect(api.act('approve', { docId: 'answer', docRevision: 2 })).rejects.toThrow('Finish reviewing the changes first.');

    // Apply: new versions, her own opening and every other sentence exactly as they were.
    state = await api.act('applyChanges');
    expect(state.result).toMatchObject({ changed: 2, kept: 0, reopened: 2, untouched: 20, docs: ['answer', 'letter'] });
    const { answer, letter } = state.workspace.application.documents;
    expect([answer.revision, letter.revision]).toEqual([3, 2]);
    expect(answer.segments[0]).toEqual(before.answer.segments[0]);
    expect(answer.segments.slice(0, 9)).toEqual(before.answer.segments.slice(0, 9));
    expect(answer.segments[9]).toMatchObject({ id: 'answer-10', text: NOTE, factIds: ['f12'], author: 'repair' });
    expect(letter.segments.filter((s) => s.id !== 'letter-9')).toEqual(before.letter.segments.filter((s) => s.id !== 'letter-9'));

    // Approval is for the exact version; the pack is NOT SUBMITTED; the trail is this visit's alone.
    await expect(api.act('approve', { docId: 'answer', docRevision: 2 })).rejects.toThrow('changed since you read it');
    state = await api.act('approve', { docId: 'answer', docRevision: 3 });
    state = await api.act('approve', { docId: 'letter', docRevision: 2 });
    expect(state.view.next).toBe('export');
    const pack = await api.act('export');
    expect(pack.result.status).toBe('NOT SUBMITTED');
    expect(pack.result.documents.map((d) => d.revision)).toEqual([3, 2]);
    const { receipts } = await api.get('/api/receipts');
    expect(receipts.map((r) => [r.step, r.flow])).toEqual([['extract', 'read'], ['repair', 'repair']]);
    expect(agent.review).toHaveBeenCalledOnce();
  });
});

// Ana's key moment: her own saved state, chosen by sample id; Ellie's stays the default.
describe('a prepared state for another sample', () => {
  const ana = { ...structuredClone(saved), prepared: { ...saved.prepared, sample: 'ana', note: 'Correção: foram dois anos.' } };
  const appWith = () => createApp({ dataDir: dir(), form: saved.application.form, agent: liveAgent(), visitorCookie: true, sample: { name: 'Ellie' }, prepared: saved, preparedFor: { ana } });

  it('loads the state saved for the sample asked for, and Ellie’s when none is named', async () => {
    const app = appWith();
    const api = clientFor(app, await visitorOf(app));
    await api.get('/api/state');
    expect((await api.act('startPrepared', { sampleId: 'ana' })).workspace.prepared).toMatchObject({ sample: 'ana', note: 'Correção: foram dois anos.' });
    await api.reset();
    expect((await api.act('startPrepared')).workspace.prepared).toMatchObject({ sample: 'ellie', note: NOTE });
    await api.reset();
    expect((await api.act('startPrepared', { sampleId: 'ellie' })).workspace.prepared.sample).toBe('ellie');
    await api.reset();
    await expect(api.act('startPrepared', { sampleId: 'nobody' })).rejects.toThrow('There is no such sample.');
  });
});

describe('Ana’s prepared key moment', () => {
  const ana = JSON.parse(readFileSync(fromRoot('fixtures', 'ana-prepared-wonder-20261103.json'), 'utf8'));

  it('is a real Muse Wonder run of her sample, both documents approved and no correction yet', () => {
    expect(ana.prepared).toMatchObject({ sample: 'ana', provider: 'meta', model: 'muse-wonder-1.0', note: 'Correção: os turnos da noite foram dois anos, não três; no último ano passei a fazer dias.' });
    expect(ana.applicant.name).toBe('Ana');
    expect(ana.applicant.sources.map((s) => [s.kind, s.read, s.language])).toEqual([['notes', true, 'pt-PT'], ['answer', true, 'pt-PT']]);
    expect(ana.applicant.sources[0].spoken).toBe(true);
    expect(ana.applicant.facts.every((f) => f.status !== 'confirmed' || (f.language === 'pt-PT' && ['self', 'team', 'other'].includes(f.actor)))).toBe(true);
    const { documents, approvals, repair } = ana.application;
    expect(approvals.answer.revision).toBe(documents.answer.revision);
    expect(approvals.letter.revision).toBe(documents.letter.revision);
    expect(repair).toBeNull();
  });

  it('is announced on her card and loads for her on the live model only', async () => {
    const { samples } = await (await buildApp({ dataDir: dir(), env: {} }).request('/api/sample')).json();
    expect(samples.find((s) => s.id === 'ana').prepared).toMatchObject({ sample: 'ana', model: 'muse-wonder-1.0' });
    const live = buildApp({ dataDir: dir(), env: liveEnv });
    const api = clientFor(live, await visitorOf(live));
    await api.get('/api/state');
    const state = await api.act('startPrepared', { sampleId: 'ana' });
    expect(state.workspace.prepared).toMatchObject({ sample: 'ana', loadedAt: expect.any(String) });
    expect(state.workspace.applicant.name).toBe('Ana');
    const fixture = buildApp({ dataDir: dir(), env: { VISITOR_COOKIE: '1' } });
    const off = clientFor(fixture, await visitorOf(fixture));
    await off.get('/api/state');
    await expect(off.act('startPrepared', { sampleId: 'ana' })).rejects.toThrow(NEEDS_LIVE);
  });
});
