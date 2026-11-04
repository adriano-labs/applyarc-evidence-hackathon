const labels = { answer: 'Project answer', letter: 'Cover letter' };

// titles: the form's own document titles, by id.
export function DroppedWordingNotice({ details = [], titles }) {
  const items = Array.isArray(details) ? details.filter((item) => item && Object.hasOwn(labels, item.docId)
    && typeof item.text === 'string' && typeof item.reason === 'string') : [];
  if (items.length === 0) return null;
  return (
    <details className="dropped-details">
      <summary className="dropped-summary">Why was wording left out?</summary>
      <div className="dropped-body">
        <p className="dropped-caveat">A model review can be wrong and is not factual proof.</p>
        <ul className="dropped-list">
          {items.map((item, idx) => (
            <li key={idx} className="dropped-item">
              <div className="dropped-doc">{titles?.[item.docId] ?? labels[item.docId]}</div>
              <div className="dropped-text">{item.text}</div>
              <div className="dropped-reason"><strong>Review reason:</strong> {item.reason}</div>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
