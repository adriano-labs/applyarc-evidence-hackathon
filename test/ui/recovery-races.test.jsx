// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../client/src/api.js', () => ({ getState: vi.fn(), act: vi.fn(), run: vi.fn(), reset: vi.fn() }));
import * as api from '../../client/src/api.js';
import { useWorkspace } from '../../client/src/useWorkspace.js';
const state = (revision, working) => ({ workspace: { revision, applicant: { sources: [], facts: [] }, application: { questions: [] } }, view: { next: 'read' }, working });
const error = (code) => Object.assign(new Error(code), { code });
const flush = async () => { await act(async () => { await Promise.resolve(); }); };
const tick = async (ms) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
beforeEach(() => { vi.useFakeTimers(); vi.resetAllMocks(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('recovery never starts duplicate work or accepts a dead lifecycle', () => {
  it.each(['cut', 'network', 'fetch'])('reconciles a %s interruption with the saved result without rerunning the model', async (code) => {
    api.getState.mockResolvedValueOnce(state(1, false)).mockResolvedValueOnce(state(1, true)).mockResolvedValue(state(2, false));
    api.run.mockRejectedValueOnce(code === 'fetch' ? new TypeError('Failed to fetch') : error(code));
    const { result } = renderHook(() => useWorkspace());
    await flush();
    await act(async () => { await result.current.run('read', { sourceId: 's1' }, 'Reading'); });
    // Losing the browser stream does not prove that the server transaction failed.
    await tick(3000);
    expect(api.run).toHaveBeenCalledTimes(1);
    expect(api.getState.mock.calls.length).toBeGreaterThan(1);
    expect(result.current.data.workspace.revision).toBe(2);
    expect(result.current.busy).toBeNull();
  });

  it('keeps writes locked after a recovery poll fails, then unlocks only when retry proves the server idle', async () => {
    api.getState.mockResolvedValueOnce(state(1, true)).mockRejectedValueOnce(error('network')).mockResolvedValueOnce(state(1, true)).mockResolvedValue(state(2, false));
    api.act.mockResolvedValue(state(99, false));
    api.run.mockResolvedValue(state(99, false));
    const { result } = renderHook(() => useWorkspace());
    await flush();
    await tick(100);
    expect(result.current.notice?.retry).toBeTypeOf('function');
    const retry = result.current.notice.retry;
    // A failed status read leaves the prior transaction's outcome unknown.
    await act(async () => {
      await result.current.act('confirmFacts', { factIds: ['f1'] });
      await result.current.run('read', { sourceId: 's1' }, 'Reading');
    });
    expect.soft(api.act).not.toHaveBeenCalled();
    expect.soft(api.run).not.toHaveBeenCalled();
    await act(async () => { retry(); });
    await tick(3000);
    expect(result.current.data.workspace.revision).toBe(2);
    expect(result.current.busy).toBeNull();
    // Writes are available again once the saved result is reconciled.
    await act(async () => { await result.current.act('confirmFacts', { factIds: ['f1'] }); });
    expect(api.act.mock.calls.length).toBe(1);
  });

  it('does not start a recovery timer when the initial state reply arrives after unmount', async () => {
    let finishLoad;
    api.getState.mockImplementationOnce(() => new Promise((resolve) => { finishLoad = resolve; }));
    const { unmount } = renderHook(() => useWorkspace());
    expect(api.getState).toHaveBeenCalledTimes(1);
    unmount();
    await act(async () => { finishLoad(state(1, true)); });
    expect(vi.getTimerCount()).toBe(0);
    await tick(3000);
    expect(api.getState).toHaveBeenCalledTimes(1);
    expect(api.run).not.toHaveBeenCalled();
  });
});
