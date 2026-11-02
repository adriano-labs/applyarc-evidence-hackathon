import { afterEach, describe, expect, it, vi } from 'vitest';
import { useActions } from '../client/src/useActions.js';

afterEach(() => vi.unstubAllGlobals());

describe('copyText', () => {
  it('reports copied only after the clipboard write succeeds', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const setNotice = vi.fn();
    const result = await useActions({ setNotice }, {}).copyText('My confirmed answer.');
    expect(writeText).toHaveBeenCalledWith('My confirmed answer.');
    expect(result).toBe(true);
    expect(setNotice).toHaveBeenCalledWith({ kind: 'info', message: 'Copied. Paste it into the employer’s form.' });
  });

  it.each(['unavailable', 'rejected'])('gives a manual-copy instruction when clipboard is %s', async (failure) => {
    const clipboard = failure === 'rejected' ? { writeText: vi.fn().mockRejectedValue(new Error('denied')) } : undefined;
    vi.stubGlobal('navigator', { clipboard });
    const setNotice = vi.fn();
    const result = await useActions({ setNotice }, {}).copyText('My confirmed answer.');
    expect(result).toBe(false);
    expect(setNotice).toHaveBeenCalledOnce();
    expect(setNotice).toHaveBeenCalledWith({ kind: 'error', message: 'Could not copy automatically. Select the answer text and copy it manually.' });
  });
});
