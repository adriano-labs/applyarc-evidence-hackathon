// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StatusLine, TopBar } from '../../client/src/components/TopBar.jsx';

afterEach(() => { cleanup(); vi.useRealTimers(); });

const base = {
  company: 'Graphcore', role: 'Graduate Cloud Platform Engineer 2027',
  mode: { id: 'fixture', label: 'Fixture', model: 'hand-written', isMeta: false },
  budget: null, onCommands: vi.fn(), onReset: vi.fn(), onReceipts: vi.fn(),
};

describe('TopBar', () => {
  it('names the product and the application', () => {
    render(<TopBar {...base} />);
    expect(screen.getByText('ApplyArc Evidence')).toBeTruthy();
    expect(screen.getByText('Graphcore')).toBeTruthy();
    expect(screen.getByText('Graduate Cloud Platform Engineer 2027')).toBeTruthy();
  });

  it('labels the mode honestly', () => {
    const { rerender } = render(<TopBar {...base} />);
    expect(screen.getByText('Fixture: hand-written outputs, not a model')).toBeTruthy();
    rerender(<TopBar {...base} mode={{ id: 'other', label: 'Another model', model: 'other-model', isMeta: false }} />);
    expect(screen.getByText('Another model, not Meta')).toBeTruthy();
    rerender(<TopBar {...base} mode={{ id: 'meta', label: 'Meta Muse Spark 1.3', model: 'muse-spark-1.3', isMeta: true }} />);
    expect(screen.getByText('Meta Muse Spark 1.3')).toBeTruthy();
  });

  it('opens the command menu and starts again', () => {
    const onCommands = vi.fn();
    const onReset = vi.fn();
    render(<TopBar {...base} onCommands={onCommands} onReset={onReset} />);
    fireEvent.click(screen.getByRole('button', { name: 'Commands (Ctrl K)' }));
    expect(onCommands).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Start again' }));
    expect(onReset).toHaveBeenCalled();
  });
});

describe('StatusLine', () => {
  it('says nothing when idle', () => {
    const { container } = render(<StatusLine busy={null} notice={null} modeLabel="Meta" onDismiss={() => {}} />);
    expect(container.textContent).toBe('');
  });

  it('shows the real stage and puts elapsed time and streamed characters in a disclosure', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-28T12:00:00Z'));
    const busy = { label: 'Writing', stage: 'Drafting the project answer', started: Date.now() - 2300, chars: 1240, retry: null, tools: ['Counted the words: 207 of 300'] };
    const { container } = render(<StatusLine busy={busy} notice={null} modeLabel="Meta" onDismiss={() => {}} />);
    const details = container.querySelector('details');
    expect(details.open).toBe(false);
    act(() => { details.open = true; fireEvent(details, new Event('toggle')); });
    expect(screen.getByText('Drafting the project answer')).toBeTruthy();
    expect(screen.getByText('Elapsed: 2 s')).toBeTruthy();
    expect(screen.getByText('1,240 characters received')).toBeTruthy();
    expect(screen.getByRole('status').textContent).not.toMatch(/characters|Elapsed/);
    expect(screen.getByText('Counted the words: 207 of 300')).toBeTruthy();
  });

  it('says when the model service is busy and it is trying again', () => {
    const busy = { label: 'Writing', stage: 'Drafting', started: performance.now(), chars: 0, retry: { attempt: 2, of: 3, waitMs: 2000 }, tools: [] };
    render(<StatusLine busy={busy} notice={null} modeLabel="Meta" onDismiss={() => {}} />);
    expect(screen.getByText('Meta is busy; trying again, 2 of 3')).toBeTruthy();
  });

  it('shows an error with a way to try again, and an info notice that can be dismissed', () => {
    const retry = vi.fn();
    const onDismiss = vi.fn();
    const { rerender } = render(<StatusLine busy={null} notice={{ kind: 'error', message: 'The answer stopped. Nothing was changed. Try again.', retry }} modeLabel="Meta" onDismiss={onDismiss} />);
    expect(screen.getByRole('alert').textContent).toContain('The answer stopped. Nothing was changed. Try again.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalled();
    rerender(<StatusLine busy={null} notice={{ kind: 'info', message: 'This changed in another tab. Showing the latest.' }} modeLabel="Meta" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalled();
  });
});

describe('TopBar allowance fallback', () => {
  const fallbackReason = 'live-allowance-unavailable';
  it('visibly explains the server allowance fallback and that reset does not renew it', () => {
    render(<TopBar {...base} mode={{ ...base.mode, fallbackReason }} />);
    const notice = screen.getByRole('status');
    expect(notice.textContent).toContain('Live Meta allowance is unavailable for another journey in this visit.');
    expect(notice.textContent).toContain('hand-written outputs, without Meta calls');
    expect(notice.textContent).toContain('Starting again clears the application; it does not renew the allowance.');
    expect(notice.closest('[hidden], [aria-hidden="true"]')).toBeNull();
  });

  it('leaves ordinary fixture mode unchanged, without claiming the allowance was used', () => {
    render(<TopBar {...base} />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText('Fixture: hand-written outputs, not a model')).toBeTruthy();
  });

  it('only explains the recognised fixture fallback, not arbitrary server metadata or live mode', () => {
    const { rerender } = render(<TopBar {...base} mode={{ ...base.mode, fallbackReason: 'unrecognised-detail' }} />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByText('unrecognised-detail')).toBeNull();
    rerender(<TopBar {...base} mode={{ id: 'meta', isMeta: true, label: 'Meta Muse Wonder 1.0', fallbackReason }} />);
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('TopBar open-weight mode', () => {
  it('labels a Meta open-weight model as Meta, not as a stand-in', () => {
    render(<TopBar {...base} mode={{ id: 'compatible', label: 'Meta Muse Spark Open via Baseten', model: 'meta-models/muse-spark-open-1026', isMeta: true }} />);
    expect(screen.getByText('Meta Muse Spark Open via Baseten')).toBeTruthy();
    expect(screen.getByText(/Meta open weight/).className).toBe('mode meta');
  });

  it('shows the licence notice for Muse Spark Open only', () => {
    const notice = 'Built with Muse Spark Open';
    const { rerender } = render(<TopBar {...base} mode={{ id: 'compatible', label: 'Meta Muse Spark Open on Modal', model: 'meta-models/Muse-Spark-Open-816B-A42B', isMeta: true }} />);
    expect(screen.getByText(notice)).toBeTruthy();
    rerender(<TopBar {...base} mode={{ id: 'compatible', label: 'Meta Muse Glimmer', model: 'meta-models/Muse-Glimmer-30B', isMeta: true }} />);
    expect(screen.queryByText(notice)).toBeNull();
    rerender(<TopBar {...base} mode={{ id: 'meta', label: 'Meta Muse Wonder 1.0', model: 'muse-wonder-1.0', isMeta: true }} />);
    expect(screen.queryByText(notice)).toBeNull();
  });

  it('counts the steps on the activity pill, keeping the full summary as its name', () => {
    const receipts = [{ step: 'extract', model: 'muse-wonder-1.0', costUsd: 0.004, totalMs: 6200, toolCalls: [{}, {}] }, { step: 'draft', model: 'muse-wonder-1.0', costUsd: 0.004, totalMs: 6200, toolCalls: [] }];
    render(<TopBar {...base} mode={{ id: 'meta', label: 'Meta Muse Wonder 1.0', model: 'muse-wonder-1.0', isMeta: true }} receipts={receipts} />);
    const pill = screen.getByRole('button', { name: 'What Meta did: 2 steps, 2 tool calls, 12.4 s total model time, $0.0080' });
    expect(pill.querySelector('.receipt-short').textContent).toBe('Meta activity · 2 steps');
  });
});
