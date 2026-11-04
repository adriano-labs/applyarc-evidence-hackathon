// @vitest-environment jsdom
// The downloaded trace, the file the trail offers to verify a run.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useActions } from '../../client/src/useActions.js';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('the downloaded trace', () => {
  it('keeps the loop’s recorded decisions apart from the costed steps, as the in-app totals do', () => {
    const blobs = [];
    vi.stubGlobal('Blob', class { constructor(parts) { blobs.push(parts.join('')); } });
    URL.createObjectURL = () => 'blob:trace';
    URL.revokeObjectURL = () => {};
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const receipts = [{ step: 'extract', flow: 'read', model: 'muse-wonder-1.0', costUsd: 0.01 }, { kind: 'stage', flow: 'read', label: 'Reading your words' }];
    useActions({}, {}).downloadTrace(receipts, { id: 'meta' }, null);
    const trace = JSON.parse(blobs[0]);
    expect(trace.receipts).toEqual([receipts[0]]);
    expect(trace.stages).toEqual([receipts[1]]);
    expect(trace.mode).toEqual({ id: 'meta' });
  });
});
