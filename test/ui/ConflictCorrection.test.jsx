// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { App } from '../../client/src/App.jsx';
import { References } from '../../client/src/components/References.jsx';
import { useAppState } from '../../client/src/useAppState.js';
import { createApp } from '../../server/app.js';
import { addSource } from '../../server/domain/workspace.js';
import { writeJsonAtomic } from '../../server/store/jsonFile.js';
import { viewOf } from '../../server/view.js';
import { draftedWorkspace } from '../helpers.js';

const answer = 'Sam wrote the Helm patch.\nI reproduced the failure, tested his fix and wrote the incident notes.';
const sample = { name: 'Ellie', correction: { anchor: 'Helm change', text: 'Canned sample correction.' } };
const fact = { id: 'f3', status: 'confirmed', statement: 'I wrote the Helm change.', quote: 'I wrote the Helm change.', sourceId: 's1' };
const referenceProps = { facts: [fact], citations: { f3: 3 }, sources: { s1: 'notes' }, activeFactId: null, locked: false, onHover: () => {}, sample, openCorrectionFactId: 'f3' };

afterEach(() => { cleanup(); vi.unstubAllGlobals(); sessionStorage.clear(); });

async function contextWorkspace() {
  const ws = await draftedWorkspace();
  ws.applicant.sources[0].read = true;
  for (const [id, factId, text] of [['q1', 'f1', 'My team chose Kubernetes; I compared the resource quotas.'], ['q2', 'f3', answer]]) {
    const source = addSource(ws, { kind: 'answer', text, questionId: id });
    source.read = true;
    ws.application.questions.push({ id, kind: 'source-conflict', status: 'answered', text: 'Who did this work?', sourceId: source.id,
      priorSourceId: 's1', priorQuote: ws.applicant.facts.find((f) => f.id === factId).quote });
  }
  addSource(ws, { kind: 'answer', text: 'An unrelated later answer.' }).read = true;
  return ws;
}

function localServer(ws) {
  const dataDir = mkdtempSync(join(tmpdir(), 'conflict-prefill-ui-'));
  writeJsonAtomic(join(dataDir, 'users', 'local', 'workspace.json'), ws);
  const server = createApp({ dataDir, form: ws.application.form, sample,
    agent: { provider: { id: 'fixture', label: 'Authored internal test' }, repair: vi.fn(async () => ({ rewrites: [] })) } });
  vi.stubGlobal('fetch', (url, init) => server.request(String(url), init));
  Element.prototype.scrollIntoView = () => {};
  return server;
}

it('opens each decision with its own exact answer, preserves the workspace, and saves only the edited wording', async () => {
  const ws = await contextWorkspace();
  const server = localServer(ws);
  const before = structuredClone(ws);
  render(<App />);
  const region = await screen.findByRole('region', { name: 'Earlier facts waiting for you' });
  fireEvent.click(within(region).getAllByRole('button', { name: 'Correct this fact' })[0]);
  expect(screen.getByLabelText('The fact, in your words').value).toBe(ws.applicant.sources[1].text);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
  fireEvent.click(within(region).getAllByRole('button', { name: 'Correct this fact' })[1]);
  const editor = screen.getByLabelText('The fact, in your words');
  expect(editor.value).toBe(answer);
  expect(document.activeElement).toBe(editor);
  expect(screen.getByText('From your answer — review before saving.')).toBeTruthy();
  expect(screen.getByText(`Earlier fact: ${ws.applicant.facts[2].statement}`)).toBeTruthy();
  expect((await (await server.request('/api/state')).json()).workspace).toEqual(before);
  const edited = answer.replace('tested his fix', 'tested the fix on our lab nodes');
  fireEvent.change(editor, { target: { value: edited } });
  fireEvent.click(screen.getByRole('button', { name: 'Save the correction' }));
  await waitFor(async () => {
    const saved = (await (await server.request('/api/state')).json()).workspace;
    expect(saved.applicant.facts[2].statement).toBe(edited);
    expect(saved.applicant.sources.at(-1)).toMatchObject({ kind: 'correction', text: edited });
    expect(saved.application.documents).toEqual(before.application.documents);
  });
});

it.each(['missing-source', 'different-source', 'not-waiting', 'withheld'])('does not guess an answer for a %s context', async (change) => {
  const workspace = await contextWorkspace();
  localServer(workspace);
  const data = { workspace, view: viewOf(workspace) };
  const { result, rerender } = renderHook(({ data }) => useAppState({ data, setNotice: () => {} }), { initialProps: { data } });
  act(() => result.current.openConflictCorrection('f3', 'q2'));
  expect(result.current.conflictCorrectionContext.answerText).toBe(answer);
  const stale = structuredClone(data);
  if (change === 'missing-source') stale.workspace.applicant.sources = stale.workspace.applicant.sources.filter((s) => s.id !== 's3');
  if (change === 'different-source') stale.workspace.application.questions[1].sourceId = 's4';
  if (change === 'not-waiting') stale.view.conflictDecisions = [];
  if (change === 'withheld') stale.workspace.applicant.sources.find((s) => s.id === 's3').withheld = true;
  rerender({ data: stale });
  expect(result.current.conflictCorrectionContext).toEqual({ factId: 'f3', answerText: null });
  render(<References {...referenceProps} conflictCorrectionContext={result.current.conflictCorrectionContext} onCorrect={vi.fn()} />);
  expect(screen.getByLabelText('The fact, in your words').value).toBe(fact.statement);
  expect(screen.queryByText('From your answer — review before saving.')).toBeNull();
});

it('keeps a whole long answer, asks for shortening, and preserves edits through rerender', async () => {
  Element.prototype.scrollIntoView = () => {};
  const longAnswer = `${answer}\n${'I checked the incident notes again. '.repeat(9)}`;
  const onCorrect = vi.fn().mockResolvedValue({ workspace: {} });
  const { rerender } = render(<References {...referenceProps} onCorrect={onCorrect} conflictCorrectionContext={{ factId: 'f3', answerText: longAnswer }} />);
  const editor = screen.getByLabelText('The fact, in your words');
  expect(editor.value).toBe(longAnswer);
  expect(screen.getByRole('button', { name: 'Save the correction' }).disabled).toBe(true);
  expect(screen.getByRole('alert').textContent).toMatch(/280 characters or fewer/);
  expect(onCorrect).not.toHaveBeenCalled();
  fireEvent.change(editor, { target: { value: answer } });
  rerender(<References {...referenceProps} onCorrect={onCorrect} conflictCorrectionContext={{ factId: 'f3', answerText: 'A changed prop must not overwrite the edit.' }} />);
  expect(editor.value).toBe(answer);
  expect(screen.getByRole('button', { name: 'Save the correction' }).disabled).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Save the correction' }));
  expect(onCorrect).toHaveBeenCalledExactlyOnceWith('f3', answer);
  await waitFor(() => expect(screen.queryByLabelText('The fact, in your words')).toBeNull());
});

it('uses the sample only on its ordinary programmatic path; manual correction still begins with the fact', () => {
  Element.prototype.scrollIntoView = () => {};
  const onCorrect = vi.fn();
  const { unmount } = render(<References {...referenceProps} conflictCorrectionContext={null} onCorrect={onCorrect} />);
  expect(screen.getByLabelText('The fact, in your words').value).toBe(sample.correction.text);
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Save the correction' }));
  unmount();
  render(<References {...referenceProps} openCorrectionFactId={null} conflictCorrectionContext={null} onCorrect={onCorrect} />);
  fireEvent.click(screen.getByRole('button', { name: 'Correct this fact' }));
  expect(screen.getByLabelText('The fact, in your words').value).toBe(fact.statement);
  expect(onCorrect).not.toHaveBeenCalled();
});
