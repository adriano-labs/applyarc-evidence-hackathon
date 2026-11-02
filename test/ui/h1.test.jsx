// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DocumentView } from '../../client/src/components/DocumentView.jsx';

afterEach(cleanup);

const doc = { id: 'answer', revision: 3, segments: [{ id: 'answer-1', kind: 'claim', text: 'I wrote the Helm change.', factIds: ['f1'], startsParagraph: true, author: 'repair' }] };
const props = {
  title: 'Project answer', doc, citations: { f1: 1 }, stats: { words: 5, wordLimit: 300, overLimit: false },
  limitSource: 'form', locked: false, activeFactId: null, changedSegmentIds: [], onCite: vi.fn(), onEdit: vi.fn(async () => {}), onApprove: vi.fn(),
};

describe('H1', () => {
  it('keeps the old approval, struck through, when the document changed after it', () => {
    render(<DocumentView {...props} approval="stale" approvedRevision={2} />);
    expect(screen.getByRole('deletion').textContent).toBe('Approved · version 2');
    expect(screen.getByText('Changed since you approved: review version 3')).toBeTruthy();
  });

  it('still says what changed when the approved version is not known', () => {
    render(<DocumentView {...props} approval="stale" />);
    expect(screen.queryByRole('deletion')).toBeNull();
    expect(screen.getByText('Changed since you approved: review version 3')).toBeTruthy();
  });
});
