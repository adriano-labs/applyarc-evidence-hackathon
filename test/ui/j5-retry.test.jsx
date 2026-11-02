// @vitest-environment jsdom
// Retry known server failures. Lost connections reconcile saved state instead
// (covered by recovery-races), because the original write may still finish.
import { act as flush, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../client/src/api.js', () => ({
  getState: vi.fn(async () => ({ workspace: { revision: 1 } })),
  act: vi.fn(),
  run: vi.fn(),
  reset: vi.fn(),
}));
const api = await import('../../client/src/api.js');
const { useWorkspace } = await import('../../client/src/useWorkspace.js');
const failWith = (code, message) => Object.assign(new Error(message), { code });

describe('J5 retry', () => {
  it('offers no Try again when the server refused the request itself', async () => {
    api.act.mockRejectedValueOnce(failWith('invalid', 'That fact has already been decided.'));
    const { result } = renderHook(() => useWorkspace());
    await waitFor(() => expect(result.current.data).toBeTruthy());
    await flush(() => result.current.act('decideFact', { factId: 'f1', decision: 'confirm' }));
    expect(result.current.notice).toEqual({ kind: 'error', message: 'That fact has already been decided.' });
  });

  it('offers Try again after a known retryable server failure', async () => {
    const { result } = renderHook(() => useWorkspace());
    await waitFor(() => expect(result.current.data).toBeTruthy());
    for (const code of ['busy', 'timeout', 'invalid-output', 'invalid-draft', 'failed', 'incomplete', 'internal']) {
      api.run.mockRejectedValueOnce(failWith(code, 'Try again.'));
      await flush(() => result.current.run('draft'));
      expect(typeof result.current.notice.retry, code).toBe('function');
    }
  });
});
