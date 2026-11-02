// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChangeQueue } from '../../client/src/components/ChangeQueue.jsx';
import { TopBar } from '../../client/src/components/TopBar.jsx';

afterEach(cleanup);

describe('G1', () => {
  it('lets the applicant jump from a change to its sentence', () => {
    const onShow = vi.fn();
    render(<ChangeQueue repair={{ factId: 'f', status: 'review', items: [{ id: 'c1', docId: 'letter', segmentId: 'letter-4', before: 'a b', after: 'a c', status: 'proposed', decision: null }] }} fact={{ id: 'f', statement: 'x', history: [] }} number={1} docTitles={{ answer: 'Project answer', letter: 'Cover letter' }} busy={false} onDecide={vi.fn()} onApply={vi.fn()} onShow={onShow} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show in the cover letter' }));
    expect(onShow).toHaveBeenCalledWith('letter', 'letter-4');
  });
});

describe('G2', () => {
  it('shows what the model did in the top bar when the model is Meta', () => {
    const receipts = [{ step: 'draft', model: 'muse-spark-1.3', costUsd: 0.004, totalMs: 6200, toolCalls: [{}, {}] }];
    render(<TopBar company="C" role="R" mode={{ id: 'meta', label: 'Meta Muse Spark 1.3', model: 'muse-spark-1.3', isMeta: true }} budget={null} receipts={receipts} onCommands={vi.fn()} onReset={vi.fn()} onReceipts={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'What Meta did: 1 step, 2 tool calls, 6.2 s, $0.0040' })).toBeTruthy();
  });
});
