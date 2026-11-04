// Words from a voice clip say so: Ana's sample started from what Voice Transcribe heard, or a note
// she says, is marked spoken, and her pack's references carry that and who did each thing. English
// sources and references are exactly as before.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { apiClient } from '../scripts/journey.mjs';
import { buildApp } from '../server/build.js';
import { referencesFor } from '../server/domain/citations.js';
import { actions } from '../server/flows.js';
import { workspaceWithNotes } from './helpers.js';

const appWith = (env = {}) => buildApp({ dataDir: mkdtempSync(join(tmpdir(), 'spoken-')), env });
const clientFor = (app) => apiClient((method, path, body) => app.request(path, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) }));
const HEARD = 'Szemmien. Trabalha há três anos num lar em Leeds; comecei em outubro de 2023.';

describe('words from a voice clip', () => {
  it('marks Ana’s live start spoken, and her written start (or the fixture’s) not', async () => {
    const live = clientFor(appWith({ PROVIDER: 'meta', META_API_KEY: 'k' }));
    await live.get('/api/state');
    const heard = await live.act('startSample', { sampleId: 'ana', text: HEARD });
    expect(heard.workspace.applicant.sources[0]).toMatchObject({ kind: 'notes', text: HEARD, language: 'pt-PT', spoken: true });
    expect(heard.workspace.applicant.name).toBe('Ana');
    await live.reset();
    const written = await live.act('startSample', { sampleId: 'ana' });
    expect(written.workspace.applicant.sources[0]).not.toHaveProperty('spoken');
    const fixture = clientFor(appWith());
    await fixture.get('/api/state');
    const fixed = await fixture.act('startSample', { sampleId: 'ana', text: HEARD });
    expect(fixed.workspace.applicant.sources[0]).not.toHaveProperty('spoken');
  });

  it('marks a later note spoken only when the client says it came from a clip', () => {
    const { ws } = workspaceWithNotes('Notes.');
    expect(actions.notes(ws, { text: 'Typed later.' })).not.toHaveProperty('spoken');
    expect(actions.notes(ws, { text: 'Said later.', spoken: true })).toMatchObject({ spoken: true });
    expect(actions.notes(ws, { text: 'Not a flag.', spoken: 'yes' })).not.toHaveProperty('spoken');
  });

  it('gives a reference in another language its actor and whether it was spoken; an English one is unchanged', () => {
    const { ws, source } = workspaceWithNotes('I wrote the Helm patch.');
    ws.applicant.facts.push({ id: 'f1', statement: 'I wrote the Helm patch.', quote: 'I wrote the Helm patch.', sourceId: source.id, status: 'confirmed', history: [] });
    const spoken = actions.notes(ws, { text: 'Eu fiz cartões com fotografias da comida.', language: 'pt-PT', spoken: true });
    ws.applicant.facts.push({ id: 'f2', statement: 'I made cards with photos of the food.', quote: 'Eu fiz cartões com fotografias da comida.', sourceId: spoken.id, status: 'confirmed', history: [], language: 'pt-PT', actor: 'self' });
    const doc = { segments: [{ id: 'a1', kind: 'claim', text: 'x', factIds: ['f1', 'f2'] }] };
    expect(referencesFor(ws, doc, { f1: 1, f2: 2 })).toEqual([
      { n: 1, factId: 'f1', statement: 'I wrote the Helm patch.', quote: 'I wrote the Helm patch.', from: 'notes' },
      { n: 2, factId: 'f2', statement: 'I made cards with photos of the food.', quote: 'Eu fiz cartões com fotografias da comida.', from: 'notes', language: 'pt-PT', actor: 'self', spoken: true },
    ]);
  });
});

describe('the drafting stages say what is being checked', () => {
  it('names the form’s own document and her language on the fixture journey', async () => {
    const api = clientFor(appWith());
    await api.reset();
    let state = await api.act('startSample', { sampleId: 'ana' });
    state = await api.run('read', { sourceId: state.result.id });
    for (const id of state.result.accepted) state = await api.act('decideFact', { factId: id, decision: 'confirm' });
    state = await api.run('check');
    const question = state.workspace.application.questions.find((q) => q.status === 'open');
    const ana = (await api.get('/api/sample')).samples.find((s) => s.id === 'ana');
    state = await api.act('answer', { questionId: question.id, text: ana.answer });
    state = await api.run('read', { sourceId: state.result.source.id });
    for (const id of state.result.accepted) state = await api.act('decideFact', { factId: id, decision: 'confirm' });
    await api.run('check');
    const drafted = await api.run('draft');
    const labels = drafted.events.filter((e) => e.type === 'stage').map((e) => e.label);
    expect(labels).toContain('Drafting the supporting evidence');
    expect(labels).toContain('Drafting the cover letter');
    expect(labels).not.toContain('Drafting the project answer');
  });
});
