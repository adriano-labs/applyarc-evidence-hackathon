import './FactsReview.css';
import { useEffect, useRef } from 'react';
import { HerWords } from './HerWords.jsx';
import { withActor } from '../lib/actor.js';

// spoken: the ids of the sources that came from a voice clip. whose: "your", or in the walk-through
// the sample's own ("her") for a fact in her language.
function getSourceLabel(sourceId, sources, spoken, whose = 'your') {
  const source = sources?.[sourceId];
  if (source === 'answer') return `From ${whose} answer`;
  if (source === 'correction') return `From ${whose} correction`;
  return spoken?.has(sourceId) ? `From ${whose} voice note` : `From ${whose} notes`;
}

// who: the sample in the walk-through, whose headline names her, so a fact in her language says
// "From her voice note · Ana did this". English facts keep "your": their wording says who did it.
function FactCard({ fact, sources, spoken, requirementNames, onDecide, busy, onHover, who }) {
  const her = fact.language && who ? who : null;
  const sourceLabel = withActor(getSourceLabel(fact.sourceId, sources, spoken, her?.possessive), fact, her?.name);
  const tags = (fact.requirementIds || []).filter((id) => requirementNames && requirementNames[id]);
  const hover = () => onHover?.(fact.id);
  return (
    <li className="fact-card" onMouseEnter={hover} onMouseLeave={hover} onFocus={hover} tabIndex={-1}>
      <div className="fact-actions">
        <button type="button" className="btn small primary" onClick={() => onDecide(fact.id, 'confirm')} disabled={busy}>Yes, confirm</button>
        <button type="button" className="btn small" onClick={() => onDecide(fact.id, 'reject')} disabled={busy}>Not right</button>
      </div>
      {fact.language ? <HerWords fact={fact} base="fact" /> : <>
        <p className="fact-statement">{fact.statement}</p>
        <p className="fact-quote">“<mark>{fact.quote}</mark>”</p>
      </>}
      <p className="fact-meta">
        <span className="fact-source">{sourceLabel}</span>
        {tags.map((id) => <span key={id} className="fact-tag">{requirementNames[id]}</span>)}
      </p>
      <p className="fact-hint">{fact.language ? 'Yes confirms the words and their English meaning together. ' : ''}Enter: yes · Backspace: not right</p>
    </li>
  );
}

export function FactsReview({ facts = [], total = 0, sources = {}, spoken, requirementNames = {}, onDecide, busy = false, onHover, onConfirmRest, company, who }) {
  const sectionRef = useRef(null);
  const lastKeyDecisionRef = useRef(false);
  const currentFact = facts?.[0] || null;
  const nextFacts = facts?.length > 1 ? facts.slice(1) : [];
  const decidedCount = total - (facts?.length || total);
  const showConfirmRest = decidedCount >= 1 && facts?.length > 1;

  const handleKeyDown = (e) => {
    if (e.target !== e.currentTarget || busy || !facts?.length) return;
    if (e.key === 'Enter') { e.preventDefault(); lastKeyDecisionRef.current = true; onDecide?.(facts[0].id, 'confirm'); }
    else if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); lastKeyDecisionRef.current = true; onDecide?.(facts[0].id, 'reject'); }
  };
  const decideAndRefocus = (factId, decision) => { lastKeyDecisionRef.current = true; onDecide?.(factId, decision); };

  useEffect(() => {
    if (lastKeyDecisionRef.current) { lastKeyDecisionRef.current = false; sectionRef.current?.focus(); }
  }, [currentFact?.id]);

  useEffect(() => {
    if (currentFact?.id) {
      onHover?.(currentFact.id);
    } else {
      onHover?.(null);
    }
  }, [currentFact?.id]);

  const handleConfirmRest = () => { if (onConfirmRest && facts) onConfirmRest(facts.map((f) => f.id)); };

  return (
    <section ref={sectionRef} className="facts-review" aria-labelledby="facts-title" tabIndex={0} onKeyDown={handleKeyDown}>
      <header>
        <h2 id="facts-title">Is this right?</h2>
        <p className="facts-count" role="status">Fact {total - (facts?.length || 0) + 1} of {total}</p>
      </header>
      {currentFact ? (
        <ul className="fact-cards">
          <FactCard fact={currentFact} sources={sources} spoken={spoken} requirementNames={requirementNames} onDecide={decideAndRefocus} busy={busy} onHover={onHover} who={who} />
        </ul>
      ) : null}
      {showConfirmRest ? (
        <div className="facts-confirm-rest">
          <button type="button" className="btn small" onClick={handleConfirmRest} disabled={busy}>Confirm the remaining {facts.length}</button>
        </div>
      ) : null}
      {nextFacts.length > 0 ? (
        <div className="facts-next-section">
          <h3>Next</h3>
          <ul className="facts-next">
            {nextFacts.map((fact) => <li key={fact.id}>{fact.statement}</li>)}
          </ul>
        </div>
      ) : null}
      <p className="facts-foot">After these, the app checks your facts against what {company || 'the employer'} asks for, and asks you about anything missing.</p>
    </section>
  );
}
