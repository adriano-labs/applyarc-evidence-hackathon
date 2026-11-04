import { pronouns } from '../flow.js';
import { languageName } from '../lib/language.js';
import { preparedBy } from '../lib/prepared.js';
import './SampleCards.css';

// A sample with a saved real-model run can start at the key moment; only the live model can repair it.
function KeyMomentStart({ sample, busy, model, onStart }) {
  const p = pronouns(sample.possessive);
  return (
    <>
      <button type="button" className="btn" disabled={busy} onClick={() => onStart(sample.id)}>
        {sample.clips ? `Start at ${sample.name}’s key moment` : 'Start at the key moment'}
      </button>
      <p className="sample-note">
        {p.Possessive} facts are confirmed and both documents approved, {preparedBy(sample.prepared, model)}. You make the one correction; the repair runs live.{sample.keyTiming ? ` ${sample.keyTiming}` : ''}
      </p>
    </>
  );
}

// What a card says: a sample's own line (one who speaks), or its form's document and limit.
function CardBody({ sample }) {
  if (sample.blurb) return <p>{sample.blurb}</p>;
  const firstDoc = sample?.form?.documents?.[0];
  return (
    <p>
      {sample?.form?.company || ''}’s “{firstDoc?.title || ''}”, up to {firstDoc?.wordLimit} words
      {sample?.form?.sample ? ' (a made-up employer)' : ''}
    </p>
  );
}

// Under a spoken sample's button: what the voice is, where it runs, how long the live run takes.
function spokenNote(sample, liveModel, voice) {
  const p = pronouns(sample.possessive).possessive;
  const where = voice ? sample.timing ?? ''
    : liveModel ? `Spoken notes run on Meta’s API only; on this open-weight edition ${p} written note is used instead.`
      : `With no live model, ${p} written note is used (typed, not spoken).`;
  return `Fictional applicant. Synthetic voice, made before the demo; not a runtime model. ${where}${where ? ' ' : ''}Nothing is sent.`;
}

// busy: a start is already on its way, so a second press cannot start another. model: the model
// this edition runs. With no live voice a spoken sample starts from her written note, and says so.
export function SampleCards({ samples, liveModel, voice = false, busy = false, model, onStart, onStartPrepared }) {
  if (!Array.isArray(samples)) return null;
  // A sample who speaks leads; the others keep their order.
  const ordered = [...samples.filter((s) => s?.clips), ...samples.filter((s) => !s?.clips)];

  return (
    <div className="sample-cards">
      {ordered.map((sample, index) => {
        const isFirst = index === 0;
        const disabled = sample?.liveOnly && !liveModel;
        const keyMoment = Boolean(sample?.prepared && liveModel && onStartPrepared);
        // A later sample with a key moment offers it first; its full run is one link away.
        const buttonClass = isFirst ? 'btn primary' : keyMoment ? 'btn link small' : 'btn';
        return (
          <div className={sample.clips ? 'sample-card spoken' : 'sample-card'} key={sample.id}>
            <strong>{sample.name} · {sample.field}{sample.language ? ` · speaks ${languageName(sample.language)}` : ''}</strong>
            <CardBody sample={sample} />
            {keyMoment && !isFirst ? <KeyMomentStart sample={sample} busy={busy} model={model} onStart={onStartPrepared} /> : null}
            <button
              type="button"
              className={buttonClass}
              disabled={disabled || busy}
              onClick={() => onStart && onStart(sample.id)}
            >
              Try it with {sample.name}’s {!sample.clips ? 'notes' : voice ? 'voice note' : 'written note'}
            </button>
            {sample.clips ? <p className="sample-note">{spokenNote(sample, liveModel, voice)}</p> : null}
            {disabled ? <p className="sample-note">Runs on the live model only</p> : null}
            {keyMoment && isFirst ? <KeyMomentStart sample={sample} busy={busy} model={model} onStart={onStartPrepared} /> : null}
          </div>
        );
      })}
    </div>
  );
}
