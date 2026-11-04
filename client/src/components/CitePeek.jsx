import { useEffect, useRef } from 'react';
import './CitePeek.css';
import { HerWords } from './HerWords.jsx';

export function CitePeek({ fact, n, sourceLabel, onCorrect, onClose, inline }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!inline) {
      ref.current?.focus?.();
    }
  }, [inline]);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose?.();
    }
  };

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`Evidence ${n}`}
      tabIndex={-1}
      className={inline ? 'cite-peek inline' : 'cite-peek'}
      onKeyDown={handleKeyDown}
    >
      <span className="peek-n">{n}</span>
      {fact.language ? <HerWords fact={fact} base="peek" /> : <>
        <p className="peek-statement">{fact.statement}</p>
        <p className="peek-quote">
          “<mark>{fact.quote}</mark>”
        </p>
      </>}
      {sourceLabel ? <p className="peek-source">{sourceLabel}</p> : null}
      <div className="peek-actions">
        {onCorrect ? (
          <button type="button" className="btn link small" onClick={() => onCorrect?.(fact.id)}>
            Correct this fact
          </button>
        ) : null}
        {onClose ? (
          <button type="button" className="btn small" onClick={() => onClose?.()}>
            Close
          </button>
        ) : null}
      </div>
    </div>
  );
}
