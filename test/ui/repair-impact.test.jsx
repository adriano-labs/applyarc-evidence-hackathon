// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { ChangeQueue } from '../../client/src/components/ChangeQueue.jsx';

afterEach(cleanup);
const first = { id: 'c1', docId: 'answer', segmentId: 'a1', before: 'I wrote the change.', after: 'I tested the change.', status: 'proposed', decision: null };
const fact = { statement: 'I tested the change; Sam wrote it.', history: [{ statement: 'I wrote the change.' }] };
const props = { fact, number: 7, docTitles: { answer: 'Project answer', letter: 'Cover letter' }, untouchedCount: 27 };
const queue = (items, extra = {}) => <ChangeQueue {...props} repair={{ status: 'review', items }} {...extra} />;

it('shows the real number of affected documents and sentences without counting the same document twice', () => {
  render(queue([first, { ...first, id: 'c2', segmentId: 'a2' }, { ...first, id: 'c3', docId: 'letter', segmentId: 'l1' }]));
  const impact = screen.getByRole('group', { name: 'Correction impact' });
  expect(within(impact).getByText('2 documents')).toBeTruthy();
  expect(within(impact).getByText('3 sentences to review')).toBeTruthy();
  expect(within(impact).getByText('27 untouched')).toBeTruthy();
  expect(impact.textContent).not.toMatch(/approved|verified|time saved/i);
});

it('keeps unknown unchanged count absent and uses singular labels', () => {
  render(queue([first], { untouchedCount: undefined }));
  const impact = screen.getByRole('group', { name: 'Correction impact' });
  expect(within(impact).getByText('1 document')).toBeTruthy();
  expect(within(impact).getByText('1 sentence to review')).toBeTruthy();
  expect(impact.textContent).not.toMatch(/untouched|undefined|NaN/);
});

it('does not invent affected work when a correction has no linked sentences', () => {
  render(queue([], { untouchedCount: 12 }));
  const impact = screen.getByRole('group', { name: 'Correction impact' });
  expect(within(impact).getByText('0 documents')).toBeTruthy();
  expect(within(impact).getByText('0 sentences to review')).toBeTruthy();
  expect(within(impact).getByText('12 untouched')).toBeTruthy();
});

it('does not announce review-ready output while proposals are still running', () => {
  render(queue([first], { repair: { status: 'pending', items: [first] }, busy: { name: 'repair' } }));
  const impact = screen.getByRole('group', { name: 'Correction impact' });
  expect(within(impact).getByText('1 sentence affected')).toBeTruthy();
  expect(impact.textContent).not.toMatch(/to review/);
  expect(screen.queryAllByRole('radio')).toHaveLength(0);
  expect(screen.getByRole('button', { name: 'Apply 1 change' }).disabled).toBe(true);
});
