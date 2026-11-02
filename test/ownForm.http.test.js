import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../server/app.js';
import { form } from './helpers.js';
import { apiClient } from '../scripts/journey.mjs';

const own = () => ({ applicant: 'Priya', company: 'Harbour Labs', role: 'Platform Engineer',
  notes: 'I wrote the deployment tests.', question: 'What did you do yourself?',
  requirements: [{ text: 'Your individual contribution', personal: true }], synthetic: true, requirementsConfirmed: true });
// This is an in-process test double, never a model or model-quality proof.
const testAgent = {
  provider: { id: 'test-double', label: 'Test only' },
  extract: async () => ({ facts: [{ statement: own().notes, quote: own().notes, requirementIds: ['own-answer-1', 'own-evidence'] }] }),
  clarify: async () => ({ coverage: [], questions: [] }),
  draft: async ({ docId, applicant, form: active }) => ({ segments: [
    ...(docId === 'letter' ? [{ kind: 'frame', text: `Dear ${active.company} hiring team,`, factIds: [], startsParagraph: true }] : []),
    { kind: 'claim', text: own().notes, factIds: ['f1'], startsParagraph: true },
    ...(docId === 'letter' ? [{ kind: 'frame', text: `Yours sincerely, ${applicant}`, factIds: [], startsParagraph: true }] : []),
  ] }),
  review: async ({ claims }) => ({ decisions: claims.map((c) => ({ id: c.id, verdict: 'supported', reason: 'Test double.' })) }),
};
function setup(agent = testAgent) {
  const app = createApp({ dataDir: mkdtempSync(join(tmpdir(), 'own-form-')), form, agent });
  const request = (method, path, body) => app.request(path, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
  return apiClient(request);
}

describe('own-input HTTP integration', () => {
  it('persists the custom brief, confirms facts, drafts both documents and preserves the second application', async () => {
    const api = setup();
    let state = await api.act('startOwnApplication', own());
    const customId = state.workspace.application.form.id;
    expect((await api.get('/api/state')).workspace.applicant.name).toBe('Priya');
    state = await api.run('read', { sourceId: state.result.id });
    state = await api.act('confirmFacts', { factIds: state.result.accepted });
    state = await api.run('check');
    for (const question of state.workspace.application.questions.filter((q) => q.status === 'open')) state = await api.act('skip', { questionId: question.id });
    state = await api.run('draft');
    expect(state.workspace.application.documents.letter.segments.at(-1).text).toBe('Yours sincerely, Priya');
    for (const docId of ['answer', 'letter']) state = await api.act('approve', { docId, docRevision: state.workspace.application.documents[docId].revision });
    state = await api.act('export');
    expect(state.result.application).toMatchObject({ company: 'Harbour Labs', portalStatus: 'unknown' });
    const facts = structuredClone(state.workspace.applicant.facts);
    state = await api.act('nextApplication', { formId: form.id });
    expect(state.workspace.applicant.facts).toEqual(facts);
    expect(state.workspace.archive[0].form.id).toBe(customId);
    expect(state.workspace.application.form.id).toBe(form.id);
  });

  it('refuses fixture input and replacing existing work without a partial mutation', async () => {
    const fixture = setup({ ...testAgent, provider: { id: 'fixture', label: 'Fixture' } });
    await expect(fixture.act('startOwnApplication', own())).rejects.toThrow(/live model/);
    expect((await fixture.get('/api/state')).workspace.applicant.sources).toHaveLength(0);
    const live = setup();
    await live.act('startOwnApplication', own());
    const before = (await live.get('/api/state')).workspace;
    await expect(live.act('startOwnApplication', { ...own(), applicant: 'Changed' })).rejects.toThrow(/Start again/);
    expect((await live.get('/api/state')).workspace).toEqual(before);
  });
});
