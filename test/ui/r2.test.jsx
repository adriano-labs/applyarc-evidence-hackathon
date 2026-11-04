// @vitest-environment jsdom
// First run: say what the product is, and make Ellie's sample one obvious click.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotesView } from '../../client/src/components/NotesView.jsx';

afterEach(cleanup);
const base = { sources: [], facts: [], questions: [], activeFactId: null, busy: false, sampleNotes: 'Sample notes text.', company: 'Graphcore', wordLimit: 300, snapshotDate: '2026-10-26T22:41:53Z', onAddNotes: vi.fn(), onHover: vi.fn(), onStartOwn: vi.fn(), liveModel: true };
const HOW = [
  'Paste your rough notes. Confirm the facts the app finds in them.',
  'Get the employer’s answer and a cover letter, with every claim the app writes citing your own words.',
  'Correct one fact, and only the sentences that cited it reopen, in both documents, with a rewrite proposed beside each. Your own edits are never rewritten without asking.',
];
const PROMISE = 'Built for applicants, not employers: it never screens, scores or ranks anyone, and never submits anything.';

describe('R2 first run', () => {
  it('says what the product is before anything else', () => {
    render(<NotesView {...base} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Application answers you can defend at interview.' })).toBeTruthy();
    expect(within(screen.getByRole('list', { name: 'How it works' })).getAllByRole('listitem').map((li) => li.textContent)).toEqual(HOW);
    expect(screen.getByText(PROMISE)).toBeTruthy();
    expect(screen.getByText('Ellie is a fictional graduate. Her notes say “we”; the real Graphcore form (a public snapshot from 26 Oct 2026) asks what she did herself. On the live model, allow about five minutes: the correction is the last step.')).toBeTruthy();
    expect(screen.getByText('Try your own fictional example')).toBeTruthy();
  });

  it('runs Ellie’s whole first step with one click', () => {
    const onAddNotes = vi.fn();
    render(<NotesView {...base} onAddNotes={onAddNotes} />);
    const tryIt = screen.getByRole('button', { name: 'Try it with Ellie’s notes' });
    expect(tryIt.className).toMatch(/\bprimary\b/);
    fireEvent.click(tryIt);
    expect(onAddNotes).toHaveBeenCalledTimes(1);
    expect(onAddNotes).toHaveBeenCalledWith('Sample notes text.');
  });

  it('keeps the sample primary and reveals the complete own-input route on demand', () => {
    render(<NotesView {...base} />);
    const disclosure = screen.getByText('Try your own fictional example').closest('details');
    expect(disclosure.open).toBe(false);
    expect(screen.getByRole('button', { name: 'Try it with Ellie’s notes' }).className).toMatch(/\bprimary\b/);
    fireEvent.click(screen.getByText('Try your own fictional example'));
    expect(disclosure.open).toBe(true);
    const read = screen.getByRole('button', { name: 'Read my example' });
    expect(read.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Fictional CV or project notes'), { target: { value: 'I wrote the tests.' } });
    expect(read.disabled).toBe(true);
    expect(screen.getByLabelText('Exact application question')).toBeTruthy();
    expect(screen.getByLabelText(/I checked these points/).checked).toBe(false);
  });

  it('keeps the plain composer when there is no sample', () => {
    render(<NotesView {...base} sampleNotes={undefined} />);
    expect(screen.queryByRole('button', { name: 'Try it with Ellie’s notes' })).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'Application answers you can defend at interview.' })).toBeTruthy();
  });
});
