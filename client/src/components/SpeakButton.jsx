import { useEffect, useRef, useState } from 'react';
import { Mic } from 'lucide-react';
import { startRecording } from '../lib/recorder.js';
import { transcribe } from '../api.js';
import './SpeakButton.css';

const LIMIT_MS = 3 * 60 * 1000;
const clock = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

// Spoken words join what is already in the box, for the applicant to check.
export const appendWords = (before, words) => (before.trim() ? `${before.trim()} ${words}` : words);

// Press to record, press again to stop: Meta Voice Transcribe turns it into text.
// `onText(text, reply)`: the words, and the server's reply (its model and the audio length).
export function SpeakButton({ onText, disabled, language }) {
  const [state, setState] = useState('idle');
  const [elapsed, setElapsed] = useState(0);
  const [status, setStatus] = useState('');
  const recording = useRef(null);
  const timer = useRef(null);

  useEffect(() => () => {
    clearInterval(timer.current);
    recording.current?.stop().catch(() => {}); // free the microphone if the page moves on
  }, []);

  async function stop() {
    clearInterval(timer.current);
    const current = recording.current;
    recording.current = null;
    if (!current) return;
    setState('working');
    try {
      const reply = await transcribe(await current.stop(), ...(language ? [language] : []));
      onText(reply.text, reply);
    } catch (error) {
      setStatus(error?.message || 'Something went wrong. Try again, or type instead.');
    }
    setState('idle');
  }

  async function start() {
    setStatus('');
    try {
      recording.current = await startRecording();
    } catch (error) {
      const blocked = ['NotAllowedError', 'NotFoundError'].includes(error?.name);
      setStatus(blocked ? 'Allow the microphone for this page, or type instead.' : error?.message || 'Something went wrong.');
      return;
    }
    const started = Date.now();
    setElapsed(0);
    setState('recording');
    timer.current = setInterval(() => {
      const ms = Date.now() - started;
      setElapsed(ms);
      if (ms >= LIMIT_MS) stop();
    }, 250);
  }

  const recordingNow = state === 'recording';
  return (
    <>
      <button type="button" className="speak-btn" aria-pressed={recordingNow} disabled={disabled || state === 'working'} onClick={recordingNow ? stop : start}>
        {state === 'idle' ? <><Mic size={14} aria-hidden="true" /><span>Speak instead</span></> : null}
        {recordingNow ? `Stop recording · ${clock(elapsed)}` : null}
        {state === 'working' ? 'Turning your words into text…' : null}
      </button>
      <p role="status" aria-live="polite" className="speak-status">{status}</p>
    </>
  );
}
