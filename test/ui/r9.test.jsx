// @vitest-environment jsdom
// R9: the export dialog reads like the finished paper.
import { readFileSync } from 'node:fs';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExportDialog } from '../../client/src/components/ExportDialog.jsx';
import { fromRoot } from '../../server/paths.js';

afterEach(() => { cleanup(); vi.useRealTimers(); });

const pack = {
  status: 'NOT SUBMITTED',
  notice: 'Prepared with ApplyArc Evidence. Nothing has been submitted.',
  exportId: 'e1', createdAt: '2026-10-27T10:00:00.000Z',
  application: { company: 'Graphcore', role: 'Graduate Cloud Platform Engineer 2027', url: 'https://example.test/job', snapshotFetchedAt: '2026-10-26T22:41:53Z' },
  documents: [
    { id: 'answer', title: 'Project answer', revision: 3, words: 212, wordLimit: 300, text: 'Four of us built it.\n\nI found the cause.', references: [{ n: 1, statement: 'Four of us.', quote: 'four of us' }] },
    { id: 'letter', title: 'Cover letter', revision: 2, words: 120, wordLimit: 400, text: 'Dear team,', references: [] },
  ],
  portalTasks: ['Resume/CV', 'Phone'],
};
const dialog = (props = {}) => render(<ExportDialog pack={pack} onClose={vi.fn()} onCopy={vi.fn()} onDownload={vi.fn()} {...props} />);
const css = readFileSync(fromRoot('client', 'src', 'components', 'ExportDialog.css'), 'utf8');

describe('R9 the pack', () => {
  it('says what is in it, under the stamp and the notice', () => {
    const { container } = dialog();
    expect(container.querySelector('.export-contents').textContent).toBe('In this pack: Project answer, version 3 · Cover letter, version 2 · 2 things to do on the employer’s site');
  });

  it('shows every reference with the applicant’s own words, washed and in curly quotes', () => {
    const { container } = dialog();
    const ref = container.querySelector('.export-refs li');
    expect(ref.querySelector('.ref-n').textContent).toBe('1');
    expect(ref.querySelector('.export-ref-statement').textContent).toBe('Four of us.');
    expect(ref.querySelector('.export-quote').textContent).toBe('“four of us”');
    expect(ref.querySelector('.export-quote mark').textContent).toBe('four of us');
    expect(screen.getAllByRole('heading', { name: 'Your evidence' })).toHaveLength(1);
  });

  it('puts each copy button in its document’s head row, and says Copied for two seconds after success', async () => {
    vi.useFakeTimers();
    const onCopy = vi.fn().mockResolvedValue(true);
    const { container } = dialog({ onCopy });
    const head = container.querySelector('.export-doc-head');
    expect(head.querySelector('h3').textContent).toBe('Project answer · version 3 · 212 of 300 words');
    const copy = head.querySelector('button');
    expect(copy.textContent).toBe('Copy the project answer');
    await act(async () => { fireEvent.click(copy); });
    expect(onCopy).toHaveBeenCalledWith('Four of us built it.\n\nI found the cause.');
    expect(copy.textContent).toBe('Copied');
    act(() => { vi.advanceTimersByTime(2000); });
    expect(copy.textContent).toBe('Copy the project answer');
  });

  it('does not claim a pending or failed copy succeeded, and allows retry', async () => {
    let finishCopy;
    const onCopy = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => { finishCopy = resolve; }))
      .mockResolvedValueOnce(true);
    dialog({ onCopy });
    const copy = screen.getByRole('button', { name: 'Copy the project answer' });
    fireEvent.click(copy);
    expect(copy.textContent).toBe('Copy the project answer');
    await act(async () => { finishCopy(false); });
    expect(copy.textContent).toBe('Copy the project answer');
    await act(async () => { fireEvent.click(copy); });
    expect(copy.textContent).toBe('Copied');
  });

  it('numbers the portal tasks', () => {
    const { container } = dialog();
    expect([...container.querySelectorAll('ol.export-tasks li')].map((li) => li.textContent)).toEqual(['Resume/CV', 'Phone']);
  });
});

describe('R9 the dialog', () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>Preview the export</button>
        {open ? <ExportDialog pack={pack} onClose={() => setOpen(false)} onCopy={vi.fn()} onDownload={vi.fn()} /> : null}
      </>
    );
  }

  it('closes on Esc and gives focus back to the button that opened it', () => {
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Preview the export' });
    opener.focus();
    fireEvent.click(opener);
    const box = screen.getByRole('dialog', { name: 'Your application pack' });
    expect(document.activeElement).toBe(box);
    fireEvent.keyDown(box, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('sets the title in the document face, keeps the footer in view, and fills a phone screen', () => {
    expect(css).toMatch(/\.export-dialog h2\s*\{[^}]*font-family:\s*var\(--font-doc\)/);
    expect(css).toMatch(/\.export-dialog footer\s*\{[^}]*position:\s*sticky/);
    expect(css).toMatch(/@media \(max-width: 767px\)\s*\{[^@]*\.export-dialog\s*\{[^}]*inset:\s*0/);
  });
});
