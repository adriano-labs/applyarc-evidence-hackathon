// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReceiptsDrawer } from '../../client/src/components/ReceiptsDrawer.jsx';

afterEach(cleanup);

const receipts = [
  { step: 'extract', flow: 'read', provider: 'meta', isMeta: true, model: 'muse-spark-1.3', effort: 'low', turns: 2, attempts: 2, requestIds: ['req-1', 'req-2'], toolCalls: [{ name: 'verify_quote', ok: true, note: 'verbatim' }, { name: 'form_requirements', ok: true, note: 'read' }], usage: { input: 3000, cached: 1200, output: 600, reasoning: 200 }, costUsd: 0.0049, firstEventMs: 640, totalMs: 4100, at: '2026-10-27T09:00:00Z' },
  { step: 'draft', flow: 'draft', provider: 'meta', isMeta: true, model: 'muse-spark-1.3', effort: 'medium', turns: 1, attempts: 3, requestIds: ['req-3'], toolCalls: [], usage: { input: 5000, cached: 0, output: 900, reasoning: 0 }, costUsd: null, firstEventMs: null, totalMs: 2100, error: 'cut', at: '2026-10-27T09:01:00Z' },
];
const base = { receipts, modeLabel: 'Meta Muse Spark 1.3', onDownload: vi.fn() };

describe('ReceiptsDrawer', () => {
  it('sums every model step in one quiet line when closed', () => {
    render(<ReceiptsDrawer {...base} />);
    const toggle = screen.getByRole('button', { name: /What Meta did/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.textContent).toContain('muse-spark-1.3 · 2 steps · 2 tool calls · 6.2 s · $0.0049 + 1 not settled');
  });

  it('opens into a timeline with each step’s receipt', () => {
    const { container } = render(<ReceiptsDrawer {...base} />);
    fireEvent.click(screen.getByRole('button', { name: /What Meta did/ }));
    const steps = container.querySelectorAll('.receipt');
    expect(steps).toHaveLength(2);
    expect(steps[0].textContent).toContain('Read your words');
    expect(steps[0].textContent).toContain('effort low');
    expect(steps[0].textContent).toContain('3,000 in (1,200 cached) · 600 out');
    expect(steps[0].textContent).toContain('first event 640 ms · done 4.1 s');
    expect(steps[0].textContent).toContain('verify_quote: verbatim');
    expect(steps[1].textContent).toContain('Stopped: the stream was cut. Kept charged in the spend cap.');
    expect(steps[1].textContent).toContain('2 retries');
  });

  it('offers the full trace as a download', () => {
    const onDownload = vi.fn();
    render(<ReceiptsDrawer {...base} onDownload={onDownload} />);
    fireEvent.click(screen.getByRole('button', { name: /What Meta did/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Download the trace (JSON)' }));
    expect(onDownload).toHaveBeenCalled();
  });

  it('calls the drawer by the mode when the model is not Meta', () => {
    render(<ReceiptsDrawer {...base} receipts={[]} modeLabel="Fixture" />);
    expect(screen.getByRole('button', { name: /What the model did/ }).textContent).toContain('No model calls yet');
  });
});
