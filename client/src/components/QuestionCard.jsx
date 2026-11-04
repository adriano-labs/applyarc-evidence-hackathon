import { useState } from 'react';
import { appendWords, SpeakButton } from './SpeakButton.jsx';
import { ConflictQuestion } from './ConflictQuestion.jsx';
import { ClipAnswer } from './ClipAnswer.jsx';
import { RepeatedWords } from './RepeatedWords.jsx';
import { family, formatAudio } from '../lib/trail.js';
import './QuestionCard.css';

// After a spoken answer: which model heard it and for how long, so the words get checked first.
function transcribedLine(reply) {
  if (!reply) return null;
  const by = reply.model ? family(reply.model).name : 'Meta Voice Transcribe';
  const length = formatAudio(reply.durationMs);
  return `Transcribed by ${by}${length ? ` · ${length} of speech` : ''} · check the words before you answer`;
}

// language: her language, for the question's text and as the microphone's hint (none when unset);
// clip: a sample's bundled spoken answer, which goes to Muse Voice Transcribe like the microphone.
export function QuestionCard({ question, requirementText, onAnswer, onSkip, busy, sample, sampleName, voice, language, hint, clip, clipFrom }) {
  const [value, setValue] = useState('');
  const [spoken, setSpoken] = useState(null);

  const handleAnswer = () => {
    const trimmed = value.trim();
    if (trimmed.length === 0 || busy) {
      return;
    }
    onAnswer(trimmed);
  };

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      if (busy) {
        return;
      }
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        e.preventDefault();
        onAnswer(trimmed);
      }
    }
  };

  const handleUseSample = () => {
    if (sample != null) {
      setValue(sample);
    }
  };

  const trimmedValue = value.trim();
  const isAnswerDisabled = trimmedValue.length === 0 || busy;
  const isSourceConflict = question?.kind === 'source-conflict';

  return (
    <section className="question-card" aria-labelledby="question-title">
      <h2 id="question-title">One question</h2>
      {isSourceConflict ? (
        <ConflictQuestion question={question} />
      ) : (
        <>
          <p className="question-text" lang={question.english ? language : undefined}>{question.text}</p>
          {question.english ? <p className="question-english">In English: {question.english}</p> : null}
          {requirementText ? <p className="question-for">For: {requirementText}</p> : null}
          <p className="question-why">{question.why}</p>
        </>
      )}
      <label htmlFor="answer-box" className="visually-hidden">Your answer</label>
      <textarea
        id="answer-box"
        rows={4}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="In your own words…"
      />
      {spoken ? <p className="question-transcribed">{transcribedLine(spoken)}</p> : null}
      <RepeatedWords text={value} reply={spoken} disabled={busy} onChange={setValue} />
      <p className="question-help">Your words become a fact you confirm. Skipping leaves this part out of the drafts.</p>
      <div className="question-actions">
        {voice ? <SpeakButton language={hint} onText={(text, reply) => { setValue((before) => appendWords(before, text)); setSpoken(reply ?? {}); }} disabled={busy} /> : null}
        {clip && voice && !isSourceConflict ? <ClipAnswer src={clip} from={clipFrom} name={sampleName} hint={hint} disabled={busy} onText={(text, reply) => { setValue(text); setSpoken(reply); }} /> : null}
        {sample != null && question.kind !== 'source-conflict' ? (
          <button type="button" className="btn small link" onClick={handleUseSample}>
            Use {sampleName ? `${sampleName}’s` : 'the'} sample answer
          </button>
        ) : null}
        <button type="button" className="btn small" onClick={onSkip}>
          Skip: leave it out
        </button>
        <button type="button" className="btn primary" onClick={handleAnswer} disabled={isAnswerDisabled}>
          Answer
        </button>
      </div>
    </section>
  );
}
