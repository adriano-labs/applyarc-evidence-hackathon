// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DocumentView } from '../../client/src/components/DocumentView.jsx';

afterEach(cleanup);

const doc = {
  id: 'answer',
  revision: 2,
  segments: [
    { id: 'answer-1', kind: 'claim', text: 'Four of us built a GPU job runner.', factIds: ['f2', 'f1'], startsParagraph: true, author: 'draft' },
    { id: 'answer-2', kind: 'claim', text: 'I wrote the Helm change.', factIds: ['f3'], startsParagraph: false, author: 'user' },
    { id: 'answer-3', kind: 'frame', text: 'Thank you for reading.', factIds: [], startsParagraph: true, author: 'draft' },
  ],
};
const base = {
  title: 'Project answer', doc, citations: { f1: 1, f2: 2, f3: 3 }, approval: 'none',
  stats: { words: 212, wordLimit: 300, overLimit: false }, limitSource: 'form', locked: false,
  activeFactId: null, changedSegmentIds: [], onCite: vi.fn(), onEdit: vi.fn(async () => {}), onApprove: vi.fn(),
};
const view = (props = {}) => render(<DocumentView {...base} {...props} />);

describe('DocumentView', () => {
  it('keeps the answer prominent with collapsed evidence help and a visible review reminder', () => {
    const { container } = view({ mode: { id: 'meta', isMeta: true, model: 'muse-spark-1.3' } });
    expect(container.querySelector('details.manuscript-help')?.open).toBe(false);
    expect(screen.getByText('AI drafts can contain mistakes. Check the wording before approving.')).toBeTruthy();
  });

  it('shows the title, version and word count against the limit', () => {
    view();
    expect(screen.getByRole('heading', { name: 'Project answer' })).toBeTruthy();
    expect(screen.getByText('Version 2 · 212 of 300 words')).toBeTruthy();
  });

  it('writes each claim’s citations in reference order, and none for a frame sentence', () => {
    const { container } = view();
    const cites = [...container.querySelectorAll('[data-segment="answer-1"] .cite')].map((b) => b.textContent);
    expect(cites).toEqual(['1', '2']);
    expect(container.querySelectorAll('[data-segment="answer-3"] .cite')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Evidence 3' })).toBeTruthy();
  });

  it('starts a paragraph where a segment says so', () => {
    const { container } = view();
    expect(container.querySelectorAll('.para')).toHaveLength(2);
  });

  it('separates sentences in a paragraph with a space', () => {
    const { container } = view({ locked: true });
    expect(container.querySelector('.para').textContent).toBe('Four of us built a GPU job runner.12 I wrote the Helm change.3');
  });

  it('keeps valid markup while editing: nothing block-level inside a paragraph', () => {
    const { container } = view();
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit this sentence' })[0]);
    expect(container.querySelector('.para div')).toBeNull();
    expect(container.querySelector('.edit-actions')).toBeTruthy();
  });

  it('marks the applicant’s own sentence, in ink, with a “Your words” label', () => {
    const { container } = view();
    expect(container.querySelector('[data-segment="answer-2"]').className).toContain('user');
    expect(container.querySelector('[data-segment="answer-1"]').className).toContain('draft');
    expect(screen.getAllByLabelText('Your words')).toHaveLength(1);
  });

  it('reports a hovered or focused citation, and clears it on leave', () => {
    view();
    const cite = screen.getByRole('button', { name: 'Evidence 1' });
    fireEvent.mouseEnter(cite);
    expect(base.onCite.mock.lastCall[0]).toBe('f1');
    fireEvent.mouseLeave(cite);
    expect(base.onCite.mock.lastCall[0]).toBeNull();
    fireEvent.focus(cite);
    expect(base.onCite.mock.lastCall[0]).toBe('f1');
  });

  it('marks the citation of the active fact', () => {
    view({ activeFactId: 'f3' });
    expect(screen.getByRole('button', { name: 'Evidence 3' }).getAttribute('data-active')).toBe('true');
  });

  it('edits a sentence in place and saves it', async () => {
    const onEdit = vi.fn(async () => {});
    view({ onEdit });
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit this sentence' })[0]);
    const box = screen.getByLabelText('Edit sentence');
    expect(box.value).toBe('Four of us built a GPU job runner.');
    fireEvent.change(box, { target: { value: 'Four of us built a self-service GPU job runner.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onEdit).toHaveBeenCalledWith('answer-1', 'Four of us built a self-service GPU job runner.');
  });

  it('cancels an edit with Escape', () => {
    const onEdit = vi.fn(async () => {});
    view({ onEdit });
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit this sentence' })[0]);
    fireEvent.keyDown(screen.getByLabelText('Edit sentence'), { key: 'Escape' });
    expect(screen.queryByLabelText('Edit sentence')).toBeNull();
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('retains unsaved wording after a failed save and closes only after a successful retry', async () => {
    const onEdit = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ workspace: {} });
    view({ onEdit });
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit this sentence' })[0]);
    const wording = 'Our team built a GPU job runner.';
    fireEvent.change(screen.getByLabelText('Edit sentence'), { target: { value: wording } });
    fireEvent.click(screen.getByRole('button', { name: 'Save', exact: true }));
    await waitFor(() => expect(onEdit).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText('Edit sentence').value).toBe(wording);
    fireEvent.click(screen.getByRole('button', { name: 'Save', exact: true }));
    await waitFor(() => expect(screen.queryByLabelText('Edit sentence')).toBeNull());
    expect(onEdit).toHaveBeenLastCalledWith('answer-1', wording);
  });

  it('saves with Ctrl or Cmd + Enter', () => {
    const onEdit = vi.fn(async () => {});
    view({ onEdit });
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit this sentence' })[1]);
    fireEvent.keyDown(screen.getByLabelText('Edit sentence'), { key: 'Enter', metaKey: true });
    expect(onEdit).toHaveBeenCalledWith('answer-2', 'I wrote the Helm change.');
  });

  it('offers no editing while locked', () => {
    view({ locked: true });
    expect(screen.queryAllByRole('button', { name: 'Edit this sentence' })).toHaveLength(0);
  });

  it('shows the approval state, and leaves approving to the next-step bar', () => {
    const { rerender } = view();
    expect(screen.queryByRole('button', { name: /^Approve/ })).toBeNull();
    rerender(<DocumentView {...base} approval="approved" />);
    expect(screen.getAllByText('Approved · version 2').length).toBeGreaterThan(0);
    rerender(<DocumentView {...base} approval="stale" />);
    expect(screen.getByText('Changed since you approved: review version 2')).toBeTruthy();
  });

  it('blocks approval over the word limit and says by how much', () => {
    view({ stats: { words: 311, wordLimit: 300, overLimit: true } });
    expect(screen.getByText('311 words: 11 over the limit. Shorten it before you approve.')).toBeTruthy();
  });

  it('marks sentences the last correction changed', () => {
    view({ changedSegmentIds: ['answer-2'] });
    expect(screen.getAllByText('corrected')).toHaveLength(1);
  });
});
