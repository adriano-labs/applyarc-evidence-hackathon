import { useId, useRef, useState } from 'react';
import { QuestionCard } from './QuestionCard.jsx';
import { ConflictQuestion } from './ConflictQuestion.jsx';
import { GlossFields, plainMeaning } from './GlossFields.jsx';
import { RepeatedWords } from './RepeatedWords.jsx';
import './SourceCorrectionCard.css';

// spoken: her note came from Voice Transcribe, so any words it repeated are offered for removal.
export function SourceCorrectionCard({ offer, question, busy, onResolve, onAnswer, onSkip, voice, spoken = false }) {
  const [text, setText] = useState(offer.text);
  // In another language the correction keeps an English meaning she checks; the model's actor tag
  // goes with it unasked, and shows on the fact afterwards.
  const [gloss, setGloss] = useState({ meaning: plainMeaning(offer.meaning), actor: offer.actor });
  const [explain, setExplain] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const id = useId();
  const locked = Boolean(busy) || saving;
  const isSourceConflict = question?.kind === 'source-conflict';
  async function save() {
    if (locked || inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setError('');
    try {
      const result = await onResolve({ questionId: offer.questionId, sourceId: offer.sourceId, factId: offer.factId, text, ...(offer.meaning ? { meaning: gloss.meaning?.trim(), actor: offer.actor } : {}) });
      if (!result) setError('Your correction is still here. Check the message above before trying again.');
    } catch { setError('Could not confirm the save. Check your saved work before trying again.'); }
    finally { inFlight.current = false; setSaving(false); }
  }
  if (explain) return <div className="source-explanation">
    <QuestionCard question={question} busy={locked} onAnswer={onAnswer} onSkip={onSkip} voice={voice} />
    <button type="button" className="btn link" disabled={locked} onClick={() => setExplain(false)}>Back to correction</button>
  </div>;
  return <section className="question-card source-correction" aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`}>Choose the right account</h2>
    {isSourceConflict ? (
      <ConflictQuestion question={question} />
    ) : (
      <>
        <p className="question-text">{question.text}</p>
        <p className="question-why">Your new notes differ from a confirmed fact. Check the full correction below.</p>
      </>
    )}
    {offer?.before != null ? <p className="source-earlier">Confirmed fact to replace: <q>{offer.before}</q></p> : null}
    <CorrectionFields {...{ id, text, setText, locked, saving, error, save, onSkip, spoken }} onExplain={() => setExplain(true)}
      gloss={offer.meaning ? <GlossFields id={`${id}-gloss`} gloss={gloss} onChange={setGloss} disabled={locked} askActor={false} /> : null} />
  </section>;
}

function CorrectionFields({ id, text, setText, locked, saving, error, save, onSkip, onExplain, gloss, spoken }) {
  const tooLong = text.trim().length > 280;
  return <>
    <label htmlFor={`${id}-text`}>Your correction</label>
    <textarea id={`${id}-text`} rows={3} value={text} disabled={locked} aria-invalid={tooLong || undefined}
      aria-describedby={`${id}-help`} onChange={(event) => setText(event.target.value)} />
    <RepeatedWords text={text} reply={spoken ? {} : null} disabled={locked} onChange={setText} />
    {gloss}
    <p id={`${id}-help`} className={`question-help${tooLong ? ' correction-error' : ''}`}>
      {tooLong ? 'Keep this fact within 280 characters, or choose Explain instead. All your text is kept here.'
        : 'This replaces the earlier fact. You will review any document changes before applying them.'}
    </p>
    {error && <p role="alert" className="correction-error">{error}</p>}
    <div className="question-actions">
      <button type="button" className="btn primary" disabled={locked || !text.trim() || tooLong} onClick={save}>
        {saving ? 'Saving correction…' : 'Use this correction'}
      </button>
      <button type="button" className="btn" disabled={locked} onClick={onSkip}>Keep the earlier account</button>
      <button type="button" className="btn link" disabled={locked} onClick={onExplain}>Explain instead</button>
    </div>
  </>;
}
