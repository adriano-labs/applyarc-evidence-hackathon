// @vitest-environment jsdom
// The export dialog offers the Evidence Pass next to the plain pack.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExportDialog } from '../../client/src/components/ExportDialog.jsx';

afterEach(cleanup);

const pack = {
  status: 'NOT SUBMITTED', notice: 'Prepared with ApplyArc Evidence. Nothing has been submitted.', exportId: 'e1', createdAt: '2026-10-29T18:00:00.000Z',
  applicant: 'Marcus', application: { company: 'Harbourline', role: 'Marketing Assistant', url: null, snapshotFetchedAt: null },
  documents: [{ id: 'answer', title: 'Project answer', fieldId: null, revision: 1, approvedAt: '2026-10-29T17:59:00.000Z', words: 6, wordLimit: 300, text: 'I ran the store’s Instagram.', sentences: [{ text: 'I ran the store’s Instagram.', refs: [1], startsParagraph: true }], references: [{ n: 1, statement: 'Ran Instagram.', quote: 'I ran the store’s Instagram', from: 'notes' }] }],
  portalTasks: [],
};

describe('ExportDialog: Evidence Pass', () => {
  it('offers the Evidence Pass as a download, with a line saying what it is', () => {
    const onDownloadPass = vi.fn();
    render(<ExportDialog pack={pack} onClose={vi.fn()} onCopy={vi.fn()} onDownload={vi.fn()} onDownloadPass={onDownloadPass} />);
    fireEvent.click(screen.getByRole('button', { name: 'Download Evidence Pass' }));
    expect(onDownloadPass).toHaveBeenCalledTimes(1);
    expect(screen.getByText('One page to attach: every cited sentence opens your own words behind it.')).toBeTruthy();
  });
});

// UX review of 24f96a5 (29 Oct): the pack says what is the applicant's own words and what is not answered.
describe('ExportDialog: honest per-document notes', () => {
  it('names your own words and anything not answered under each document', () => {
    const honest = { ...pack, documents: [{ ...pack.documents[0], ownWords: 1, notAnswered: ['What you were trying to achieve'] }] };
    render(<ExportDialog pack={honest} onClose={vi.fn()} onCopy={vi.fn()} onDownload={vi.fn()} onDownloadPass={vi.fn()} />);
    expect(screen.getByText('Your own words, not checked against your facts: 1 sentence.')).toBeTruthy();
    expect(screen.getByText('Not answered: What you were trying to achieve.')).toBeTruthy();
  });
});
