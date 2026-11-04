import { useState } from 'react';
import { appendWords, SpeakButton } from './SpeakButton.jsx';
import { LanguageChoice } from './LanguageChoice.jsx';
import './OwnApplicationInput.css';

const empty = { applicant: '', company: '', role: '', notes: '', question: '', wordLimit: '', points: '', personal: [], synthetic: false, requirementsConfirmed: false, language: 'en' };
const pointsFrom = (text) => text.split('\n').map((point) => point.trim()).filter(Boolean);

function TextField({ label, name, value, onChange, maxLength, rows, ...props }) {
  const inputProps = { id: `own-${name}`, name, value, maxLength, onChange: (event) => onChange(name, event.target.value), ...props };
  return <div className="own-field">
    <label htmlFor={inputProps.id}>{label}</label>
    {rows ? <textarea {...inputProps} rows={rows} /> : <input {...inputProps} />}
  </div>;
}

function IdentityFields({ draft, change }) {
  return <div className="own-identity">
    <TextField label="Fictional first name" name="applicant" value={draft.applicant} onChange={change} maxLength={80} required autoComplete="off" />
    <TextField label="Company" name="company" value={draft.company} onChange={change} maxLength={100} required />
    <TextField label="Role" name="role" value={draft.role} onChange={change} maxLength={160} required />
  </div>;
}

function Requirements({ draft, change, points }) {
  return <fieldset className="own-requirements">
    <legend>Check what the question asks</legend>
    <p>Separate each part of a longer question. The app checks each point against your confirmed facts.</p>
    <TextField label="What the question asks for — one point per line" name="points" value={draft.points} onChange={change} rows={3} maxLength={6012} required />
    <p className="own-hint">1–12 points, up to 500 characters each. Tick only points that ask what you did yourself.</p>
    {points.map((point, index) => <label className="own-check" key={`${index}-${point}`}>
      <input type="checkbox" checked={draft.personal.includes(point)} onChange={(e) => change('personal', e.target.checked ? [...draft.personal, point] : draft.personal.filter((p) => p !== point))} />
      <span>Requires my own contribution: {point}</span>
    </label>)}
    <label className="own-check"><input type="checkbox" checked={draft.requirementsConfirmed} onChange={(e) => change('requirementsConfirmed', e.target.checked)} />
      <span>I checked these points against the exact question above.</span></label>
  </fieldset>;
}

function OwnFields({ draft, change, points, voice, busy, languages }) {
  return <>
    <IdentityFields draft={draft} change={change} />
    <LanguageChoice id="own-language" languages={languages} value={draft.language} onChange={(value) => change('language', value)} disabled={busy} />
    <TextField label="Fictional CV or project notes" name="notes" value={draft.notes} onChange={change} rows={5} maxLength={20000} required lang={draft.language === 'en' ? undefined : draft.language} />
    {voice ? <SpeakButton language={draft.language} onText={(text) => change('notes', appendWords(draft.notes, text))} disabled={busy} /> : null}
    <TextField label="Exact application question" name="question" value={draft.question} onChange={change} rows={4} maxLength={8000} required />
    <TextField label="Employer word limit, if stated" name="wordLimit" value={draft.wordLimit} onChange={change} type="number" min={1} max={2000} step={1} />
    <p className="own-hint">Otherwise we use a 300-word guide. We also prepare an optional cover letter with a 400-word guide. The employer’s full form and remaining steps are not checked.</p>
    <Requirements draft={draft} change={change} points={points} />
    <label className="own-check"><input type="checkbox" checked={draft.synthetic} onChange={(e) => change('synthetic', e.target.checked)} />
      <span>These notes are fictional, with no personal or customer data.</span></label>
  </>;
}

export function OwnApplicationInput({ busy = false, liveModel, onStart, voice, languages }) {
  const [draft, setDraft] = useState(empty);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const points = pointsFrom(draft.points);
  const change = (key, value) => setDraft((before) => ({ ...before, [key]: value, ...(['question', 'points', 'personal'].includes(key) ? { requirementsConfirmed: false } : {}) }));
  const ready = liveModel && !busy && !sending && draft.synthetic && draft.requirementsConfirmed && points.length > 0 && points.length <= 12;
  async function submit(event) {
    event.preventDefault();
    if (!ready) return;
    setSending(true);
    setError('');
    const { points: _points, personal, language, ...fields } = draft;
    const input = { ...fields, ...(language !== 'en' ? { language } : {}), wordLimit: fields.wordLimit === '' ? undefined : Number(fields.wordLimit), requirements: points.map((text) => ({ text, personal: personal.includes(text) })) };
    try {
      if (!(await onStart(input))) setError('Could not start this example. Your text is still here; try again when ready.');
    } catch { setError('Could not start this example. Your text is still here; try again when ready.'); }
    finally { setSending(false); }
  }
  return <details className="own-input">
    <summary>Try your own fictional example</summary>
    <form className="own-application" onSubmit={submit} aria-label="Your own application example">
    <p>Use one pasted application question with your own synthetic notes. You confirm every fact before it is used.</p>
    {!liveModel && <p className="own-hint">Your own example needs the live model. The sample above still works without it.</p>}
    <fieldset className="own-fields" disabled={Boolean(busy || sending)}><OwnFields draft={draft} change={change} points={points} voice={voice} busy={busy || sending} languages={languages} /></fieldset>
    {error && <p role="alert">{error}</p>}
    <button type="submit" className="btn primary" disabled={!ready}>{sending ? 'Opening your example…' : 'Read my example'}</button>
  </form></details>;
}
