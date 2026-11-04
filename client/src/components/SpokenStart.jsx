// A sample who speaks opens on her voice note (synthetic voice, fictional applicant). On the live
// model the clip goes to Muse Voice Transcribe the moment this opens, and her words come back for
// checking before Muse Wonder reads anything. With no live voice (the fixture, the open-weight
// edition) her written note stands in, and the screen says so. No sound plays unless pressed.
import { useState } from 'react';
import { pronouns } from '../flow.js';
import { languageName } from '../lib/language.js';
import { family, formatAudio } from '../lib/trail.js';
import { GuidedRun } from './GuidedRun.jsx';
import { RepeatedWords } from './RepeatedWords.jsx';
import { WorkingState } from './WorkingState.jsx';
import { clipHint, notAnswered, useClip } from './useClip.js';
import './SpokenStart.css';

export const heardLine = (reply, what) => {
  const length = formatAudio(reply?.durationMs);
  return `Transcribed by ${reply?.model ? family(reply.model).name : 'Muse Voice Transcribe'}${length ? ` · ${length} of speech` : ''} · ${what}`;
};

function Clip({ sample, onSeconds }) {
  return (
    <div className="spoken-clip">
      <audio controls preload="metadata" src={sample.clips.notes} aria-label={`${sample.name}’s voice note, synthetic voice`}
        onLoadedMetadata={(e) => onSeconds(Math.round(e.currentTarget.duration) || null)} />
      <p className="sample-note">{sample.name}’s voice note · {sample.voice.toLowerCase()}</p>
    </div>
  );
}

const WrittenLink = ({ p, onWritten }) => <button type="button" className="btn link small" onClick={onWritten}>Use {p.possessive} written note instead</button>;

// busy: her words are already on their way to be read, so a second press cannot start again.
function Words({ sample, p, text, setText, readOnly, reply, busy, onRead, onWritten }) {
  const language = languageName(sample.language);
  return (
    <div className="spoken-words">
      <label htmlFor="spoken-words">{reply ? `${p.Possessive} words, as Meta heard them` : `${sample.name}’s written note, in ${language}`}</label>
      <textarea id="spoken-words" rows={6} lang={sample.language} value={text} readOnly={readOnly} onChange={(e) => setText(e.target.value)} />
      {reply ? <p className="sample-note">{heardLine(reply, `fix any word it misheard; the app changes nothing unless you tap.`)}</p> : null}
      <RepeatedWords text={text} reply={reply} disabled={Boolean(busy)} onChange={setText} />
      <div className="guided-actions">
        <button type="button" className="btn primary big" disabled={!text.trim() || Boolean(busy)} onClick={() => onRead(reply ? text.trim() : undefined)}>Read {sample.name}’s words</button>
        {reply ? <WrittenLink p={p} onWritten={onWritten} /> : null}
      </div>
    </div>
  );
}

function Failed({ p, message, onRetry, onWritten }) {
  return (
    <div className="notice error" role="alert">
      <p>{notAnswered(message)} {p.Possessive} written note can be used instead; it is labelled as typed, not spoken.</p>
      <button type="button" className="btn small" onClick={onRetry}>Try again</button>
      <button type="button" className="btn small" onClick={onWritten}>Use {p.possessive} written note</button>
    </div>
  );
}

// The step's own words: what happens on this screen, and where her words come from without a live voice.
function copyFor(sample, p, live, openWeight) {
  const said = `${sample.name} says it in ${languageName(sample.language)}`;
  if (live) return { h1: said, why: `Press play to hear ${p.object}. Muse Voice Transcribe is writing down what ${p.subject} says; you check the words before anything else happens.` };
  return { h1: said, why: openWeight
    ? `Spoken notes run on Meta’s API only. On this open-weight edition ${p.possessive} written note is used instead.`
    : `With no live model, ${p.possessive} written note is used here (typed, not spoken). Press play to hear the voice note it stands in for.` };
}

export function SpokenStart({ sample, view, workspace, isMeta, live, openWeight, busy, onRead }) {
  const p = pronouns(sample.possessive);
  const [seconds, setSeconds] = useState(null);
  const [written, setWritten] = useState(!live);
  // Choosing the written note while the clip still loads stops it being sent at all.
  const [heard, retry] = useClip(live && !written ? sample.clips.notes : null, { auto: true, language: clipHint(sample), sample: sample.id });
  const [text, setText] = useState(null);
  const shown = written ? sample.notes : text ?? heard.reply?.text ?? '';
  const length = seconds ? `${seconds} s of ` : '';
  const useWritten = () => setWritten(true);
  return (
    <GuidedRun view={view} workspace={workspace} sampleName={sample.name} possessive={sample.possessive} isMeta={isMeta} busy={busy} sample={sample} copy={copyFor(sample, p, live, openWeight)}>
      <div className="spoken-start">
        <Clip sample={sample} onSeconds={setSeconds} />
        {!written && heard.status === 'working' ? (
          <>
            <WorkingState busy={{ name: 'voice', label: `Muse Voice Transcribe · api.meta.ai · turning ${length}${languageName(sample.language)} into text`, started: heard.started }} />
            <WrittenLink p={p} onWritten={useWritten} />
          </>
        ) : null}
        {!written && heard.status === 'error' ? <Failed p={p} message={heard.message} onRetry={retry} onWritten={useWritten} /> : null}
        {written || heard.status === 'done' ? (
          <Words sample={sample} p={p} text={shown} setText={setText} readOnly={written} reply={written ? null : heard.reply} busy={busy} onRead={onRead} onWritten={useWritten} />
        ) : null}
      </div>
    </GuidedRun>
  );
}
