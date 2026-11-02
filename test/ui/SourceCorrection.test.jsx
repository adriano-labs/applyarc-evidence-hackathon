// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { App } from '../../client/src/App.jsx';
import { createApp } from '../../server/app.js';
import { actions, agentActions } from '../../server/flows.js';
import { writeJsonAtomic } from '../../server/store/jsonFile.js';
import { draftedWorkspace } from '../helpers.js';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); sessionStorage.clear(); });
const words = 'Sam wrote the Helm patch. I reproduced the failure, tested his fix and wrote the incident notes.';

async function setup(failure) {
  const ws = await draftedWorkspace();
  ws.applicant.sources[0].read = true;
  actions.edit(ws, { docId: 'answer', segmentId: 'answer-1', text: 'My handwritten opening stays.' });
  for (const docId of ['answer', 'letter']) actions.approve(ws, { docId, docRevision: ws.application.documents[docId].revision });
  const source = actions.notes(ws, { text: words });
  await agentActions.read(ws, { sourceId: source.id }, { extract: async () => ({ facts: [], conflicts: [{ quote: words,
    priorSourceId: 's1', priorQuote: ws.applicant.facts[2].quote, question: 'Who wrote the patch?' }] }) }, () => {});
  const dataDir = mkdtempSync(join(tmpdir(), 'source-correction-ui-'));
  writeJsonAtomic(join(dataDir, 'users', 'local', 'workspace.json'), ws);
  const extract = vi.fn(async () => { throw new Error('Do not extract this correction again.'); });
  const repair = vi.fn(async () => ({ rewrites: [] }));
  const server = createApp({ dataDir, form: ws.application.form,
    agent: { provider: { id: 'fixture', label: 'Authored internal test' }, extract, repair } });
  let saves = 0;
  vi.stubGlobal('fetch', async (url, init) => {
    if (String(url) === '/api/actions/resolveSourceConflict') {
      saves += 1;
      if (saves === 1 && failure === 'refused') return new Response(JSON.stringify({ error: { code: 'failed', message: 'Save failed.' } }), { status: 503 });
      if (saves === 1 && failure === 'lost-after-commit') { await server.request(String(url), init); throw new TypeError('Response lost.'); }
    }
    return server.request(String(url), init);
  });
  Element.prototype.scrollIntoView = () => {};
  render(<App />);
  return { ws, source, server, extract, repair, saves: () => saves };
}

it('uses a complete note once, preserves documents, and runs repair without extracting another answer', async () => {
  const { ws, server, extract, repair, saves } = await setup();
  const editor = await screen.findByLabelText('Your correction');
  expect(editor.value).toBe(words);
  const edited = words.replace('tested his fix', 'tested his fix on our lab nodes');
  fireEvent.change(editor, { target: { value: edited } });
  fireEvent.click(screen.getByRole('button', { name: 'Use this correction' }));
  await screen.findByRole('heading', { name: 'What changed' });
  const saved = (await (await server.request('/api/state')).json()).workspace;
  expect(saved.applicant.facts[2].statement).toBe(edited);
  expect(saved.application.documents).toEqual(ws.application.documents);
  expect(saved.application.approvals).toEqual({ answer: null, letter: null });
  expect(saved.applicant.sources.filter((s) => s.kind === 'correction')).toHaveLength(1);
  expect(saved.applicant.sources.find((s) => s.kind === 'answer')).toBeUndefined();
  expect(extract).not.toHaveBeenCalled();
  expect(repair).toHaveBeenCalledOnce();
  expect(saves()).toBe(1);
});

it('keeps exact edited words after a failed save, with no mutation until explicit retry', async () => {
  const { ws, server, saves } = await setup('refused');
  const editor = await screen.findByLabelText('Your correction');
  const edited = words.replace('. I', '.\nI');
  fireEvent.change(editor, { target: { value: edited } });
  fireEvent.click(screen.getByRole('button', { name: 'Use this correction' }));
  await screen.findByText(/^Save failed\./);
  expect(screen.getByLabelText('Your correction').value).toBe(edited);
  expect((await (await server.request('/api/state')).json()).workspace).toEqual(ws);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Use this correction' }).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: 'Use this correction' }));
  await screen.findByRole('heading', { name: 'What changed' });
  expect(saves()).toBe(2);
});

it('does not repeat a committed correction when its response is lost', async () => {
  const { server, repair, saves } = await setup('lost-after-commit');
  await screen.findByLabelText('Your correction');
  fireEvent.click(screen.getByRole('button', { name: 'Use this correction' }));
  await screen.findByRole('heading', { name: 'What changed' });
  const saved = (await (await server.request('/api/state')).json()).workspace;
  expect(saved.applicant.sources.filter((s) => s.kind === 'correction')).toHaveLength(1);
  expect(repair).not.toHaveBeenCalled();
  expect(saves()).toBe(1);
});

it('keeps the existing explanation path and full overlong wording without saving', async () => {
  const { ws, server } = await setup();
  const editor = await screen.findByLabelText('Your correction');
  const long = words.repeat(4);
  fireEvent.change(editor, { target: { value: long } });
  expect(editor.value).toBe(long);
  expect(screen.getByRole('button', { name: 'Use this correction' }).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Explain instead' }));
  expect(screen.getByLabelText('Your answer')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Back to correction' }));
  expect(screen.getByLabelText('Your correction').value).toBe(long);
  expect((await (await server.request('/api/state')).json()).workspace).toEqual(ws);
});
