// @vitest-environment jsdom
// The judge's path after Ana's correction (live browser tests, 4 Nov): a clear next step once both documents are
// approved again, the covered count with the point that needs review, a visible Start again confirm, and a
// "still working" line during a long model step.
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { guidedStep } from '../../client/src/components/GuidedRun.jsx';
import { CoverageLine } from '../../client/src/components/CoverageLine.jsx';
import { TopBar } from '../../client/src/components/TopBar.jsx';
import { WorkingState } from '../../client/src/components/WorkingState.jsx';

afterEach(() => { cleanup(); vi.useRealTimers(); });

const docs = [{ id: 'answer', title: 'Supporting evidence' }, { id: 'letter', title: 'Cover letter' }];
const ws = (extra = {}) => ({ prepared: { loadedAt: '2026-11-04T00:00:00Z' }, applicant: { sources: [{ kind: 'notes', at: '2026-11-04T01:00:00Z' }], facts: [] },
  application: { form: { documents: docs }, lastRepair: { changed: 2 }, questions: [{ status: 'open', requirementId: 'rota' }], ...extra } });

describe('after the correction', () => {
  it('goes to the finish once both documents are approved again, even while a question about the reopened point waits', () => {
    const view = { next: 'question', approvals: { answer: 'approved', letter: 'approved' } };
    expect(guidedStep(view, ws(), null)).toEqual({ n: 5, key: 'finish' });
    expect(guidedStep({ ...view, approvals: { answer: 'approved' } }, ws(), null).key).toBe('change');
  });

  it('shows the covered count and the point that needs review', () => {
    render(<CoverageLine view={{ coverage: [{ covered: true }, { covered: false, needsReview: true }, { covered: true }] }} />);
    expect(screen.getByText('2 of 3 form requirements covered · 1 needs review: a fact it relied on changed')).toBeTruthy();
  });

  it('counts the form requirements apart from the optional cover-letter check, from the computed coverage', () => {
    const coverage = [
      ...Array.from({ length: 9 }, () => ({ docId: 'answer', covered: true })),
      { docId: 'answer', covered: false, needsReview: true },
      { docId: 'letter', covered: true },
    ];
    render(<CoverageLine view={{ coverage }} />);
    expect(screen.getByText('9 of 10 form requirements covered · 1 needs review: a fact it relied on changed · Cover letter check: 1 of 1 met')).toBeTruthy();
  });
});

describe('Start again', () => {
  it('says plainly that the second press clears everything', () => {
    const base = { company: 'C', role: 'R', mode: { id: 'fixture', label: 'Fixture', model: 'x', isMeta: false }, onCommands: vi.fn(), onReset: vi.fn(), onReceipts: vi.fn() };
    const { rerender } = render(<TopBar {...base} />);
    expect(screen.queryByRole('alert')).toBeNull();
    rerender(<TopBar {...base} resetArmed />);
    expect(screen.getByRole('alert').textContent).toBe('Press Start again once more to clear everything');
  });
});

describe('a long model step', () => {
  it('says it is still working after 8 seconds', () => {
    vi.useFakeTimers();
    render(<WorkingState busy={{ name: 'check', label: 'Checking what the form still needs', started: Date.now() }} />);
    expect(screen.queryByText(/Still working/)).toBeNull();
    act(() => { vi.advanceTimersByTime(8000); });
    expect(screen.getByText('Still working: a model step can take a while. You don’t need to do anything.')).toBeTruthy();
  });
});
