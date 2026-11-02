import './PhoneBar.css';

export function PhoneBar({ pane, onPane, needsYou = 0 }) {
  const evidenceName =
    needsYou > 0 ? `Evidence, ${needsYou} need you` : 'Evidence';

  return (
    <nav className="phone-bar" aria-label="Sections">
      <button
        type="button"
        aria-pressed={pane === 'doc'}
        onClick={() => onPane('doc')}
      >
        Writing
      </button>
      <button
        type="button"
        aria-pressed={pane === 'rail'}
        onClick={() => onPane('rail')}
        aria-label={evidenceName}
      >
        Evidence
        {needsYou > 0 && (
          <span className="badge" aria-hidden="true">
            {needsYou}
          </span>
        )}
      </button>
    </nav>
  );
}
