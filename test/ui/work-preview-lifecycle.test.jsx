// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as api from '../../client/src/api.js';
import { useWorkspace } from '../../client/src/useWorkspace.js';
vi.mock('../../client/src/api.js', () => ({ getState: vi.fn(), run: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe('checked draft lifecycle', () => {
  it('ignores a duplicate run until a disconnected stream is reconciled with saved state', async () => {
    api.getState.mockResolvedValue({ workspace: { revision: 1 } });
    let reject;
    api.run.mockImplementation(() => new Promise((resolve, fail) => { reject = fail; }));
    const { result } = renderHook(() => useWorkspace());
    await waitFor(() => expect(result.current.data).toBeTruthy());
    let first;
    act(() => { first = result.current.run('draft'); });
    let duplicate;
    act(() => { duplicate = result.current.run('draft'); });
    expect(api.run).toHaveBeenCalledTimes(1);
    await expect(duplicate).resolves.toBeNull();
    await act(async () => {
      reject(Object.assign(new Error('Disconnected'), { code: 'network' }));
      await first;
    });
    // A broken stream does not prove that the server failed. Stay locked until
    // the status read establishes that it is idle; do not rerun automatically.
    await act(async () => { await result.current.run('draft'); });
    expect(api.run).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.busy).toBeNull());
    expect(api.getState).toHaveBeenCalledTimes(2);
    api.run.mockResolvedValue({ workspace: { revision: 2 } });
    await act(async () => { await result.current.run('draft'); });
    expect(api.run).toHaveBeenCalledTimes(2);
    expect(result.current.data.workspace.revision).toBe(2);
  });

  it.each(['success', 'failure'])('keeps saved text during preview and clears preview on %s', async (outcome) => {
    const saved = { workspace: { revision: 1, application: { documents: { answer: { text: 'Saved original' } } } } };
    api.getState.mockResolvedValue(saved);
    let emit, finish, fail;
    api.run.mockImplementation((name, input, onEvent) => {
      emit = onEvent;
      return new Promise((resolve, reject) => { finish = resolve; fail = reject; });
    });
    const { result } = renderHook(() => useWorkspace());
    await waitFor(() => expect(result.current.data).toEqual(saved));
    let running;
    act(() => { running = result.current.run('draft'); });
    act(() => { emit({ type: 'document-ready', docId: 'answer', title: 'Project answer', segments: [{ text: 'Checked new text.' }] }); });
    expect(result.current.busy.documentPreviews.answer.segments[0].text).toBe('Checked new text.');
    expect(result.current.data).toEqual(saved);
    await act(async () => {
      if (outcome === 'failure') fail(Object.assign(new Error('Connection lost'), { code: 'network' }));
      else finish({ workspace: { ...saved.workspace, revision: 2 } });
      await running;
    });
    if (outcome === 'failure') {
      expect(result.current.busy.name).toBe('recover');
      expect(result.current.busy.documentPreviews).toEqual({});
      expect(result.current.data).toEqual(saved);
      await waitFor(() => expect(result.current.busy).toBeNull());
      expect(result.current.data).toEqual(saved);
      expect(result.current.notice).toBeNull();
      expect(api.run).toHaveBeenCalledTimes(1);
    }
    expect(result.current.busy).toBeNull();
  });
});
