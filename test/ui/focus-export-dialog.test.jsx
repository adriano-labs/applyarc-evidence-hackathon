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

describe('ExportDialog focus', () => {
  it('keeps Tab inside the dialog: from the last control it wraps to the first, and back', () => {
    render(<ExportDialog pack={pack} onClose={vi.fn()} onCopy={vi.fn()} onDownload={vi.fn()} />);
    const controls = [...screen.getByRole('dialog').querySelectorAll('button')];
    controls.at(-1).focus();
    fireEvent.keyDown(controls.at(-1), { key: 'Tab' });
    expect(document.activeElement).toBe(controls[0]);
    fireEvent.keyDown(controls[0], { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(controls.at(-1));
  });

  it('gives focus back to what opened it when it closes', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const { unmount } = render(<ExportDialog pack={pack} onClose={vi.fn()} onCopy={vi.fn()} onDownload={vi.fn()} />);
    expect(document.activeElement).toBe(screen.getByRole('dialog'));
    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});
