// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../client/src/api.js', () => ({ getState: vi.fn(), act: vi.fn(), run: vi.fn(), reset: vi.fn() }));
import * as api from '../../client/src/api.js';
import { useWorkspace } from '../../client/src/useWorkspace.js';
import { GuidedBody } from '../../client/src/components/GuidedBody.jsx';
const state = (revision, working) => ({ workspace: { revision, applicant: { sources: [], facts: [] }, application: { questions: [] } }, view: { next: 'read' }, working });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); });

describe('resume the saved step after refresh', () => {
  it('shows real server work and follows its saved result without starting another model call', async () => {
    api.getState.mockResolvedValueOnce(state(1, true)).mockResolvedValue(state(2, false));
    const { result } = renderHook(() => useWorkspace());
    await waitFor(() => expect(result.current.busy).toBeTruthy());
    await waitFor(() => expect(result.current.data?.workspace.revision).toBe(2), { timeout: 5000 });
    expect(result.current.busy).toBeNull();
    expect(api.run).not.toHaveBeenCalled();
    const calls = api.getState.mock.calls.length;
    await new Promise((r) => setTimeout(r, 2200));
    expect(api.getState).toHaveBeenCalledTimes(calls);
  });
  it('stops background refresh when unmounted', async () => {
    api.getState.mockResolvedValue(state(1, true));
    const { result, unmount } = renderHook(() => useWorkspace());
    await waitFor(() => expect(result.current.busy).toBeTruthy());
    unmount();
    const calls = api.getState.mock.calls.length;
    await new Promise((r) => setTimeout(r, 2200));
    expect(api.getState).toHaveBeenCalledTimes(calls);
  });
  it('offers a real next action for an unread saved answer when the server is idle', () => {
    const onPrimary = vi.fn();
    render(<GuidedBody stepKey="question" workspace={state(1, false).workspace} view={{ next: 'read' }} busy={null} handlers={{ onPrimary }} />);
    fireEvent.click(screen.getByRole('button', { name: /read.*saved.*answer/i }));
    expect(onPrimary).toHaveBeenCalledWith(expect.objectContaining({ id: 'read' }));
  });
});
