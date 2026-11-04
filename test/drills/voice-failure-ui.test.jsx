// @vitest-environment jsdom
// Failure drill on screen: Meta's voice service is busy. Ana's spoken start says so in one sentence,
// offers Try again (which sends her clip once more) and her written note; the microphone button says
// why it failed and can be pressed again.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../client/src/lib/recorder.js', () => ({ startRecording: vi.fn() }));
vi.mock('../../client/src/api.js', () => ({ transcribe: vi.fn() }));

const { startRecording } = await import('../../client/src/lib/recorder.js');
const { transcribe } = await import('../../client/src/api.js');
const { SpeakButton } = await import('../../client/src/components/SpeakButton.jsx');
const { SpokenStart } = await import('../../client/src/components/SpokenStart.jsx');

const BUSY = 'Meta Voice Transcribe is busy. Try again in a minute, or type your notes.';
const busy = () => Object.assign(new Error(BUSY), { code: 'busy' });
const ana = { id: 'ana', name: 'Ana', possessive: 'her', language: 'pt-PT', voiceHint: true, notes: 'Chamo-me Ana. Eu trabalho há três anos num lar em Leeds.', clips: { notes: '/samples/n.wav' }, voice: 'Synthetic voice, fictional applicant' };

afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

describe('a busy voice service on screen', () => {
  it('lets Ana’s spoken start try again, or use her written note', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([82, 73, 70, 70]), { status: 200 })));
    transcribe.mockRejectedValueOnce(busy()).mockResolvedValueOnce({ text: 'Chamome Ana. Eu trabalho num lar em Leeds.', durationMs: 58800, model: 'muse-voice-transcribe-1.0' });
    render(<SpokenStart sample={ana} view={{}} workspace={{ applicant: { sources: [], facts: [] }, application: { form: {} } }} isMeta live onRead={vi.fn()} />);
    const alert = await screen.findByRole('alert');
    expect(alert.querySelector('p').textContent).toBe(`Muse Voice Transcribe did not answer: ${BUSY} Her written note can be used instead; it is labelled as typed, not spoken.`);
    expect(screen.getByRole('button', { name: 'Use her written note' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect((await screen.findByLabelText('Her words, as Meta heard them')).value).toBe('Chamome Ana. Eu trabalho num lar em Leeds.');
    expect(transcribe).toHaveBeenCalledTimes(2);
    expect(transcribe.mock.calls.map((c) => c.slice(1))).toEqual([['pt-PT', 'ana'], ['pt-PT', 'ana']]);
  });

  it('says why the microphone’s words did not come back, and the button can be pressed again', async () => {
    startRecording.mockResolvedValue({ stop: vi.fn().mockResolvedValue(new Uint8Array([1])) });
    transcribe.mockRejectedValue(busy());
    const onText = vi.fn();
    render(<SpeakButton onText={onText} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Speak instead' })); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Stop recording/ })); });
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe(BUSY));
    expect(screen.getByRole('button', { name: 'Speak instead' }).disabled).toBe(false);
    expect(onText).not.toHaveBeenCalled();
  });
});
