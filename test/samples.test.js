// V2-5: two sample applicants from different fields. Ellie (a graduate engineer)
// runs everywhere; Marcus (retail to marketing) needs the live model, because the
// hand-written fixture only knows Ellie.
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { apiClient, runJourney } from '../scripts/journey.mjs';
import { buildApp } from '../server/build.js';
import { fromRoot } from '../server/paths.js';

const marcusNotes = readFileSync(fromRoot('fixtures', 'marcus-notes.md'), 'utf8');
const appWith = (env) => buildApp({ dataDir: mkdtempSync(join(tmpdir(), 'samples-')), env });
const clientFor = (app) => apiClient((method, path, body) => app.request(path, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) }));

describe('the samples', () => {
  it('lists every applicant, with what each needs', async () => {
    const sample = await (await appWith({}).request('/api/sample')).json();
    expect(sample.name).toBe('Ellie');
    expect(sample.samples.map((s) => [s.id, s.name, s.possessive, s.field, s.liveOnly])).toEqual([
      ['ellie', 'Ellie', 'her', 'Graduate engineer', false],
      ['marcus', 'Marcus', 'his', 'Retail to marketing', true],
      ['ana', 'Ana', 'her', 'Care worker', false],
    ]);
    const marcus = sample.samples[1];
    expect(marcus.notes).toBe(marcusNotes);
    expect(marcus.formId).toBe('harbourline-marketing-assistant-sample');
    expect(marcus.correction.anchor).toBe('2,100 followers');
    expect(sample.samples[0].correction.anchor).toEqual(['Helm change', 'Helm patch']);
  });

  it('starts Marcus’s sample on his form with his notes, when a live model is set', async () => {
    const api = clientFor(appWith({ PROVIDER: 'meta', META_API_KEY: 'k' }));
    await api.get('/api/state');
    const state = await api.act('startSample', { sampleId: 'marcus' });
    expect(state.workspace.application.form).toMatchObject({ id: 'harbourline-marketing-assistant-sample', company: 'Harbourline', sample: true });
    expect(state.workspace.applicant.sources).toHaveLength(1);
    expect(state.workspace.applicant.sources[0]).toMatchObject({ kind: 'notes', text: marcusNotes });
    expect(state.result).toEqual({ id: state.workspace.applicant.sources[0].id });
  });

  // Live, 3 Nov: own notes on the shipped form kept the sample's name, so every letter was signed "Ellie".
  it('names the applicant only for a sample: Ellie’s notes or sample, never someone’s own notes', async () => {
    const app = appWith({});
    const api = clientFor(app);
    expect((await api.get('/api/state')).workspace.applicant.name).toBeNull();
    expect((await api.act('notes', { text: 'I built a GPU job runner with three classmates.' })).workspace.applicant.name).toBeNull();
    const { notes } = await (await app.request('/api/sample')).json();
    await api.reset();
    expect((await api.act('notes', { text: notes })).workspace.applicant.name).toBe('Ellie');
    await api.reset();
    expect((await api.act('startSample', { sampleId: 'ellie' })).workspace.applicant.name).toBe('Ellie');
  });

  it('starts Ellie’s sample on the Graphcore form, also on fixtures', async () => {
    const api = clientFor(appWith({}));
    await api.get('/api/state');
    const state = await api.act('startSample', { sampleId: 'ellie' });
    expect(state.workspace.application.form.id).toBe('graphcore-graduate-cloud-platform-engineer-2027');
    expect(state.workspace.applicant.sources[0].kind).toBe('notes');
  });

  it('runs a named sample in the journey script, which refuses Marcus on the fixture and an unknown name', async () => {
    const app = appWith({});
    const request = (method, path, body) => app.request(path, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
    await expect(runJourney(request, () => {}, { sampleId: 'marcus' })).rejects.toThrow('Marcus’s sample needs the live model');
    await expect(runJourney(request, () => {}, { sampleId: 'nobody' })).rejects.toThrow('a sample called "nobody"');
  });

  it('says plainly why Marcus’s sample cannot run on the hand-written fixture', async () => {
    const api = clientFor(appWith({}));
    await api.get('/api/state');
    await expect(api.act('startSample', { sampleId: 'marcus' })).rejects.toThrow('Marcus’s sample needs the live model; this copy runs on hand-written examples for Ellie and Ana only.');
  });
});
