// A sample's bundled spoken answer (synthetic voice): one press sends it to Muse Voice Transcribe
// and the words fill the answer box, for checking before she answers.
import { useEffect } from 'react';
import { notAnswered, useClip } from './useClip.js';

// from: the sample the clip belongs to.
export function ClipAnswer({ src, from, name, hint, disabled, onText }) {
  const [heard, run] = useClip(src, { language: hint, sample: from });
  useEffect(() => {
    if (heard.status === 'done') onText(heard.reply.text, heard.reply);
  }, [heard]);
  const working = heard.status === 'working';
  return (
    <>
      <button type="button" className="btn small" disabled={disabled || working} onClick={run}>
        {working ? `Hearing ${name}’s answer…` : `Use ${name}’s spoken answer`}
      </button>
      <span className="clip-note">synthetic voice</span>
      {heard.status === 'error' ? <p role="alert" className="speak-status">{notAnswered(heard.message)} Type the answer, or use the sample answer.</p> : null}
    </>
  );
}
