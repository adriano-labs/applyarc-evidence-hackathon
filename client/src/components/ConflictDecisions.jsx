import './ConflictDecisions.css';

// After the applicant answers a conflict, the earlier fact it was about is theirs
// to correct, keep or remove; drafting waits until they choose.
export function ConflictDecisions({ decisions = [], busy, onCorrect, onSettle }) {
  if (!decisions.length) return null;
  return (
    <section className="conflict-decisions" aria-label="Earlier facts waiting for you">
      {decisions.map((d) => (
        <div key={`${d.questionId}-${d.factId}`} className="conflict-card">
          <p>Your answer was about this earlier fact. Is it still right?</p>
          <p className="conflict-quote">“{d.quote}”</p>
          <div className="conflict-actions">
            <button type="button" className="btn primary small" disabled={busy} onClick={() => onCorrect(d.factId, d.questionId)}>Correct this fact</button>
            <button type="button" className="btn small" disabled={busy} onClick={() => onSettle(d.questionId, d.factId, 'keep')}>Keep it</button>
            {d.cited ? null : <button type="button" className="btn small" disabled={busy} onClick={() => onSettle(d.questionId, d.factId, 'remove')}>Remove it</button>}
          </div>
        </div>
      ))}
    </section>
  );
}
