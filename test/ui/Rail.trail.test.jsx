// @vitest-environment jsdom
// The trail opens as its own aside in the rail, with one way back to the references.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Rail } from '../../client/src/components/Rail.jsx';

afterEach(cleanup);

const workspace = {
  applicant: { sources: [{ id: 's1', kind: 'notes', text: 'I built it.' }], facts: [{ id: 'f1', sourceId: 's1', status: 'confirmed', statement: 'Built it.', quote: 'I built it.' }] },
  application: { form: { documents: [{ id: 'answer', title: 'Project answer' }, { id: 'letter', title: 'Cover letter' }] }, documents: {}, questions: [] },
};
const receipts = [{ step: 'extract', flow: 'read', provider: 'meta', isMeta: true, model: 'muse-wonder-1.0', costUsd: 0.01, totalMs: 1000, toolCalls: [], at: '2026-11-03T10:00:00Z' }];
const mode = { id: 'meta', label: 'Meta Muse Wonder 1.0', model: 'muse-wonder-1.0', isMeta: true };
const rail = (props = {}) => render(<Rail workspace={workspace} view={{ citations: { f1: 1 }, approvals: {} }} receipts={receipts} mode={mode} busy={null} pending={false} onReceiptsToggle={vi.fn()} onDownloadTrace={vi.fn()} {...props} />);

describe('Rail with the trail open', () => {
  it('swaps the references for the trail and offers a way back', () => {
    const onReceiptsToggle = vi.fn();
    rail({ receiptsOpen: true, onReceiptsToggle });
    expect(screen.queryByRole('heading', { name: 'Your evidence' })).toBeNull();
    expect(screen.getByRole('button', { name: /What Meta did/ }).getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById('receipts-body')).toBeTruthy();
    expect(screen.getByText('Read your notes')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back to your evidence' }));
    expect(onReceiptsToggle).toHaveBeenCalledWith(false);
  });

  it('shows the references and the closed summary line when the trail is closed', () => {
    rail({ receiptsOpen: false });
    expect(screen.getByRole('heading', { name: 'Your evidence' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Back to your evidence' })).toBeNull();
    expect(screen.getByRole('button', { name: /What Meta did/ }).getAttribute('aria-expanded')).toBe('false');
    expect(document.getElementById('receipts-body')).toBeNull();
  });

  it('keeps whatever waits on the applicant on screen, with the trail open at its foot', () => {
    const repair = { factId: 'f1', status: 'review', items: [{ id: 'c1', docId: 'answer', segmentId: 'a1', status: 'proposed', before: 'x', after: 'y', decision: null }] };
    const queue = rail({ receiptsOpen: true, workspace: { ...workspace, application: { ...workspace.application, repair } } });
    expect(queue.container.querySelector('.queue')).toBeTruthy();
    expect(document.getElementById('receipts-body')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Back to your evidence' })).toBeNull();
    queue.unmount();
    const proposed = { ...workspace, applicant: { ...workspace.applicant, facts: [{ ...workspace.applicant.facts[0], status: 'proposed' }] } };
    const facts = rail({ receiptsOpen: true, workspace: proposed, view: { citations: {}, approvals: {}, next: 'facts' } });
    expect(facts.container.querySelector('.facts-review')).toBeTruthy();
    expect(document.getElementById('receipts-body')).toBeTruthy();
    facts.unmount();
    rail({ receiptsOpen: true, openCorrectionFactId: 'f1' });
    expect(screen.getByRole('heading', { name: 'Your evidence' })).toBeTruthy();
    expect(document.getElementById('receipts-body')).toBeTruthy();
  });

  it('moves focus to the way back when the trail opens, and back to the toggle when it closes', async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return <Rail workspace={workspace} view={{ citations: { f1: 1 }, approvals: {} }} receipts={receipts} mode={mode} busy={null} pending={false} receiptsOpen={open} onReceiptsToggle={setOpen} onDownloadTrace={vi.fn()} />;
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /What Meta did/ }));
    const back = screen.getByRole('button', { name: 'Back to your evidence' });
    expect(document.activeElement).toBe(back);
    fireEvent.click(back);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /What Meta did/ }));
  });
});
