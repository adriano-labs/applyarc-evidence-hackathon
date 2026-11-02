import './SampleCards.css';

export function SampleCards({ samples, liveModel, onStart }) {
  if (!Array.isArray(samples)) return null;

  return (
    <div className="sample-cards">
      {samples.map((sample, index) => {
        const firstDoc = sample?.form?.documents?.[0];
        const wordLimit = firstDoc?.wordLimit;
        const title = firstDoc?.title || '';
        const company = sample?.form?.company || '';
        const isFirst = index === 0;
        const buttonClass = isFirst ? 'btn primary' : 'btn';
        const disabled = sample?.liveOnly && !liveModel;
        return (
          <div className="sample-card" key={sample.id}>
            <strong>{sample.name} · {sample.field}</strong>
            <p>
              {company}’s “{title}”, up to {wordLimit} words
              {sample?.form?.sample ? ' (a made-up employer)' : ''}
            </p>
            <button
              type="button"
              className={buttonClass}
              disabled={disabled}
              onClick={() => onStart && onStart(sample.id)}
            >
              Try it with {sample.name}’s notes
            </button>
            {disabled ? <p className="sample-note">Runs on the live model only</p> : null}
          </div>
        );
      })}
    </div>
  );
}
