// Correcting a fact in another language: the English meaning of the new words and who did it,
// both hers to check before saving. The meaning is a working translation, never a certified one.
import { actorLabel } from '../lib/actor.js';

const WHO = ['self', 'team', 'other'];

export function GlossFields({ id, gloss, onChange, disabled, askActor = true }) {
  return (
    <div className="gloss-fields">
      <label htmlFor={`${id}-meaning`}>In English (working translation)</label>
      <textarea id={`${id}-meaning`} rows={2} maxLength={280} value={gloss.meaning ?? ''} disabled={disabled} onChange={(e) => onChange({ ...gloss, meaning: e.target.value })} />
      {askActor ? (
        <fieldset className="gloss-actor" disabled={disabled}>
          <legend>Who did it</legend>
          {WHO.map((value) => (
            <label key={value}>
              <input type="radio" name={`${id}-actor`} value={value} checked={(gloss.actor ?? 'self') === value} onChange={() => onChange({ ...gloss, actor: value })} />
              {actorLabel(value)}
            </label>
          ))}
        </fieldset>
      ) : null}
    </div>
  );
}

// What a correction sends for a fact in another language; nothing for English.
export const glossFor = (fact, gloss) => (fact?.language ? { meaning: (gloss?.meaning ?? '').trim(), actor: gloss?.actor ?? 'self' } : undefined);

// A prefilled English meaning, as the corrected fact will say it: without the "Correction:" label her
// words began with. Her own words ("Correção: …") stay word for word in the quote.
export const plainMeaning = (meaning) => (typeof meaning === 'string'
  ? meaning.replace(/^\s*(?:correction|correção)\s*[:,.]\s*(\S)/iu, (_, first) => first.toUpperCase())
  : meaning);
