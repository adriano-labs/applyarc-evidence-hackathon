// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ReceiptsDrawer } from '../../client/src/components/ReceiptsDrawer.jsx';
import { StatusLine } from '../../client/src/components/TopBar.jsx';

afterEach(cleanup);

const receipt = {
  step: 'draft', provider: 'meta', isMeta: true, model: 'muse-spark-1.3', effort: 'medium', turns: 2, attempts: 3, requestIds: ['r1', 'r2'],
  toolCalls: [{ name: 'word_count', ok: true, note: '212 of 300' }], usage: { input: 900, cached: 300, output: 200, reasoning: 50 },
  costUsd: 0.004, firstEventMs: 400, firstOutputMs: 1900, totalMs: 6200, unsettled: 1, injectedFaults: 1, rateLimit: null,
};

describe('J4: receipts a Meta engineer cannot disprove', () => {
  it('shows first event and first output apart, and what is not settled', () => {
    render(<ReceiptsDrawer receipts={[receipt]} modeLabel="Meta Muse Spark 1.3" open onToggle={() => {}} />);
    const body = document.getElementById('receipts-body').textContent;
    expect(body).toContain('first event 400 ms · first output 1.9 s · done 6.2 s');
    expect(body).toContain('includes 1 injected 429 (a demo fault, not the model service)');
    expect(screen.getByRole('button', { name: /What Meta did/ }).textContent).toContain('+ 1 not settled');
    expect(body).toContain('Attempts that may have run are counted at their worst case in the spend cap.');
  });

  it('labels an injected 429 as the demo’s, not the model service’s', () => {
    render(<StatusLine busy={{ name: 'draft', stage: 'Drafting the project answer', started: performance.now(), chars: 0, tools: [], retry: { attempt: 2, of: 3, waitMs: 2000, injected: true } }} notice={null} modeLabel="Meta Muse Spark 1.3" onDismiss={() => {}} />);
    expect(screen.getByRole('status').textContent).toContain('Injected for the demo: one 429 (Meta was not busy); trying again, 2 of 3');
  });
});
