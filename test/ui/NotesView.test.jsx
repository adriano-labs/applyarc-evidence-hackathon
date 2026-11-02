// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotesView } from '../../client/src/components/NotesView.jsx';

afterEach(cleanup);

const sources = [
  { id: 's1', kind: 'notes', text: 'We used Redis for the queue. It took us three days.' },
  { id: 's2', kind: 'answer', text: 'I found the problem.', questionId: 'q1' },
  { id: 's3', kind: 'correction', text: 'Sam fixed it.' },
];
const facts = [
  { id: 'f1', quote: 'Redis for the queue', sourceId: 's1', status: 'confirmed' },
  { id: 'f2', quote: 'three days', sourceId: 's1', status: 'proposed' },
  { id: 'f3', quote: 'I found the problem.', sourceId: 's2', status: 'rejected' },
];
const base = { sources: [], facts: [], questions: [{ id: 'q1', text: 'What did you do?' }], activeFactId: null, busy: false, sampleNotes: 'Sample notes text.', onAddNotes: vi.fn(), onHover: vi.fn() };

describe('NotesView', () => {
  it('offers a complete own-input form rather than silently reusing the sample employer question', () => {
    render(<NotesView {...base} onStartOwn={vi.fn()} liveModel />);
    fireEvent.click(screen.getByText('Try your own fictional example'));
    expect(screen.getByLabelText('Fictional CV or project notes')).toBeTruthy();
    expect(screen.getByLabelText('Exact application question')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Read my example' }).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Read my notes' })).toBeNull();
  });

  it('shows each source with every proposed or confirmed quote highlighted', () => {
    const { container } = render(<NotesView {...base} sources={sources} facts={facts} />);
    expect(screen.getByRole('heading', { name: 'Your notes' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Your answer to “What did you do?”' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Your correction' })).toBeTruthy();
    const marks = [...container.querySelectorAll('mark')];
    expect(marks.map((m) => [m.textContent, m.getAttribute('data-status')])).toEqual([['Redis for the queue', 'confirmed'], ['three days', 'proposed']]);
  });

  it('marks the active fact’s quote and reports hover over a quote', () => {
    const onHover = vi.fn();
    const { container } = render(<NotesView {...base} sources={sources} facts={facts} activeFactId="f1" onHover={onHover} />);
    const mark = container.querySelector('mark[data-fact="f1"]');
    expect(mark.getAttribute('data-active')).toBe('true');
    fireEvent.mouseEnter(mark);
    expect(onHover).toHaveBeenLastCalledWith('f1');
  });

  it('shows existing notes and the Add a note flow, trims on success and clears input while keeping old content', async () => {
    const onAddNotes = vi.fn().mockResolvedValue({ ok: true });
    render(<NotesView {...base} sources={sources} facts={facts} onAddNotes={onAddNotes} liveModel />);
    expect(screen.getByRole('heading', { name: 'Your notes' })).toBeTruthy();
    expect(screen.getByText('Add a note')).toBeTruthy();
    fireEvent.click(screen.getByText('Add a note'));
    const textarea = screen.getByLabelText('New note');
    fireEvent.change(textarea, { target: { value: '  My new note  ' } });
    const button = screen.getByRole('button', { name: 'Add note' });
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    expect(screen.getByRole('button', { name: 'Adding note…' })).toBeTruthy();
    await screen.findByText('Note added. Review any new facts or questions.');
    expect(onAddNotes).toHaveBeenCalledWith('My new note');
    expect(textarea.value).toBe('');
    expect(screen.getByRole('heading', { name: 'Your notes' })).toBeTruthy();
  });

  it.each([false, null, undefined])('preserves input when the save result is %s', async (result) => {
    const onAddNotes = vi.fn().mockResolvedValue(result);
    render(<NotesView {...base} sources={sources} facts={facts} onAddNotes={onAddNotes} liveModel />);
    fireEvent.click(screen.getByText('Add a note'));
    const textarea = screen.getByLabelText('New note');
    fireEvent.change(textarea, { target: { value: 'Keep me' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add note' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Could not add your note. Your text is still here; try again.');
    expect(textarea.value).toBe('Keep me');
  });

  it('preserves input and shows alert when onAddNotes throws', async () => {
    const onAddNotes = vi.fn().mockRejectedValue(new Error('fail'));
    render(<NotesView {...base} sources={sources} facts={facts} onAddNotes={onAddNotes} liveModel />);
    fireEvent.click(screen.getByText('Add a note'));
    const textarea = screen.getByLabelText('New note');
    fireEvent.change(textarea, { target: { value: 'Still here' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add note' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Could not add your note. Your text is still here; try again.');
    expect(textarea.value).toBe('Still here');
  });

  it('keeps the disclosure open while retrying a failed save', async () => {
    let resolve;
    const onAddNotes = vi.fn().mockResolvedValueOnce(null)
      .mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    render(<NotesView {...base} sources={sources} onAddNotes={onAddNotes} liveModel />);
    const summary = screen.getByText('Add a note');
    fireEvent.click(summary);
    fireEvent.change(screen.getByLabelText('New note'), { target: { value: 'Keep me' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add note' }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Add note' }));
    expect(summary.closest('details').open).toBe(true);
    await act(async () => resolve({ ok: true }));
    expect(screen.getByLabelText('New note').value).toBe('');
  });

  it('prevents duplicates when busy or sending', async () => {
    const onAddNotes = vi.fn(() => new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 50)));
    const { rerender } = render(<NotesView {...base} sources={sources} facts={facts} onAddNotes={onAddNotes} liveModel />);
    fireEvent.click(screen.getByText('Add a note'));
    const textarea = screen.getByLabelText('New note');
    fireEvent.change(textarea, { target: { value: 'Note' } });
    const button = screen.getByRole('button', { name: 'Add note' });
    fireEvent.click(button);
    expect(screen.getByRole('button', { name: 'Adding note…' }).disabled).toBe(true);
    expect(textarea.disabled).toBe(true);
    rerender(<NotesView {...base} sources={sources} facts={facts} onAddNotes={onAddNotes} liveModel busy />);
    expect(screen.getByRole('button', { name: 'Adding note…' }).disabled).toBe(true);
  });

  it('is disabled in fixture mode with limitation visible', () => {
    render(<NotesView {...base} sources={sources} facts={facts} onAddNotes={vi.fn()} liveModel={false} />);
    fireEvent.click(screen.getByText('Add a note'));
    expect(screen.getByText('Adding notes is not available in this mode.')).toBeTruthy();
    const button = screen.getByRole('button', { name: 'Add note' });
    expect(button.disabled).toBe(true);
  });

  it('disables add for blank or whitespace only', () => {
    render(<NotesView {...base} sources={sources} facts={facts} onAddNotes={vi.fn()} liveModel />);
    fireEvent.click(screen.getByText('Add a note'));
    const button = screen.getByRole('button', { name: 'Add note' });
    expect(button.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('New note'), { target: { value: '   ' } });
    expect(button.disabled).toBe(true);
  });

  it('reveals only the explicitly pinned fact while passive highlights stay still', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const { container, rerender } = render(<NotesView {...base} sources={sources} facts={facts} activeFactId={null} revealFactId={null} />);
    const mark1 = container.querySelector('mark[data-fact="f1"]');
    expect(mark1.getAttribute('data-active')).toBe('false');
    rerender(<NotesView {...base} sources={sources} facts={facts} activeFactId="f1" revealFactId={null} />);
    expect(container.querySelector('mark[data-fact="f1"]').getAttribute('data-active')).toBe('true');
    expect(scrollIntoView).not.toHaveBeenCalled();
    rerender(<NotesView {...base} sources={sources} facts={facts} activeFactId="f1" revealFactId="f2" />);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.contexts[0]).toBe(container.querySelector('mark[data-fact="f2"]'));
    scrollIntoView.mockClear();
    rerender(<NotesView {...base} sources={sources} facts={facts} activeFactId="f2" revealFactId="f2" />);
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(container.querySelector('mark[data-fact="f1"]').getAttribute('data-active')).toBe('false');
    expect(container.querySelector('mark[data-fact="f2"]').getAttribute('data-active')).toBe('true');
  });
});
