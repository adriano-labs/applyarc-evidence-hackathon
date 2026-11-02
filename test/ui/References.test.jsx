// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { References } from '../../client/src/components/References.jsx';

afterEach(cleanup);

const facts = [
  { id: 'f1', statement: 'Redis held the queue.', quote: 'Redis for the queue', sourceId: 's1', status: 'confirmed' },
  { id: 'f2', statement: 'I wrote the Helm change.', quote: 'I wrote the Helm change.', sourceId: 's2', status: 'confirmed' },
  { id: 'f3', statement: 'Four of us.', quote: 'four of us', sourceId: 's1', status: 'confirmed' },
  { id: 'f4', statement: 'Ellie led it.', quote: 'we built', sourceId: 's1', status: 'rejected' },
];
const base = { facts, citations: { f2: 1, f1: 2 }, sources: { s1: 'notes', s2: 'answer' }, activeFactId: null, locked: false, onCorrect: vi.fn(), onHover: vi.fn() };
const view = (props = {}) => render(<References {...base} {...props} />);

describe('References', () => {
  it('lists cited facts in reference order, then facts not cited yet', () => {
    const { container } = view();
    expect(screen.getByRole('heading', { name: 'Your evidence' })).toBeTruthy();
    const numbers = [...container.querySelectorAll('.ref-n')].map((n) => n.textContent);
    expect(numbers).toEqual(['1', '2']);
    expect(screen.getByText('Not cited yet')).toBeTruthy();
    expect(container.querySelectorAll('.ref.uncited')).toHaveLength(1);
  });

  it('shows the exact quote highlighted and its source', () => {
    view();
    expect(screen.getByText('Redis for the queue').tagName).toBe('MARK');
    expect(screen.getAllByText('From your notes').length).toBeGreaterThan(0);
    expect(screen.getAllByText('From your answer').length).toBe(1);
  });

  it('marks the fact the applicant is pointing at in a document', () => {
    const { container } = view({ activeFactId: 'f1' });
    expect(container.querySelector('[data-fact="f1"]').getAttribute('data-active')).toBe('true');
  });

  it('reports hover so the citations light up too', () => {
    const onHover = vi.fn();
    const { container } = view({ onHover });
    fireEvent.mouseEnter(container.querySelector('[data-fact="f2"]'));
    expect(onHover).toHaveBeenLastCalledWith('f2');
    fireEvent.mouseLeave(container.querySelector('[data-fact="f2"]'));
    expect(onHover).toHaveBeenLastCalledWith(null);
  });

  it('corrects a fact in the applicant’s own words', async () => {
    const onCorrect = vi.fn().mockResolvedValue({ workspace: {} });
    view({ onCorrect });
    fireEvent.click(screen.getAllByRole('button', { name: 'Correct this fact' })[0]);
    const box = screen.getByLabelText('The fact, in your words');
    expect(box.value).toBe('I wrote the Helm change.');
    expect(screen.getByText('Saving it finds every sentence that cites this fact and proposes a fix for you to review.')).toBeTruthy();
    fireEvent.change(box, { target: { value: 'Sam wrote the Helm change; I tested it.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save the correction' }));
    expect(onCorrect).toHaveBeenCalledWith('f2', 'Sam wrote the Helm change; I tested it.');
    await waitFor(() => expect(screen.queryByText('Saving it finds every sentence that cites this fact and proposes a fix for you to review.')).toBeNull());
  });

  it('shows rejected facts struck through and offers no correction while locked', () => {
    const { container } = view({ locked: true });
    expect(container.querySelector('.ref.rejected s')).toBeTruthy();
    expect(screen.getByText('Rejected (1)')).toBeTruthy();
    expect(screen.queryAllByRole('button', { name: 'Correct this fact' })).toHaveLength(0);
  });

  it('locks one pending save and closes only when it succeeds', async () => {
    let complete;
    const onCorrect = vi.fn(() => new Promise((resolve) => { complete = resolve; }));
    const onCloseCorrection = vi.fn();
    view({ onCorrect, onCloseCorrection, sample: { name: 'Ellie', correction: { quote: facts[1].quote, text: 'Sam wrote it; I tested it.' } } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Correct this fact' })[0]);
    const editor = screen.getByLabelText('The fact, in your words');
    fireEvent.change(editor, { target: { value: 'I tested Sam’s fix and wrote the incident notes.' } });
    const save = screen.getByRole('button', { name: 'Save the correction' });
    fireEvent.click(save);
    expect(editor.disabled).toBe(true);
    expect(save.disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Cancel' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Use Ellie’s sample correction' }).disabled).toBe(true);
    fireEvent.click(save);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCorrect).toHaveBeenCalledTimes(1);
    expect(onCloseCorrection).not.toHaveBeenCalled();
    await act(async () => complete({ workspace: {} }));
    expect(screen.queryByLabelText('The fact, in your words')).toBeNull();
    expect(onCloseCorrection).toHaveBeenCalledTimes(1);
  });

  it.each([null, undefined, false, 'reject'])('keeps the draft when success is not confirmed: %s', async (result) => {
    const onCorrect = vi.fn(() => result === 'reject' ? Promise.reject(new Error('Disconnected')) : Promise.resolve(result));
    const onCloseCorrection = vi.fn();
    view({ onCorrect, onCloseCorrection });
    fireEvent.click(screen.getAllByRole('button', { name: 'Correct this fact' })[0]);
    const text = 'Sam wrote the patch.\nI tested it and wrote the notes.';
    fireEvent.change(screen.getByLabelText('The fact, in your words'), { target: { value: text } });
    fireEvent.click(screen.getByRole('button', { name: 'Save the correction' }));
    await screen.findByRole('alert');
    expect(screen.getByLabelText('The fact, in your words').value).toBe(text);
    expect(screen.getByRole('button', { name: 'Save the correction' }).disabled).toBe(false);
    expect(onCloseCorrection).not.toHaveBeenCalled();
  });

  it('reveals only the explicitly pinned fact while passive highlights stay still', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const { container, rerender } = render(<References {...base} activeFactId={null} revealFactId={null} />);
    expect(container.querySelector('[data-fact="f1"]').getAttribute('data-active')).toBe('false');
    rerender(<References {...base} activeFactId="f1" revealFactId={null} />);
    expect(container.querySelector('[data-fact="f1"]').getAttribute('data-active')).toBe('true');
    expect(scrollIntoView).not.toHaveBeenCalled();
    rerender(<References {...base} activeFactId="f1" revealFactId="f2" />);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.contexts[0]).toBe(container.querySelector('[data-fact="f2"]'));
    scrollIntoView.mockClear();
    rerender(<References {...base} activeFactId="f2" revealFactId="f2" />);
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(container.querySelector('[data-fact="f1"]').getAttribute('data-active')).toBe('false');
    expect(container.querySelector('[data-fact="f2"]').getAttribute('data-active')).toBe('true');
  });
});
