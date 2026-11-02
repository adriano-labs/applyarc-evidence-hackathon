import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../server/app.js';
import { writeJsonAtomic } from '../server/store/jsonFile.js';
import { approve } from '../server/domain/review.js';
import { apiClient } from '../scripts/journey.mjs';
import { draftedWorkspace } from './helpers.js';

async function setup(refuse = false) {
  const ws = await draftedWorkspace();
  for (const docId of ['answer', 'letter']) approve(ws, docId, ws.application.documents[docId].revision);
  const dataDir = mkdtempSync(join(tmpdir(), 'strengthen-http-'));
  writeJsonAtomic(join(dataDir, 'users/local/workspace.json'), ws);
  // No real model calls: the full HTTP/store route uses a declared test double.
  const agent = { provider: { id: 'test-double', label: 'Test only' },
    strengthen: async () => refuse ? { outcome: 'refusal', text: '', factIds: [], reason: 'Your evidence does not establish personal leadership.' }
      : { outcome: 'revision', text: 'We used Kubernetes Jobs instead of Slurm.', factIds: ['f1'], reason: 'More direct wording.' },
    review: async ({ claims }) => ({ decisions: claims.map((c) => ({ id: c.id, verdict: 'supported', reason: 'Test double.' })) }),
  };
  const app = createApp({ dataDir, form: ws.application.form, agent });
  const request = (method, path, body) => app.request(path, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
  return apiClient(request);
}
const target = { docId: 'answer', segmentId: 'answer-1' };

describe('strengthening through HTTP and the atomic store', () => {
  it('persists the proposal through reload; changes exactly one sentence only when accepted', async () => {
    const api = await setup();
    const before = (await api.get('/api/state')).workspace;
    let state = await api.run('strengthen', target);
    const id = state.result.suggestion.id;
    state = await api.get('/api/state');
    expect(state.workspace.application.suggestion.id).toBe(id);
    expect(state.workspace.application.documents).toEqual(before.application.documents);
    expect(state.workspace.application.approvals).toEqual(before.application.approvals);
    state = await api.act('acceptSuggestion', { suggestionId: id });
    expect(state.workspace.application.documents.answer.segments[0].text).toBe('We used Kubernetes Jobs instead of Slurm.');
    expect(state.workspace.application.documents.answer.segments.slice(1)).toEqual(before.application.documents.answer.segments.slice(1));
    expect(state.workspace.application.approvals.answer).toBeNull();
    expect(state.workspace.application.documents.letter).toEqual(before.application.documents.letter);
    expect(state.workspace.application.approvals.letter).toEqual(before.application.approvals.letter);
  });

  it('will not overwrite a newer manual edit even when the caller has the latest workspace revision', async () => {
    const api = await setup();
    let state = await api.run('strengthen', target);
    const id = state.result.suggestion.id;
    state = await api.act('edit', { ...target, text: 'My newer manual edit.' });
    const beforeAccept = structuredClone(state.workspace);
    await expect(api.act('acceptSuggestion', { suggestionId: id })).rejects.toThrow(/stale/);
    expect((await api.get('/api/state')).workspace).toEqual(beforeAccept);
    state = await api.act('dismissSuggestion', { suggestionId: id });
    expect(state.workspace.application.suggestion).toBeNull();
    expect(state.workspace.application.documents.answer.segments[0].text).toBe('My newer manual edit.');
  });

  it('returns a useful refusal and dismissal preserves already approved text', async () => {
    const api = await setup(true);
    const before = (await api.get('/api/state')).workspace.application;
    let state = await api.run('strengthen', { ...target, request: 'make it sound like I led it' });
    expect(state.result.suggestion).toMatchObject({ status: 'refused', after: null, reason: 'Your evidence does not establish personal leadership.' });
    state = await api.act('dismissSuggestion', { suggestionId: state.result.suggestion.id });
    expect(state.workspace.application.documents).toEqual(before.documents);
    expect(state.workspace.application.approvals).toEqual(before.approvals);
  });
});
