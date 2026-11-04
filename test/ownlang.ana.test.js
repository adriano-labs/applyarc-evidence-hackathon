// Ana's sample with no key: her Portuguese notes on a public care advert, read by the
// hand-written fixture (labelled as such on screen), through the same HTTP API as Ellie's.
// Her language goes to Meta Voice Transcribe as a hint only when she has chosen one.
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { apiClient } from '../scripts/journey.mjs';
import { createLedger } from '../server/agent/budget.js';
import { createVoice, wavInfo } from '../server/agent/voice.js';
import { buildApp } from '../server/build.js';
import { fromRoot } from '../server/paths.js';

const appWith = (env = {}) => buildApp({ dataDir: mkdtempSync(join(tmpdir(), 'ana-')), env });
const clientFor = (app) => apiClient((method, path, body) => app.request(path, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) }));
const clip = (name) => new Uint8Array(readFileSync(fromRoot('client', 'public', 'samples', name)));

describe('Ana’s sample', () => {
  it('is a third card: a care worker who speaks Portuguese, with her bundled synthetic voice clips', async () => {
    const { samples, languages } = await (await appWith().request('/api/sample')).json();
    const ana = samples.find((s) => s.id === 'ana');
    expect(ana).toMatchObject({ name: 'Ana', field: 'Care worker', language: 'pt-PT', liveOnly: false, voice: 'Synthetic voice, fictional applicant', voiceHint: true, minutes: 2 });
    expect(ana.timing).toBe('Meta’s models take about 2 minutes; allow a few more to read and confirm.');
    expect(ana.thesis.quote).toBe('Using AI? Please follow our guidance to ensure your application reflects your own knowledge and experience');
    expect(ana.form).toMatchObject({ company: 'North Yorkshire Council', role: 'Care and Support Worker' });
    expect(ana.form.documents[0].requirements).toHaveLength(10);
    expect(languages).toEqual([{ code: 'en', name: 'English', native: 'English' }, { code: 'pt-PT', name: 'Portuguese', native: 'Português' }]);
    for (const name of Object.values(ana.clips)) {
      expect(wavInfo(clip(name.replace('/samples/', '')))).toMatchObject({ sampleRate: 16000, channels: 1, bitsPerSample: 16 });
    }
  });

  it('runs her whole journey on the fixture: Portuguese quotes, English meanings, numbers kept, one correction across both documents', async () => {
    const api = clientFor(appWith());
    await api.reset();
    const ana = (await api.get('/api/sample')).samples.find((s) => s.id === 'ana');
    let state = await api.act('startSample', { sampleId: 'ana' });
    state = await api.run('read', { sourceId: state.result.id });
    expect(state.result).toMatchObject({ refused: [] });
    expect(state.result.accepted).toHaveLength(11);
    const facts = state.workspace.applicant.facts;
    expect(facts.every((f) => f.language === 'pt-PT' && ['self', 'team', 'other'].includes(f.actor))).toBe(true);
    expect(facts.filter((f) => f.actor === 'team').map((f) => f.quote)).toEqual(['trabalhamos sempre em dupla', expect.stringContaining('nós, a equipa toda')]);
    state = await api.act('confirmFacts', { factIds: state.result.accepted });
    expect(state.view.coverage.filter((r) => !r.covered).map((r) => r.id)).toEqual(['dignity']);

    state = await api.run('check');
    const [question] = state.workspace.application.questions;
    expect(question).toMatchObject({ requirementId: 'dignity', status: 'open' });
    expect(question.text).toMatch(/^O formulário pede/);
    expect(question.english).toMatch(/^The form asks/);
    state = await api.act('answer', { questionId: question.id, text: ana.answer });
    state = await api.run('read', { sourceId: state.result.source.id });
    state = await api.act('confirmFacts', { factIds: state.result.accepted });
    expect(state.view.coverage.every((r) => r.covered)).toBe(true);

    state = await api.run('draft');
    expect(state.result.dropped).toEqual([]);
    const text = (id) => state.workspace.application.documents[id].segments.map((s) => s.text).join(' ');
    expect(text('answer')).toContain('for three years, since October 2023');
    expect(text('answer')).toContain('for 18 residents');
    expect(text('letter')).toContain('I did three years of nights');

    const nights = state.workspace.applicant.facts.find((f) => f.quote === ana.correction.quote);
    const { text: correction, meaning, actor } = ana.correction;
    state = await api.act('changeFact', { factId: nights.id, text: correction, meaning, actor });
    const reopened = state.workspace.application.repair.items;
    expect(reopened.map((i) => i.docId)).toEqual(['answer', 'letter']);
    const untouched = ['answer', 'letter'].flatMap((d) => state.workspace.application.documents[d].segments).filter((s) => !s.factIds.includes(nights.id));
    state = await api.run('repair');
    expect(state.workspace.application.repair.items.map((i) => i.after)).toEqual(['I worked night shifts for two years, and in the last year I moved to days.', 'I worked night shifts for two years, and in the last year I moved to days.']);
    state = await api.act('applyChanges');
    const after = ['answer', 'letter'].flatMap((d) => state.workspace.application.documents[d].segments).filter((s) => !s.factIds.includes(nights.id));
    expect(after.map((s) => s.text)).toEqual(untouched.map((s) => s.text));
    for (const d of ['answer', 'letter']) state = await api.act('approve', { docId: d, docRevision: state.workspace.application.documents[d].revision });

    const pack = await api.act('export');
    expect(pack.result.status).toBe('NOT SUBMITTED');
    const reference = pack.result.documents[0].references.find((r) => r.factId === nights.id);
    expect(reference).toMatchObject({ quote: correction, statement: meaning, language: 'pt-PT', from: 'correction' });
    const { checks } = await api.get('/api/verify');
    expect(checks.map((c) => [c.id, c.pass])).toEqual([['quotes', true], ['citations', true], ['numbers', true], ['approvals', true], ['own', true], ['export', true], ['review', true]]);
  });

  it('starts from the written notes on the fixture, whatever text the browser sends', async () => {
    const api = clientFor(appWith());
    await api.reset();
    const state = await api.act('startSample', { sampleId: 'ana', text: 'Something else entirely.' });
    expect(state.workspace.applicant.sources[0].text).toBe(readFileSync(fromRoot('fixtures', 'ana-notes-pt.txt'), 'utf8').trim());
  });
});

describe('her language as a hint to Meta Voice Transcribe', () => {
  const reply = () => vi.fn(async () => new Response(JSON.stringify({ transcript: 'Chamo-me Ana.', audioDurationMs: 1000 }), { status: 200 }));
  const ledger = () => createLedger({ file: join(mkdtempSync(join(tmpdir(), 'hint-')), 'l.json'), capUsd: 1 });
  const settings = async (fetch) => JSON.parse(await fetch.mock.calls[0][1].body.get('request').text());

  it('sends languageBias for a chosen language, and nothing otherwise', async () => {
    const audio = clip('ana-pt-correction.wav');
    const hinted = reply();
    expect(await createVoice({ key: 'k', ledger: ledger(), fetch: hinted }).transcribe(audio, { callId: 'a', language: 'pt-PT' })).toMatchObject({ hint: 'Portuguese' });
    expect(await settings(hinted)).toEqual({ mode: 'PUSH_TO_TALK', model: 'muse-voice-transcribe-1.0', audioEncoding: 'WAV', languageBias: ['Portuguese'] });
    const plain = reply();
    expect(await createVoice({ key: 'k', ledger: ledger(), fetch: plain }).transcribe(audio, { callId: 'b' })).not.toHaveProperty('hint');
    expect(await settings(plain)).toEqual({ mode: 'PUSH_TO_TALK', model: 'muse-voice-transcribe-1.0', audioEncoding: 'WAV' });
  });

  it('refuses a language the app does not offer before calling Meta', async () => {
    const app = appWith({ PROVIDER: 'meta', META_API_KEY: 'k', META_MODEL: 'muse-wonder-1.0' });
    const res = await app.request('/api/voice?language=xx', { method: 'POST', headers: { 'content-type': 'audio/wav' }, body: clip('ana-pt-correction.wav') });
    expect(res.status).toBe(422);
    expect((await res.json()).error.message).toBe('Choose English or one of the languages offered.');
  });
});
