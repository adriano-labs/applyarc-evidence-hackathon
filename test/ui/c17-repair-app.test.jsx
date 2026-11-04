// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../../client/src/api.js', () => ({ getState: vi.fn(), getSample: vi.fn(), getReceipts: vi.fn(), getForms: vi.fn(), act: vi.fn(), run: vi.fn(), reset: vi.fn() }));
import * as api from '../../client/src/api.js';
import { App } from '../../client/src/App.jsx';

const notes = 'I tested the deployment; Sam wrote it.';
const makeState = () => ({
  mode: { id: 'fixture', label: 'Fixture' }, working: false,
  workspace: {
    revision: 1,
    applicant: { sources: [{ id: 's1', kind: 'notes', text: notes, read: true }], facts: [{ id: 'f1', statement: notes, quote: notes, sourceId: 's1', status: 'confirmed', history: [{ statement: 'I wrote the deployment.' }] }] },
    application: {
      form: { id: 'sample', company: 'Sample', role: 'Engineer', documents: [{ id: 'answer', title: 'Project answer', wordLimit: 300 }, { id: 'letter', title: 'Cover letter', wordLimit: 300 }], portalTasks: [] },
      documents: Object.fromEntries(['answer', 'letter'].map(id => [id, { id, revision: 1, segments: [{ id: `${id}-1`, kind: 'claim', author: 'draft', text: 'I wrote the deployment.', factIds: ['f1'] }] }])),
      repair: { factId: 'f1', status: 'review', items: [{ id: 'c1', docId: 'answer', segmentId: 'answer-1', before: 'I wrote the deployment.', after: 'I tested the deployment.', status: 'proposed', decision: null }] },
      approvals: {}, questions: [], exports: [],
    },
  },
  view: { next: 'repair', citations: { f1: 1 }, approvals: { answer: 'none', letter: 'none' }, stats: { answer: { words: 4, wordLimit: 300 }, letter: { words: 4, wordLimit: 300 } }, coverage: [] },
});

beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  Element.prototype.scrollIntoView = () => {};
  api.getState.mockResolvedValue(makeState());
  api.getSample.mockResolvedValue({ name: 'Ellie', notes, formId: 'sample' });
  api.getReceipts.mockResolvedValue({ receipts: [] });
  api.getForms.mockResolvedValue({ forms: [] });
});
afterEach(() => { cleanup(); sessionStorage.clear(); });

it.each(['guided', 'workspace'])('App passes a live pending save into the %s repair queue and unlocks after it settles', async (surface) => {
  if (surface === 'guided') sessionStorage.setItem('ae-guided', '1');
  let resolveSave;
  api.act.mockImplementation(() => new Promise(resolve => { resolveSave = resolve; }));
  render(<App />);
  if (surface === 'guided') await screen.findByText('Key moment: correct a fact');
  const panel = await screen.findByRole('region', { name: 'What changed' });
  fireEvent.click(screen.getByRole('radio', { name: 'Keep as is' }));
  await waitFor(() => expect(api.act).toHaveBeenCalledWith('decideChange', { revision: 1, itemId: 'c1', decision: 'keep' }));
  expect(screen.getByRole('button', { name: 'Undo this correction' }).disabled).toBe(true);
  expect(screen.getByRole('button', { name: 'Apply 1 change' }).disabled).toBe(true);
  expect(screen.getByRole('radio', { name: 'Take the rewrite' }).disabled).toBe(true);
  expect(panel.textContent).toMatch(/saving/i);
  fireEvent.keyDown(panel, { key: 'y' });
  expect(api.act).toHaveBeenCalledTimes(1);
  const saved = makeState();
  saved.workspace.revision = 2;
  saved.workspace.application.repair.items[0].decision = 'keep';
  await act(async () => { resolveSave(saved); });
  await waitFor(() => expect(screen.getByRole('radio', { name: 'Take the rewrite' }).disabled).toBe(false));
  expect(screen.getByRole('radio', { name: 'Keep as is' }).getAttribute('aria-checked')).toBe('true');
  expect(api.run).not.toHaveBeenCalled();
});
