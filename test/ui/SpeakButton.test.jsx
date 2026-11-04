// @vitest-environment jsdom
// Spoken notes: press to record, press again to stop; Meta Voice Transcribe turns
// the recording into text the applicant checks before sending. The microphone and
// the server are doubles here; the recorder and the API are their own modules.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const stop = vi.fn();
vi.mock('../../client/src/lib/recorder.js', () => ({ startRecording: vi.fn() }));
vi.mock('../../client/src/api.js', () => ({ transcribe: vi.fn() }));

const { startRecording } = await import('../../client/src/lib/recorder.js');
const { transcribe } = await import('../../client/src/api.js');
const { SpeakButton } = await import('../../client/src/components/SpeakButton.jsx');

const wav = new Uint8Array([82, 73, 70, 70]);
beforeEach(() => {
  stop.mockResolvedValue(wav);
  startRecording.mockResolvedValue({ stop });
  transcribe.mockResolvedValue({ text: 'I rang eight local suppliers.', durationMs: 4000 });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('SpeakButton', () => {
  it('records, stops, and hands back the words Meta heard', async () => {
    const onText = vi.fn();
    render(<SpeakButton onText={onText} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Speak instead' })); });
    expect(startRecording).toHaveBeenCalledTimes(1);
    const stopButton = screen.getByRole('button', { name: /Stop recording/ });
    expect(stopButton.getAttribute('aria-pressed')).toBe('true');
    await act(async () => { fireEvent.click(stopButton); });
    expect(transcribe).toHaveBeenCalledWith(wav);
    expect(onText).toHaveBeenCalledWith('I rang eight local suppliers.', { text: 'I rang eight local suppliers.', durationMs: 4000 });
    expect(screen.getByRole('button', { name: 'Speak instead' })).toBeTruthy();
  });

  it('says plainly when Meta could not turn the recording into text, and lets the applicant try again', async () => {
    transcribe.mockRejectedValue(Object.assign(new Error('Meta Voice Transcribe is busy. Try again in a minute, or type your notes.'), { code: 'busy' }));
    const onText = vi.fn();
    render(<SpeakButton onText={onText} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Speak instead' })); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Stop recording/ })); });
    expect(onText).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toContain('Meta Voice Transcribe is busy. Try again in a minute, or type your notes.');
    expect(screen.getByRole('button', { name: 'Speak instead' })).toBeTruthy();
  });

  it('asks for the microphone when the browser blocks it', async () => {
    startRecording.mockRejectedValue(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));
    render(<SpeakButton onText={vi.fn()} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Speak instead' })); });
    expect(screen.getByRole('status').textContent).toContain('Allow the microphone for this page, or type instead.');
    expect(transcribe).not.toHaveBeenCalled();
  });
});
