// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkingState, CheckedDraftPreview } from '../../client/src/components/WorkingState.jsx';
import { DocumentPane } from '../../client/src/components/DocumentPane.jsx';
import { GuidedBody } from '../../client/src/components/GuidedBody.jsx';

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
const busy = { name: 'draft', stage: 'Checking the project answer', started: 0, chars: 2400,
  history: [{ label: 'First stage' }, { label: 'Read the facts' }, { label: 'Drafted the answer' }, { label: 'Checking the project answer' }], tools: [] };

describe('WorkingState', () => {
  it('shows only real recent events with a clear next action and one polite status', () => {
    render(<WorkingState busy={busy} modeLabel="Meta Muse Spark 1.3" />);
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status').textContent).toContain(busy.stage);
    expect(screen.queryByText('First stage')).toBeNull();
    expect(screen.getByRole('list', { name: 'Recent activity' }).children).toHaveLength(2);
    expect(screen.getAllByText(busy.stage)).toHaveLength(1);
    expect(screen.getByText('Next, review both drafts and their evidence.')).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.getByRole('status').textContent).not.toMatch(/seconds|characters|%/);
  });

  it('keeps elapsed timing outside announcements and pauses it while the page is hidden', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-28T12:00:00Z'));
    let visibility = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
    const { container } = render(<WorkingState busy={{ ...busy, started: Date.now() }} modeLabel="Meta" />);
    const details = container.querySelector('details');
    act(() => { details.open = true; fireEvent(details, new Event('toggle')); });
    act(() => { vi.advanceTimersByTime(2000); });
    expect(screen.getByText('Elapsed: 2 s')).toBeTruthy();
    const status = screen.getByRole('status').textContent;
    act(() => { visibility = 'hidden'; fireEvent(document, new Event('visibilitychange')); });
    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.getByText('Elapsed: 2 s')).toBeTruthy();
    expect(container.querySelector('.working-state').dataset.paused).toBe('true');
    act(() => { visibility = 'visible'; fireEvent(document, new Event('visibilitychange')); });
    expect(screen.getByText('Elapsed: 5 s')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe(status);
  });

  it('shows the live tally of the app’s own checks, outside the one status', () => {
    render(<WorkingState busy={{ ...busy, toolCounts: { verify_quote: 7, verbatim: 7, word_count: 1, words: '198 of 300' } }} modeLabel="Meta" />);
    expect(screen.getByText('Checked 7 quotes word for word so far · Counted the words: 198 of 300')).toBeTruthy();
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status').textContent).not.toContain('so far');
  });

  it('labels an injected retry as a test instead of a provider outage', () => {
    render(<WorkingState busy={{ ...busy, retry: { attempt: 2, of: 3, injected: true } }} modeLabel="Meta" />);
    expect(screen.getByRole('status').textContent).toContain('Injected for the demo');
    expect(screen.getByRole('status').textContent).not.toContain('Meta is busy');
  });
});

describe('CheckedDraftPreview', () => {
  it('shows checked text as an unsaved preview without approval or edit controls', () => {
    render(<CheckedDraftPreview preview={{ docId: 'answer', title: 'Project answer', segments: [{ text: 'I tested the deployment.', kind: 'claim', factIds: ['f1'] }] }} />);
    expect(screen.getByRole('heading', { name: 'Project answer' })).toBeTruthy();
    expect(screen.getByText('Checked draft · waiting for the other document')).toBeTruthy();
    expect(screen.getByText('Not saved or ready to approve yet')).toBeTruthy();
    expect(screen.getByText('I tested the deployment.')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('keeps the saved document visible and unchanged while showing an unsaved checked preview', () => {
    const workspace = {
      applicant: { sources: [], facts: [] },
      application: { form: { id: 'form', company: 'Example', documents: [{ id: 'answer', title: 'Project answer', wordLimit: 300 }] },
        documents: { answer: { id: 'answer', revision: 1, segments: [{ id: 's1', text: 'My saved original.', kind: 'frame', factIds: [] }] } } },
    };
    const snapshot = structuredClone(workspace);
    render(<DocumentPane tab="answer" workspace={workspace} view={{ next: 'approve', approvals: {}, stats: {}, citations: {} }}
      busy={{ ...busy, documentPreviews: { answer: { docId: 'answer', title: 'Project answer', segments: [{ text: 'Checked new wording.' }] } } }} />);
    expect(screen.getByText('My saved original.')).toBeTruthy();
    expect(screen.getByText('Checked new wording.')).toBeTruthy();
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /Approve/ })).toBeNull();
    expect(workspace).toEqual(snapshot);
  });

  it('shows the failure and retry after a guided run stops instead of leaving an empty wait', () => {
    const retry = vi.fn(), dismiss = vi.fn();
    render(<GuidedBody stepKey="draft" workspace={{ applicant: { facts: [] } }} busy={null}
      notice={{ kind: 'error', message: 'Connection lost. Saved work is unchanged.', retry }} handlers={{ onDismissNotice: dismiss }} />);
    expect(screen.getByRole('alert').textContent).toContain('Connection lost. Saved work is unchanged.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(retry).toHaveBeenCalledOnce();
    expect(dismiss).toHaveBeenCalledOnce();
  });
});
