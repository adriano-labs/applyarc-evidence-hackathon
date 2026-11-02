// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExportDialog } from '../../client/src/components/ExportDialog.jsx';

afterEach(cleanup);

const pack = {
  status: 'NOT SUBMITTED',
  notice: 'Prepared.',
  application: { company: 'Graphcore', role: 'Engineer', url: 'https://example.test/job', snapshotFetchedAt: '2026-10-26T22:41:53Z' },
  documents: [
    { id: 'answer', title: 'Project answer', fieldId: 'question_1', revision: 3, approvedAt: '2026-10-27T09:59:00Z', words: 212, wordLimit: 300, text: 'Hello', references: [] },
  ],
  portalTasks: ['Resume/CV'],
};

describe('ExportDialog copy failure', () => {
  it('shows copy failure message inside the dialog next to the copy button', async () => {
    render(<ExportDialog pack={pack} onClose={vi.fn()} onCopy={vi.fn().mockResolvedValue(false)} onDownload={vi.fn()} />);
    const copyBtn = screen.getByRole('button', { name: 'Copy the project answer' });
    fireEvent.click(copyBtn);
    expect(await screen.findByText(/Could not copy automatically/i)).toBeTruthy();
  });
});
