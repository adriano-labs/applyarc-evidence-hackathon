// @vitest-environment jsdom
import { cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { App } from '../../client/src/App.jsx';
import { useActions } from '../../client/src/useActions.js';
import { createApp } from '../../server/app.js';
import { addSource } from '../../server/domain/workspace.js';
import { writeJsonAtomic } from '../../server/store/jsonFile.js';
import { draftedWorkspace } from '../helpers.js';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); sessionStorage.clear(); });

it.each(['refused', 'unknown'])('keeps a typed correction after a %s save and lets the person retry', async (failure) => {
  const ws = await draftedWorkspace();
  ws.applicant.sources[0].read = true;
  const answer = addSource(ws, { kind: 'answer', text: 'Sam wrote the patch; I tested his fix.', questionId: 'q1' });
  answer.read = true;
  ws.application.questions.push({ id: 'q1', kind: 'source-conflict', status: 'answered', text: 'Who wrote it?',
    priorSourceId: 's1', priorQuote: ws.applicant.facts[2].quote, sourceId: answer.id });
  const dataDir = mkdtempSync(join(tmpdir(), 'correction-save-ui-'));
  writeJsonAtomic(join(dataDir, 'users', 'local', 'workspace.json'), ws);
  const server = createApp({ dataDir, form: ws.application.form,
    agent: { provider: { id: 'fixture', label: 'Authored internal test' }, repair: vi.fn(async () => ({ rewrites: [] })) } });
  let attempts = 0;
  let reads = 0;
  vi.stubGlobal('fetch', async (url, init) => {
    if (String(url) === '/api/state') reads += 1;
    if (String(url) === '/api/actions/changeFact' && ++attempts === 1) {
      if (failure === 'unknown') throw new TypeError('Connection lost before a response.');
      return new Response(JSON.stringify({ error: { code: 'failed', message: 'Correction save failed.' } }), { status: 503 });
    }
    return server.request(String(url), init);
  });
  Element.prototype.scrollIntoView = () => {};
  render(<App />);
  const decisions = await screen.findByRole('region', { name: 'Earlier facts waiting for you' });
  fireEvent.click(within(decisions).getByRole('button', { name: 'Correct this fact' }));
  const edited = 'Sam wrote the patch.\nI reproduced the failure, tested his fix and wrote the incident notes.';
  fireEvent.change(screen.getByLabelText('The fact, in your words'), { target: { value: edited } });
  fireEvent.click(screen.getByRole('button', { name: 'Save the correction' }));
  if (failure === 'unknown') await waitFor(() => expect(reads).toBeGreaterThan(1));
  else await screen.findByText(/Correction save failed/);
  expect(screen.queryByLabelText('The fact, in your words')?.value).toBe(edited);
  expect((await (await server.request('/api/state')).json()).workspace).toEqual(ws);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save the correction' }).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: 'Save the correction' }));
  await waitFor(async () => {
    const saved = (await (await server.request('/api/state')).json()).workspace;
    expect(saved.applicant.facts[2].statement).toBe(edited);
    expect(saved.applicant.sources.at(-1)).toMatchObject({ kind: 'correction', text: edited });
  });
  expect(attempts).toBe(2);
});

it('keeps the confirmed-save result when the later repair fails', async () => {
  const saved = { workspace: {}, view: { next: 'repair-proposal' } };
  const act = vi.fn().mockResolvedValue(saved);
  const run = vi.fn().mockResolvedValue(null);
  const { result } = renderHook(() => useActions({ act, run }));
  expect(await result.current.correct('f3', 'I tested Sam’s fix.')).toBe(saved);
  expect(act).toHaveBeenCalledExactlyOnceWith('changeFact', { factId: 'f3', text: 'I tested Sam’s fix.' });
  expect(run).toHaveBeenCalledExactlyOnceWith('repair', {}, 'Rewriting the sentences that cite the change');
});


it.each(['lost response', 'repair failure'])('does not repeat a committed correction after a %s', async (failure) => {
  const ws = await draftedWorkspace();
  const dataDir = mkdtempSync(join(tmpdir(), 'correction-committed-ui-'));
  writeJsonAtomic(join(dataDir, 'users', 'local', 'workspace.json'), ws);
  const repair = vi.fn(async () => { throw new Error('Injected repair failure.'); });
  const server = createApp({ dataDir, form: ws.application.form,
    agent: { provider: { id: 'fixture', label: 'Authored internal test' }, repair } });
  let attempts = 0;
  vi.stubGlobal('fetch', async (url, init) => {
    const response = await server.request(String(url), init);
    if (String(url) === '/api/actions/changeFact') {
      attempts += 1;
      if (failure === 'lost response') throw new TypeError('Committed, then response lost.');
    }
    return response;
  });
  Element.prototype.scrollIntoView = () => {};
  render(<App />);
  const corrections = await screen.findAllByRole('button', { name: 'Correct this fact' });
  fireEvent.click(corrections[2]);
  const edited = 'Sam wrote the patch. I tested his fix.';
  fireEvent.change(screen.getByLabelText('The fact, in your words'), { target: { value: edited } });
  fireEvent.click(screen.getByRole('button', { name: 'Save the correction' }));
  await screen.findByRole('heading', { name: 'What changed' });
  await waitFor(() => expect(screen.queryByLabelText('The fact, in your words')).toBeNull());
  const saved = (await (await server.request('/api/state')).json()).workspace;
  expect(saved.applicant.facts[2].statement).toBe(edited);
  expect(saved.applicant.sources.filter((source) => source.kind === 'correction')).toHaveLength(1);
  expect(attempts).toBe(1);
  expect(repair).toHaveBeenCalledTimes(failure === 'lost response' ? 0 : 1);
});
