// @vitest-environment jsdom
// Four small bugs from the built-in browser walk-through (27 Oct).
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../client/src/api.js', () => ({
  getState: vi.fn(async () => ({ workspace: { revision: 1 } })),
  getSample: vi.fn(async () => null),
  getReceipts: vi.fn(async () => ({ receipts: [] })),
  getForms: vi.fn(async () => ({ forms: [] })),
  act: vi.fn(),
  run: vi.fn(),
  reset: vi.fn(),
}));
const api = await import('../../client/src/api.js');
const { useAppState } = await import('../../client/src/useAppState.js');
const { useWorkspace } = await import('../../client/src/useWorkspace.js');
const { FactsReview } = await import('../../client/src/components/FactsReview.jsx');

afterEach(() => { cleanup(); vi.useRealTimers(); });

const RESET = 'Press Start again once more to clear this application. Your notes and facts will be removed.';
const fakeWs = () => ({ data: null, setNotice: vi.fn(), reset: vi.fn(async () => ({})) });

describe('J7: Start again', () => {
  it('takes its "press once more" notice away when the ten seconds run out', async () => {
    vi.useFakeTimers();
    const ws = fakeWs();
    const { result } = renderHook(() => useAppState(ws));
    act(() => result.current.handleReset());
    expect(ws.setNotice).toHaveBeenLastCalledWith({ kind: 'info', message: RESET });
    act(() => { vi.advanceTimersByTime(9000); });
    expect(ws.setNotice).toHaveBeenLastCalledWith({ kind: 'info', message: RESET });
    act(() => { vi.advanceTimersByTime(1000); });
    const clear = ws.setNotice.mock.calls.at(-1)[0];
    expect(typeof clear).toBe('function');
    expect(clear({ kind: 'info', message: RESET })).toBeNull();
    const other = { kind: 'error', message: 'Something else.' };
    expect(clear(other)).toBe(other);
    expect(ws.reset).not.toHaveBeenCalled();
  });

  it('clears the notice once the second press has reset the workspace', async () => {
    const ws = fakeWs();
    const { result } = renderHook(() => useAppState(ws));
    act(() => result.current.handleReset());
    await act(async () => { result.current.handleReset(); });
    expect(ws.reset).toHaveBeenCalledTimes(1);
    expect(ws.setNotice).toHaveBeenLastCalledWith(null);
  });
});

describe('J7: confirming facts', () => {
  const facts = [
    { id: 'f1', statement: 'Built a GPU runner.', quote: 'We built a GPU runner', sourceId: 's1', requirementIds: [] },
    { id: 'f2', statement: 'Used Redis.', quote: 'Redis for the queue', sourceId: 's1', requirementIds: [] },
  ];

  it('keeps Enter working after a decision made with a click', () => {
    const onDecide = vi.fn();
    const { rerender, container } = render(<FactsReview facts={facts} total={2} onDecide={onDecide} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Yes, confirm' })[0]);
    expect(onDecide).toHaveBeenCalledWith('f1', 'confirm');
    rerender(<FactsReview facts={facts.slice(1)} total={2} onDecide={onDecide} />);
    expect(document.activeElement).toBe(container.querySelector('.facts-review'));
  });
});

describe('J7: a second press while the first is still saving', () => {
  it('is ignored instead of coming back as "changed in another tab"', async () => {
    let finish;
    api.act.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const { result } = renderHook(() => useWorkspace());
    await act(async () => {});
    let first;
    let second;
    act(() => { first = result.current.act('decideFact', { factId: 'f1', decision: 'confirm' }); });
    expect(result.current.pending).toBe(true);
    act(() => { second = result.current.act('decideFact', { factId: 'f1', decision: 'confirm' }); });
    expect(await second).toBeNull();
    await act(async () => { finish({ workspace: { revision: 2 } }); await first; });
    expect(api.act).toHaveBeenCalledTimes(1);
    expect(result.current.pending).toBe(false);
  });

  it('says honestly what a stale write means', async () => {
    api.act.mockRejectedValueOnce(Object.assign(new Error('stale'), { code: 'stale' }));
    const { result } = renderHook(() => useWorkspace());
    await act(async () => {});
    await act(async () => { await result.current.act('decideFact', { factId: 'f1', decision: 'confirm' }); });
    expect(result.current.notice).toEqual({ kind: 'info', message: 'This was already changed, in another tab or by a second click. Showing the latest.' });
  });
});
