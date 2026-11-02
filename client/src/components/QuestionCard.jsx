import { useState } from 'react';
import { appendWords, SpeakButton } from './SpeakButton.jsx';
import './QuestionCard.css';

export function QuestionCard({ question, requirementText, onAnswer, onSkip, busy, sample, sampleName, voice }) {
  const [value, setValue] = useState('');

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

  return (
    <section className="question-card" aria-labelledby="question-title">
      <h2 id="question-title">One question</h2>
      <p className="question-text">{question.text}</p>
      {requirementText ? <p className="question-for">For: {requirementText}</p> : null}
      <p className="question-why">{question.why}</p>
      <label htmlFor="answer-box" className="visually-hidden">Your answer</label>
      <textarea
        id="answer-box"
        rows={4}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="In your own words…"
      />
      <p className="question-help">Your words become a fact you confirm. Skipping leaves this part out of the drafts.</p>
      <div className="question-actions">
        {voice ? <SpeakButton onText={(text) => setValue((before) => appendWords(before, text))} disabled={busy} /> : null}
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
