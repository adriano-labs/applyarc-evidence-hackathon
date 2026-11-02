import { useEffect, useRef, useState } from 'react';
import { matchesSampleCorrection } from '../flow.js';
import './References.css';

// Where a fact came from, in the applicant's terms (by the kind of its source).
export function sourceLabel(kind, owner = 'your') {
  if (kind === 'answer') return `From ${owner} answer`;
  if (kind === 'correction') return `From ${owner} correction`;
  return `From ${owner} notes`;
}

// `prefilled`: opened by a correction step; only the matching sample supplies replacement wording.
function CorrectionForm({ fact, onCorrect, onCancel, sample, prefilled, n, conflictContext, locked }) {
  const isSampleFact = matchesSampleCorrection(fact, sample);
  // Capture the opening once; another render must not replace an in-progress edit.
  const [origin] = useState(() => {
    const conflict = prefilled && conflictContext?.factId === fact.id;
    return { conflict, sample: prefilled && isSampleFact && !conflict, answer: conflict ? conflictContext.answerText : null };
  });
  const useSamplePrefill = origin.sample;
  const [text, setText] = useState(origin.conflict ? origin.answer ?? fact.statement : useSamplePrefill ? sample.correction.text : fact.statement);
  const [pending, setPending] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const trimmed = text.trim();
  const unchanged = trimmed === fact.statement.trim();
  const tooLong = trimmed.length > 280;
  const disabled = pending || locked || trimmed === '' || unchanged || tooLong;
  const showSample = isSampleFact && !origin.conflict && text !== sample.correction.text;
  const saveRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!prefilled) return;
    const target = useSamplePrefill ? saveRef.current : textareaRef.current;
    target?.focus();
    target?.scrollIntoView?.({ block: 'nearest' });
  }, [prefilled, useSamplePrefill]);

  const save = async () => {
    if (disabled) return;
    setPending(true);
    setUnconfirmed(false);
    try {
      setUnconfirmed(!(await onCorrect(fact.id, trimmed)));
    } catch {
      setUnconfirmed(true);
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      {origin.conflict ? <p className="ref-statement">Earlier fact: {fact.statement}</p> : null}
      {typeof origin.answer === 'string' ? <p className="ref-help">From your answer — review before saving.</p> : null}
      <label htmlFor={`ref-correct-${fact.id}`}>The fact, in your words</label>
      <textarea
        ref={textareaRef}
        id={`ref-correct-${fact.id}`}
        rows={origin.conflict ? 4 : 2}
        value={text}
        disabled={pending || locked}
        onChange={(e) => setText(e.target.value)}
      />
      {showSample ? (
        <button
          type="button"
          className="btn small"
          onClick={() => setText(sample.correction.text)}
          disabled={pending || locked}
        >
          Use {sample.name}’s sample correction
        </button>
      ) : null}
      {tooLong ? (
        <p className="ref-help" role="alert">Keep the whole fact to 280 characters or fewer. Shorten your wording before saving.</p>
      ) : useSamplePrefill ? (
        <p className="ref-help">{sample.name}’s sample correction is filled in. Save it and only the sentences that cite [{n}] are rewritten.</p>
      ) : (
        <p className="ref-help">Saving it finds every sentence that cites this fact and proposes a fix for you to review.</p>
      )}
      {unconfirmed ? <p className="ref-help" role="alert">Saving is not confirmed. Your wording is kept here.</p> : null}
      <div className="ref-actions">
        <button
          ref={saveRef}
          type="button"
          className="btn small primary"
          disabled={disabled}
          onClick={save}
        >
          Save the correction
        </button>
        <button type="button" className="btn small" onClick={onCancel} disabled={pending || locked}>
          Cancel
        </button>
      </div>
    </>
  );
}

function RefItem({ fact, n, sources, activeFactId, revealFactId, locked, onCorrect, onHover, uncited, sample, openCorrectionFactId, onCloseCorrection, conflictCorrectionContext }) {
  const refEl = useRef(null);
  const [editing, setEditing] = useState(false);

  const prefilled = openCorrectionFactId === fact.id;

  useEffect(() => {
    if (prefilled) setEditing(true);
  }, [prefilled]);

  useEffect(() => {
    if (revealFactId === fact.id && refEl.current) {
      refEl.current.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    }
  }, [revealFactId, fact.id]);

  const isActive = activeFactId === fact.id ? 'true' : 'false';
  const className = uncited ? 'ref uncited' : 'ref';
  const from = sourceLabel(sources[fact.sourceId]);

  return (
    <li
      ref={refEl}
      className={className}
      data-fact={fact.id}
      data-active={isActive}
      onMouseEnter={() => onHover(fact.id)}
      onMouseLeave={() => onHover(null)}
    >
      {!uncited && n !== undefined ? <span className="ref-n">{n}</span> : null}
      <div className="ref-body">
        {editing ? (
          <CorrectionForm
            fact={fact}
            sample={sample}
            prefilled={prefilled}
            n={n}
            conflictContext={conflictCorrectionContext}
            locked={locked}
            onCorrect={async (id, text) => {
              const result = await onCorrect(id, text);
              if (result) {
                setEditing(false);
                onCloseCorrection?.();
              }
              return result;
            }}
            onCancel={() => {
              setEditing(false);
              onCloseCorrection?.();
            }}
          />
        ) : (
          <>
            <p className="ref-statement">{fact.statement}</p>
            <p className="ref-quote">“<mark>{fact.quote}</mark>”</p>
            <p className="ref-source">{from}</p>
            {!locked && fact.status === 'confirmed' ? (
              <button
                type="button"
                className="btn link small"
                onClick={() => setEditing(true)}
              >
                Correct this fact
              </button>
            ) : null}
          </>
        )}
      </div>
    </li>
  );
}

export function References({ facts, citations, sources, activeFactId, revealFactId, locked, onCorrect, onHover, sample, openCorrectionFactId, onCloseCorrection, conflictCorrectionContext }) {
  const handleCorrect = (id, text) => onCorrect?.(id, text);

  const citedEntries = [];
  for (const fact of facts) {
    if (fact.status === 'confirmed' && Object.prototype.hasOwnProperty.call(citations, fact.id)) {
      citedEntries.push({ fact, n: citations[fact.id] });
    }
  }
  citedEntries.sort((a, b) => a.n - b.n);

  const uncitedConfirmed = facts.filter(
    (f) => f.status === 'confirmed' && !Object.prototype.hasOwnProperty.call(citations, f.id)
  );

  const rejected = facts.filter((f) => f.status === 'rejected');
  const hasConfirmed = facts.some((f) => f.status === 'confirmed');

  return (
    <section className="references" aria-labelledby="refs-title">
      <h2 id="refs-title">Your evidence</h2>
      {!hasConfirmed ? (
        <p className="refs-empty">Facts you confirm appear here, numbered as your documents cite them.</p>
      ) : null}
      {citedEntries.length > 0 ? (
        <ol className="ref-list">
          {citedEntries.map(({ fact, n }) => (
            <RefItem
              key={fact.id}
              fact={fact}
              n={n}
              sources={sources}
              activeFactId={activeFactId}
              revealFactId={revealFactId}
              locked={locked}
              onCorrect={handleCorrect}
              onHover={onHover}
              uncited={false}
              sample={sample}
              openCorrectionFactId={openCorrectionFactId}
              onCloseCorrection={onCloseCorrection}
              conflictCorrectionContext={conflictCorrectionContext}
            />
          ))}
        </ol>
      ) : null}
      {uncitedConfirmed.length > 0 ? (
        <>
          <h3>Not cited yet</h3>
          <ul>
            {uncitedConfirmed.map((fact) => (
              <RefItem
                key={fact.id}
                fact={fact}
                sources={sources}
                activeFactId={activeFactId}
                revealFactId={revealFactId}
                locked={locked}
                onCorrect={handleCorrect}
                onHover={onHover}
                uncited={true}
                sample={sample}
                openCorrectionFactId={openCorrectionFactId}
                onCloseCorrection={onCloseCorrection}
                conflictCorrectionContext={conflictCorrectionContext}
              />
            ))}
          </ul>
        </>
      ) : null}
      {rejected.length > 0 ? (
        <details className="ref-rejected">
          <summary>Rejected ({rejected.length})</summary>
          <ul>
            {rejected.map((fact) => (
              <li key={fact.id} className="ref rejected">
                <s>{fact.statement}</s>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
