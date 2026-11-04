// A sample's bundled clip (synthetic voice, fictional applicant), sent to Muse Voice Transcribe as a
// recording from the microphone is: at once when `auto`, otherwise when run() is called. Nothing
// plays; the words come back for the applicant to check. A screen that has gone sends nothing.
import { useEffect, useState } from 'react';
import { transcribe } from '../api.js';

// sample: the sample the clip belongs to, so the server adds its keywords.
export function useClip(src, { auto = false, language, sample } = {}) {
  const [heard, setHeard] = useState({ status: auto && src ? 'working' : 'idle' });
  const [attempt, setAttempt] = useState(auto ? 1 : 0);
  useEffect(() => {
    if (!attempt || !src) return undefined;
    let alive = true;
    setHeard({ status: 'working', started: Date.now() });
    fetch(src)
      .then((r) => { if (!r.ok) throw new Error('the voice clip could not be loaded'); return r.arrayBuffer(); })
      .then((bytes) => { if (!alive) throw new Error('the screen moved on'); return transcribe(new Uint8Array(bytes), language, sample); })
      .then((reply) => alive && setHeard({ status: 'done', reply }), (error) => alive && setHeard({ status: 'error', message: error?.message || 'no reply came back' }));
    return () => { alive = false; };
  }, [src, language, sample, attempt]);
  return [heard, () => setAttempt((n) => n + 1)];
}

// The hint the bundled clips send: none, unless the live runs showed it helped (sample.voiceHint).
export const clipHint = (sample) => (sample?.voiceHint ? sample.language : undefined);

// A failed call in one sentence: the server's own sentences end with a full stop already.
export const notAnswered = (message) => `Muse Voice Transcribe did not answer: ${String(message ?? '').trim().replace(/\.$/, '')}.`;
