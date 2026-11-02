// @vitest-environment jsdom
// Real UI/store/actions, with a fake extractor: no provider calls.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { App } from '../../client/src/App.jsx';
import { createApp } from '../../server/app.js';
import { writeJsonAtomic } from '../../server/store/jsonFile.js';
import { actions } from '../../server/flows.js';
import { draftedWorkspace } from '../helpers.js';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('adds a note after drafting, keeps manual writing and retries reading without appending twice', async () => {
  const workspace = await draftedWorkspace();
  workspace.applicant.sources[0].read = true;
  actions.edit(workspace, { docId: 'answer', segmentId: 'answer-1', text: 'My own opening stays.' });
  for (const docId of ['answer', 'letter'])
    actions.approve(workspace, { docId, docRevision: workspace.application.documents[docId].revision });
  const before = structuredClone(workspace);
  const note = 'I used Slurm instead of Kubernetes.';
  const dataDir = mkdtempSync(join(tmpdir(), 'notes-ui-'));
  writeJsonAtomic(join(dataDir, 'users', 'local', 'workspace.json'), workspace);
  const extract = vi.fn()
    .mockRejectedValueOnce(Object.assign(new Error('Reading failed. Try again.'), { code: 'failed' }))
    .mockResolvedValueOnce({ facts: [], conflicts: [{ quote: note, priorSourceId: 's1',
      priorQuote: 'we used Kubernetes Jobs with a scheduler extender instead of Slurm',
      question: 'Which scheduler did you actually use?' }] });
  const server = createApp({ dataDir, form: workspace.application.form,
    agent: { provider: { id: 'test', label: 'Internal test, no model' }, extract } });
  const paths = [];
  vi.stubGlobal('fetch', (url, init) => { paths.push(String(url)); return server.request(String(url), init); });
  render(<App />);
  fireEvent.click(await screen.findByRole('tab', { name: /^Your notes/ }));
  fireEvent.click(screen.getByText('Add a note'));
  fireEvent.change(screen.getByLabelText('New note'), { target: { value: note } });
  fireEvent.click(screen.getByRole('button', { name: 'Add note' }));

  await screen.findByText(/Reading failed/);
  await waitFor(() => expect(screen.getByLabelText('New note').value).toBe(''));
  const saved = (await (await server.request('/api/state')).json()).workspace;
  expect(saved.applicant.sources.map((source) => source.text)).toEqual([...before.applicant.sources.map((source) => source.text), note]);
  expect(saved.applicant.facts).toEqual(before.applicant.facts);
  expect(saved.application.documents).toEqual(before.application.documents);
  expect(saved.application.approvals).toEqual({ answer: null, letter: null });
  expect(() => actions.approve(saved, { docId: 'answer', docRevision: saved.application.documents.answer.revision })).toThrow(/Read your new evidence/);
  expect(() => actions.export(saved)).toThrow(/Read your new evidence/);

  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByText('Which scheduler did you actually use?');
  const retried = (await (await server.request('/api/state')).json()).workspace;
  expect(retried.applicant.sources).toHaveLength(before.applicant.sources.length + 1);
  expect(retried.application.documents).toEqual(before.application.documents);
  expect(retried.application.approvals).toEqual({ answer: null, letter: null });
  expect(() => actions.approve(retried, { docId: 'answer', docRevision: retried.application.documents.answer.revision })).toThrow(/conflicting details/);
  expect(() => actions.export(retried)).toThrow(/conflicting details/);
  expect(retried.applicant.facts).toEqual(before.applicant.facts);
  expect(paths.filter((path) => path === '/api/actions/notes')).toHaveLength(1);
  expect(paths).not.toContain('/api/reset');
  expect(extract).toHaveBeenCalledTimes(2);
}, 10000);
