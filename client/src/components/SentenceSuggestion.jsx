import { useEffect, useId, useRef, useState } from 'react';
import { diffLines } from '../lib/diff.js';
import './SentenceSuggestion.css';

function Wording({ before, after }) {
  const diff = after ? diffLines(before, after) : null;
  const line = (parts, Tag) => parts.map((part, i) => part.changed ? <Tag key={i}>{part.text}</Tag> : part.text);
  return <div className="suggestion-wording">
    <h4>Your current sentence</h4>
    <p>{diff ? line(diff.was, 'del') : before}</p>
    {diff && <><h4>Proposed wording</h4><p>{line(diff.now, 'ins')}</p></>}
  </div>;
}

function Evidence({ factIds, facts, citations, onPin }) {
  return <div className="suggestion-evidence">
    <h4>Evidence behind the suggestion</h4>
    <ul>{factIds.map((id) => {
      const fact = facts.find((f) => f.id === id);
      return <li key={id}>
        <button type="button" className="btn link small" onClick={() => onPin?.(id)} aria-label={`Inspect evidence ${citations[id] ?? id}`}>[{citations[id] ?? id}]</button>
        <q>{fact?.quote ?? 'This evidence is no longer available.'}</q>
      </li>;
    })}</ul>
  </div>;
}

function Request({ request, setRequest, inputRef, id, disabled, onSubmit }) {
  return <form onSubmit={(e) => { e.preventDefault(); if (!disabled) onSubmit(); }}>
    <label htmlFor={id}>What would you like to improve? (optional)</label>
    <textarea id={id} ref={inputRef} value={request} maxLength={500} rows={3} disabled={disabled}
      onChange={(e) => setRequest(e.target.value)} aria-describedby={`${id}-help`} placeholder="For example, make it more concise." />
    <div className="suggestion-help" id={`${id}-help`}><span>Style requests do not add evidence.</span><span>{request.length}/500</span></div>
    <button type="submit" className="btn primary" disabled={disabled}>{disabled ? 'Checking the suggestion…' : 'Get a suggestion'}</button>
  </form>;
}

export function SentenceSuggestion({ segment, suggestion, facts = [], citations = {}, liveModel = false, busy = false, stale = false, onRequest, onAccept, onClose, onPin }) {
  const [request, setRequest] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const headingRef = useRef(null);
  const id = useId();
  const disabled = busy || pending;
  const proposed = suggestion?.status === 'proposed' && Boolean(suggestion.after);
  useEffect(() => {
    const target = suggestion || !liveModel ? headingRef.current : inputRef.current;
    target?.focus();
    target?.scrollIntoView?.({ block: 'nearest' });
  }, [suggestion?.id, liveModel]);
  const invoke = async (action) => {
    if (disabled) return;
    setPending(true); setError('');
    try { if (await action?.() === null) setError('That did not finish. Your original is unchanged. Check the notice above and try again.'); }
    catch { setError('That did not finish. Your original is unchanged. Try again.'); }
    finally { setPending(false); }
  };
  return <section className="sentence-suggestion" aria-labelledby={`${id}-title`} aria-busy={disabled} onKeyDown={(e) => {
    if (e.key === 'Escape' && !disabled) { e.preventDefault(); e.stopPropagation(); invoke(onClose); }
  }}>
    <h3 id={`${id}-title`} ref={headingRef} tabIndex={-1}>{suggestion ? (proposed ? 'Review the suggestion' : 'Keep it supported') : 'Improve this sentence'}</h3>
    <p className="suggestion-intro">Your wording stays in place until you choose. Approval will reopen only if you use the suggestion.</p>
    <Wording before={suggestion?.before ?? segment.text} after={proposed ? suggestion.after : null} />
    {suggestion ? <>
      <p className="suggestion-reason">{suggestion.reason}</p>
      {stale && <p className="suggestion-warning" role="status">This sentence or its evidence changed since this suggestion. Keep yours, then request a fresh suggestion.</p>}
      {proposed && <Evidence factIds={suggestion.afterFactIds ?? []} facts={facts} citations={citations} onPin={onPin} />}
      <div className="suggestion-actions">
        <button type="button" className="btn" disabled={disabled} onClick={() => invoke(onClose)}>Keep mine</button>
        {proposed && !stale && <button type="button" className="btn primary" disabled={disabled} onClick={() => invoke(onAccept)}>Use suggestion</button>}
      </div>
    </> : liveModel ? <>
      <Request request={request} setRequest={setRequest} inputRef={inputRef} id={id} disabled={disabled} onSubmit={() => invoke(() => onRequest(request.trim()))} />
      <button type="button" className="btn link small" disabled={disabled} onClick={() => invoke(onClose)}>Cancel</button>
    </> : <>
      <p role="status">Sentence suggestions need a live model. Fixture mode shows prepared examples and cannot improve your wording.</p>
      <button type="button" className="btn" disabled={disabled} onClick={() => invoke(onClose)}>Close</button>
    </>}
    {disabled && <p className="suggestion-progress" role="status">Working on your request. Your original stays in place.</p>}
    {error && <p className="suggestion-warning" role="alert">{error}</p>}
  </section>;
}
