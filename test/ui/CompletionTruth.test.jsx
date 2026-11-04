// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { FinishList, GuidedReview } from '../../client/src/components/GuidedReview.jsx';
import { TopBar } from '../../client/src/components/TopBar.jsx';
import { ReceiptsDrawer } from '../../client/src/components/ReceiptsDrawer.jsx';

afterEach(cleanup);
const segment = (id, author = 'draft', kind = 'claim') => ({ id, author, kind, text: id, factIds: kind === 'claim' ? ['f1'] : [] });
const workspace = (manual = true) => ({
  applicant: { sources: [{ kind: 'notes', text: 'I built it.' }], facts: [{ id: 'f1', status: 'confirmed' }] },
  application: {
    form: { documents: [{ id: 'answer' }, { id: 'letter' }] },
    documents: {
      answer: { segments: [segment('a1'), segment('a2', manual ? 'user' : 'draft')] },
      letter: { segments: [segment('greeting', 'draft', 'frame'), segment('l1')] },
    },
    questions: [],
  },
});
const answerRow = (container) => container.querySelectorAll('.guided-summary-row')[3].textContent;

it('distinguishes drafted claims from unrechecked manual wording without claiming the whole document is checked', () => {
  const ws = workspace(); const before = structuredClone(ws);
  const { container } = render(<FinishList workspace={ws} possessive="her" onReview={vi.fn()} />);
  expect(answerRow(container)).toContain('2 drafted statements in 2 documents, each citing her facts');
  expect(answerRow(container)).toContain('1 sentence in her own words, not rechecked');
  expect(ws).toEqual(before);
});

it('keeps fixture truth and omits the manual disclaimer when no sentence has been edited', () => {
  const { container } = render(<FinishList workspace={workspace(false)} possessive="his" onReview={vi.fn()} />);
  expect(answerRow(container)).toContain('3 drafted statements in 2 documents, each citing his facts');
  expect(answerRow(container)).not.toMatch(/AI|not rechecked|own words/);
});

it('counts manual frame edits too and uses the plural', () => {
  const ws = workspace(); ws.application.documents.letter.segments[0].author = 'user';
  const { container } = render(<FinishList workspace={ws} possessive="her" onReview={vi.fn()} />);
  expect(answerRow(container)).toContain('2 drafted statements in 2 documents');
  expect(answerRow(container)).toContain('2 sentences in her own words, not rechecked');
});

// These two stages overlap completely. Summing to100s is intentional model-stage
// accounting; it is not evidence that the applicant waited100s.
const receipts = ['draft', 'review'].map((step) => ({
  step, flow: 'draft', provider: 'meta', isMeta: true, model: 'muse-wonder-1.0', effort: 'medium',
  turns: 1, attempts: 1, toolCalls: [], requestIds: [], usage: { input: 10, cached: 0, output: 10, reasoning: 0 },
  firstEventMs: 100, totalMs: 50000, costUsd: 0.01, at: '2026-11-02T12:00:50.000Z',
}));

it('labels the top-bar summed duration as total model time in visible and accessible text', () => {
  render(<TopBar company="Example" role="Engineer" mode={{ id: 'meta', isMeta: true, label: 'Meta Muse Wonder' }} receipts={receipts} />);
  const activity = screen.getByRole('button', { name: /What Meta did/ });
  expect(activity.getAttribute('aria-label')).toContain('1 min 40 s total model time');
  expect(activity.textContent).toContain('1 min 40 s total model time');
});

it('labels the drawer aggregate while preserving each stage’s actual duration', () => {
  const { container } = render(<ReceiptsDrawer receipts={receipts} modeLabel="Meta Muse Wonder" />);
  const activity = screen.getByRole('button', { name: /What Meta did/ });
  expect(activity.textContent).toContain('1 min 40 s total model time');
  fireEvent.click(activity);
  const rows = container.querySelectorAll('.receipt');
  expect(rows).toHaveLength(2);
  for (const row of rows) {
    expect(row.textContent).toContain('done 50.0 s');
    expect(row.textContent).not.toContain('total model time');
  }
});


it('keeps answered conflict history quote-first without re-exposing a model-invented premise', () => {
  const ws = workspace();
  const originalQuestion = 'Did you only watch, or was your code for a different project?';
  const answer = 'We worked on the same stock check together.';
  ws.applicant.sources.push({ id: 's2', kind: 'answer', text: answer });
  ws.application.questions.push({ id: 'q2', kind: 'source-conflict', status: 'answered', sourceId: 's2',
    text: originalQuestion, why: 'It must have been a different project.',
    priorQuote: 'We wrote the stock check.', quote: 'I wrote the duplicate-item check.' });
  const before = structuredClone(ws);
  render(<GuidedReview n={3} workspace={ws} possessive="her" />);
  expect(screen.getByText('These details may not agree. What should I use?')).toBeTruthy();
  expect(screen.getByText('We wrote the stock check.', { exact: true })).toBeTruthy();
  expect(screen.getByText('I wrote the duplicate-item check.', { exact: true })).toBeTruthy();
  expect(screen.getByText(answer, { exact: true })).toBeTruthy();
  expect(screen.queryByText(originalQuestion)).toBeNull();
  expect(screen.queryByText('It must have been a different project.')).toBeNull();
  expect(screen.queryByText('Your saved work is unchanged. Check the two accounts before continuing.')).toBeNull();
  expect(ws).toEqual(before);
});

it('preserves a normal clarification and its exact saved answer in look-back', () => {
  const ws = workspace();
  ws.applicant.sources.push({ id: 's2', kind: 'answer', text: 'I wrote the duplicate-item check.' });
  ws.application.questions.push({ id: 'q2', status: 'answered', sourceId: 's2', text: 'Which check did you write yourself?' });
  render(<GuidedReview n={3} workspace={ws} possessive="her" />);
  expect(screen.getByText('Which check did you write yourself?', { exact: true })).toBeTruthy();
  expect(screen.getByText('I wrote the duplicate-item check.', { exact: true })).toBeTruthy();
  expect(screen.queryByText('These details may not agree. What should I use?')).toBeNull();
});
