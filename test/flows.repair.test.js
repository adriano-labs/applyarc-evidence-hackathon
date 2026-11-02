// Fixture mode must never put words in the applicant's mouth: its hand-written
// rewrite is for the sample correction only; any other correction gets none,
// so every reopened sentence honestly asks for review.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { apiClient } from '../scripts/journey.mjs';
import { buildApp } from '../server/build.js';

async function drafted() {
  const app = buildApp({ dataDir: mkdtempSync(join(tmpdir(), 'repair-')), env: {} });
  const api = apiClient((method, path, body) => app.request(path, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) }));
  await api.reset();
  const sample = await api.get('/api/sample');
  let state = await api.act('notes', { text: sample.notes });
  state = await api.run('read', { sourceId: state.result.id });
  for (const id of state.result.accepted) state = await api.act('decideFact', { factId: id, decision: 'confirm' });
  state = await api.run('check');
  const question = state.workspace.application.questions.find((q) => q.requirementId === 'contribution');
  state = await api.act('answer', { questionId: question.id, text: sample.answer });
  state = await api.run('read', { sourceId: state.result.source.id });
  for (const id of state.result.accepted) state = await api.act('decideFact', { factId: id, decision: 'confirm' });
  state = await api.run('check');
  state = await api.run('draft');
  const fact = state.workspace.applicant.facts.find((f) => f.quote === sample.correction.quote);
  return { api, sample, fact };
}

describe('fixture repair', () => {
  it('proposes its hand-written rewrite for the sample correction', async () => {
    const { api, sample, fact } = await drafted();
    await api.act('changeFact', { factId: fact.id, text: sample.correction.text });
    const state = await api.run('repair');
    expect(state.workspace.application.repair.items.map((i) => i.status)).toEqual(['proposed', 'proposed']);
  });

  it('proposes nothing for any other correction, so each sentence asks for review', async () => {
    const { api, fact } = await drafted();
    await api.act('changeFact', { factId: fact.id, text: 'I diagnosed the failure; my teammate implemented the fix.' });
    const state = await api.run('repair');
    const items = state.workspace.application.repair.items;
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.status === 'needs-review' && i.after === null)).toBe(true);
  });
});
