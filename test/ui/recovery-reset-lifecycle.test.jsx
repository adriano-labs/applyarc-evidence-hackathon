// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../client/src/api.js', () => ({ getState: vi.fn(), act: vi.fn(), run: vi.fn(), reset: vi.fn() }));
import * as api from '../../client/src/api.js';
import { useWorkspace } from '../../client/src/useWorkspace.js';
const state = (revision, working = false) => ({ workspace: { revision, applicant: { sources: [], facts: [] }, application: { questions: [] } }, view: { next: 'read' }, working });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const flush = async () => { await act(async () => { await Promise.resolve(); }); };
const tick = async (ms) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
beforeEach(() => { vi.useFakeTimers(); vi.resetAllMocks(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('recovery epoch boundaries', () => {
  it('lets the reset workspace run even if the old browser stream is delayed; that old completion cannot clear the new lock', async () => {
    const old = deferred(), fresh = deferred();
    api.getState.mockResolvedValue(state(1));
    api.run.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    api.reset.mockResolvedValue(state(0));
    const { result } = renderHook(() => useWorkspace());
    await flush();
    let oldRun, freshRun;
    act(() => { oldRun = result.current.run('read', { sourceId: 'old' }); });
    await act(async () => { await result.current.reset(); });
    act(() => { freshRun = result.current.run('read', { sourceId: 'fresh' }); });
    expect(api.run).toHaveBeenCalledTimes(2);
    await act(async () => { old.resolve(state(99)); await oldRun; });
    expect(result.current.data.workspace.revision).toBe(0);
    expect(result.current.busy?.name).toBe('read');
    await act(async () => { await result.current.run('read', { sourceId: 'duplicate' }); });
    expect(api.run).toHaveBeenCalledTimes(2);
    await act(async () => { fresh.resolve(state(1)); await freshRun; });
    expect(result.current.data.workspace.revision).toBe(1);
    expect(result.current.busy).toBeNull();
  });

  it('lets the reset workspace save; old action completion cannot clear the fresh pending state or action lock', async () => {
    const old = deferred(), fresh = deferred();
    api.getState.mockResolvedValue(state(1));
    api.act.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    api.reset.mockResolvedValue(state(0));
    const { result } = renderHook(() => useWorkspace());
    await flush();
    let oldAct, freshAct;
    act(() => { oldAct = result.current.act('notes', { text: 'old notes' }); });
    await act(async () => { await result.current.reset(); });
    expect(result.current.pending).toBe(false);
    act(() => { freshAct = result.current.act('notes', { text: 'fresh notes' }); });
    expect(api.act).toHaveBeenCalledTimes(2);
    expect(result.current.pending).toBe(true);
    await act(async () => { old.resolve(state(99)); await oldAct; });
    expect(result.current.data.workspace.revision).toBe(0);
    expect(result.current.pending).toBe(true);
    await act(async () => { await result.current.act('notes', { text: 'duplicate notes' }); });
    expect(api.act).toHaveBeenCalledTimes(2);
    await act(async () => { fresh.resolve(state(1)); await freshAct; });
    expect(result.current.pending).toBe(false);
    expect(result.current.data.workspace.revision).toBe(1);
  });

  it('ignores the first StrictMode load after the current lifecycle has loaded', async () => {
    const old = deferred();
    api.getState.mockReturnValueOnce(old.promise).mockResolvedValue(state(2));
    const wrapper = ({ children }) => <StrictMode>{children}</StrictMode>;
    const { result } = renderHook(() => useWorkspace(), { wrapper, reactStrictMode: true });
    await flush();
    expect(api.getState).toHaveBeenCalledTimes(2);
    expect(result.current.data.workspace.revision).toBe(2);
    await act(async () => { old.resolve(state(1, true)); });
    expect(result.current.data.workspace.revision).toBe(2);
    expect(result.current.busy).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps a cut-stream outcome locked if the very first status read fails, and retries status only', async () => {
    api.getState.mockResolvedValueOnce(state(1)).mockRejectedValueOnce(new TypeError('offline')).mockResolvedValue(state(2));
    api.run.mockRejectedValueOnce(Object.assign(new Error('cut'), { code: 'cut' }));
    const { result } = renderHook(() => useWorkspace());
    await flush();
    await act(async () => { await result.current.run('read'); });
    await tick(100);
    expect(result.current.notice).toMatchObject({ persistent: true, kind: 'error' });
    expect(result.current.notice.retry).toBeTypeOf('function');
    await act(async () => { await result.current.run('read'); });
    expect(api.run).toHaveBeenCalledTimes(1);
    const retry = result.current.notice.retry;
    act(() => { retry(); });
    await tick(100);
    expect(result.current.data.workspace.revision).toBe(2);
    expect(result.current.busy).toBeNull();
    expect(api.run).toHaveBeenCalledTimes(1);
  });
});
