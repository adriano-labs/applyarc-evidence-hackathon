// @vitest-environment jsdom
// Where spoken notes appear: the one question's answer box and the notes of the
// applicant's own example, only when the server says spoken notes are on. The words
// Meta heard go into the box for the applicant to check; nothing is sent on its own.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../client/src/lib/recorder.js', () => ({ startRecording: vi.fn() }));
vi.mock('../../client/src/api.js', () => ({ transcribe: vi.fn() }));

const { startRecording } = await import('../../client/src/lib/recorder.js');
const { transcribe } = await import('../../client/src/api.js');
const { QuestionCard } = await import('../../client/src/components/QuestionCard.jsx');
const { OwnApplicationInput } = await import('../../client/src/components/OwnApplicationInput.jsx');
const { ReceiptsDrawer } = await import('../../client/src/components/ReceiptsDrawer.jsx');

beforeEach(() => {
  startRecording.mockResolvedValue({ stop: vi.fn().mockResolvedValue(new Uint8Array([1])) });
  transcribe.mockResolvedValue({ text: 'I rang eight local suppliers.', durationMs: 4000 });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const question = { id: 'q1', requirementId: 'contribution', text: 'What did you do yourself?', why: 'The form asks what you did yourself.' };
const card = (props) => render(<QuestionCard question={question} requirementText="Your own part" onAnswer={vi.fn()} onSkip={vi.fn()} busy={false} sample={null} {...props} />);
async function speak() {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Speak instead' })); });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Stop recording/ })); });
}

describe('spoken answers and notes', () => {
  it('offers no microphone when spoken notes are off', () => {
    card({ voice: false });
    expect(screen.queryByRole('button', { name: 'Speak instead' })).toBeNull();
  });

  it('adds the spoken words to the answer box for the applicant to check, without sending them', async () => {
    const onAnswer = vi.fn();
    card({ voice: true, onAnswer });
    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: 'I organised the day.' } });
    await speak();
    expect(screen.getByLabelText('Your answer').value).toBe('I organised the day. I rang eight local suppliers.');
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it('lets the applicant speak the notes of their own example', async () => {
    render(<OwnApplicationInput liveModel voice onStart={vi.fn()} />);
    fireEvent.click(screen.getByText('Try your own fictional example'));
    await speak();
    expect(screen.getByLabelText('Fictional CV or project notes').value).toBe('I rang eight local suppliers.');
  });

  it('lists the transcription in What Meta did', () => {
    const receipts = [{ step: 'transcribe', flow: 'voice', provider: 'meta', isMeta: true, model: 'muse-voice-transcribe-1.0', turns: 0, attempts: 1, requestIds: [], toolCalls: [], usage: { input: 0, cached: 0, output: 0, reasoning: 0 }, costUsd: 0.0002, audioMs: 4000, totalMs: 1800, at: '2026-10-29T18:00:00Z' }];
    const { container } = render(<ReceiptsDrawer receipts={receipts} modeLabel="Meta Muse Spark 1.3" onDownload={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /What Meta did/ }));
    expect(container.querySelector('.receipt').textContent).toContain('Turned your spoken words into text');
  });
});
