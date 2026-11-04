// The key moment for a sample who speaks: one press sends her bundled spoken correction (synthetic
// voice) to Muse Voice Transcribe, she checks the words, and adds them as a note for the live model
// to read against her confirmed facts. Never on opening: a look back and return would send the clip
// again, paid and as a second Voice row. The written correction stays one link away.
import { useEffect, useState } from 'react';
import { pronouns } from '../flow.js';
import { heardLine } from './SpokenStart.jsx';
import { RepeatedWords } from './RepeatedWords.jsx';
import { clipHint, notAnswered, useClip } from './useClip.js';

// fallback: the note's written words (a prepared key moment's), offered if the voice call fails.
export function SpokenNote({ sample, locked, onAddNotes, onTyped, fallback = '' }) {
  const [heard, run] = useClip(sample.clips.correction, { language: clipHint(sample), sample: sample.id });
  const [text, setText] = useState('');
  useEffect(() => {
    if (heard.status === 'done') setText(heard.reply.text);
    else if (heard.status === 'error' && fallback) setText((now) => now || fallback);
  }, [heard]);
  const working = heard.status === 'working';
  // One main button at a time: hear her correction first, then add it.
  const ready = Boolean(text.trim());
  return (
    <div className="guided-note">
      <label htmlFor="spoken-note">{sample.name}’s correction</label>
      <div className="spoken-clip">
        <audio controls preload="metadata" src={sample.clips.correction} aria-label={`${sample.name}’s spoken correction, synthetic voice`} />
        <p className="sample-note">synthetic voice</p>
      </div>
      {working ? <p className="sample-note" role="status">Muse Voice Transcribe is writing down what {pronouns(sample.possessive).subject} says…</p> : null}
      {heard.status === 'error' ? <p role="alert" className="speak-status">{notAnswered(heard.message)} <button type="button" className="btn link small" onClick={run}>Try again</button></p> : null}
      <textarea id="spoken-note" rows={3} value={text} lang={sample.language} disabled={locked} onChange={(e) => setText(e.target.value)} />
      {heard.status === 'done' ? <p className="sample-note">{heardLine(heard.reply, 'check the words before you add them')}</p> : null}
      <RepeatedWords text={text} reply={heard.status === 'done' ? heard.reply : null} disabled={locked} onChange={setText} />
      <div className="guided-actions">
        <button type="button" className={ready ? 'btn' : 'btn primary'} disabled={locked || working} onClick={run}>
          {working ? `Hearing ${sample.name}’s correction…` : `Use ${sample.name}’s spoken correction`}
        </button>
        {ready ? (
          <button type="button" className="btn primary" disabled={locked} onClick={() => onAddNotes?.(text.trim(), { spoken: heard.status === 'done' })}>
            Add {sample.name}’s note
          </button>
        ) : null}
        <button type="button" className="btn link small" onClick={onTyped}>Show the written correction</button>
      </div>
    </div>
  );
}
