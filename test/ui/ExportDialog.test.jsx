// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExportDialog } from '../../client/src/components/ExportDialog.jsx';

afterEach(cleanup);

const pack = {
  status: 'NOT SUBMITTED',
  notice: 'Prepared with ApplyArc Evidence. Nothing has been submitted.',
  exportId: 'e1', createdAt: '2026-10-27T10:00:00.000Z',
  application: { company: 'Graphcore', role: 'Graduate Cloud Platform Engineer 2027', url: 'https://example.test/job', snapshotFetchedAt: '2026-10-26T22:41:53Z' },
  documents: [
    { id: 'answer', title: 'Project answer', fieldId: 'question_1', revision: 3, approvedAt: '2026-10-27T09:59:00Z', words: 212, wordLimit: 300, text: 'Four of us built it.\n\nI found the cause.', references: [{ n: 1, statement: 'Four of us.', quote: 'four of us' }] },
    { id: 'letter', title: 'Cover letter', fieldId: 'cover_letter_text', revision: 2, approvedAt: '2026-10-27T09:59:30Z', words: 120, wordLimit: 400, text: 'Dear team,', references: [] },
  ],
  portalTasks: ['Resume/CV', 'Phone'],
};

describe('ExportDialog', () => {
  it('is a modal dialog titled with the pack, stamped NOT SUBMITTED', () => {
    render(<ExportDialog pack={pack} onClose={vi.fn()} onCopy={vi.fn()} onDownload={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Your application pack' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByText('NOT SUBMITTED')).toBeTruthy();
    expect(screen.getByText('Prepared with ApplyArc Evidence. Nothing has been submitted.')).toBeTruthy();
  });

  it('shows each approved document with its version, word count and references', () => {
    render(<ExportDialog pack={pack} onClose={vi.fn()} onCopy={vi.fn()} onDownload={vi.fn()} />);
    expect(screen.getByText('Project answer · version 3 · 212 of 300 words')).toBeTruthy();
    expect(screen.getByText('I found the cause.')).toBeTruthy();
    expect(screen.getByText('Four of us.')).toBeTruthy();
  });

  it('copies one document at a time and downloads the pack', () => {
    const onCopy = vi.fn();
    const onDownload = vi.fn();
    render(<ExportDialog pack={pack} onClose={vi.fn()} onCopy={onCopy} onDownload={onDownload} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy the project answer' }));
    expect(onCopy).toHaveBeenCalledWith('Four of us built it.\n\nI found the cause.');
    fireEvent.click(screen.getByRole('button', { name: 'Download the pack (.md)' }));
    expect(onDownload).toHaveBeenCalled();
  });

  it('lists the portal tasks still to do and closes with Escape', () => {
    const onClose = vi.fn();
    render(<ExportDialog pack={pack} onClose={onClose} onCopy={vi.fn()} onDownload={vi.fn()} />);
    expect(screen.getByRole('list', { name: 'Still to do on the employer’s site' }).children).toHaveLength(2);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
