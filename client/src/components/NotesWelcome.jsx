// The welcome, before any notes: what the app does, the samples and a box for your own example.
// When a sample speaks another language it leads with the council's own line on AI, and names
// Meta's two models only where they run.
import { SampleCards } from './SampleCards.jsx';
import { OwnApplicationInput } from './OwnApplicationInput.jsx';
import { family } from '../lib/trail.js';

const formatSnapshotDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '');
const ONS = 'https://www.ons.gov.uk/peoplepopulationandcommunity/culturalidentity/language/bulletins/languageenglandandwales/census2021';
const HOW = [
  'Paste your rough notes. Confirm the facts the app finds in them.',
  'Get the employer’s answer and a cover letter, with every claim the app writes citing your own words.',
  'Correct one fact, and only the sentences that cited it reopen, in both documents, with a rewrite proposed beside each. Your own edits are never rewritten without asking.',
];
const spokenHow = (voice, model) => [
  voice ? 'Speak in your own language. Muse Voice Transcribe writes it down, and you check the words.' : 'Speak or write in your own language, and check the words.',
  `${voice && model ? family(model).name : 'The app'} turns them into facts that quote you word for word, with the English meaning beneath. You confirm both.`,
  'Your English application cites those facts. Fix one fact once, and only the sentences that cite it reopen, in both documents.',
];

function Intro({ spoken, thesis, voice, model }) {
  return (
    <>
      {thesis ? (
        <blockquote className="notes-thesis">
          <p>“{thesis.quote}”</p>
          <p className="notes-thesis-source">{thesis.url ? <a href={thesis.url}>{thesis.source}</a> : thesis.source} · a public advert, not a partner or endorser</p>
        </blockquote>
      ) : null}
      <h2 className="notes-headline">{spoken ? 'Say what you did, in your own language.' : 'Application answers you can defend at interview.'}</h2>
      <ol className="notes-how" aria-label="How it works">
        {(spoken ? spokenHow(voice, model) : HOW).map((line) => <li key={line}>{line}</li>)}
      </ol>
    </>
  );
}

export function NotesWelcome({ busy, sampleNotes, onAddNotes, company, snapshotDate, samples, liveModel, onStartSample, onStartPrepared, onStartOwn, voice, languages, model }) {
  const spoken = Array.isArray(samples) && samples.some((s) => s?.clips);
  return (
    <section className="notes notes-compose">
      <Intro spoken={spoken} thesis={spoken ? samples.find((s) => s?.thesis)?.thesis : null} voice={voice} model={model} />
      <p className="notes-promise">Built for applicants, not employers: it never screens, scores or ranks anyone, and never submits anything.</p>
      {Array.isArray(samples) && samples.length > 0 ? (
        <SampleCards samples={samples} liveModel={liveModel} voice={voice} busy={busy} model={model} onStart={onStartSample} onStartPrepared={onStartPrepared} />
      ) : sampleNotes ? (
        <button type="button" className="btn primary big" onClick={() => onAddNotes && onAddNotes(sampleNotes)}>
          Try it with Ellie’s notes
        </button>
      ) : null}
      {sampleNotes ? (
        <p className="notes-sample">
          Ellie is a fictional graduate. Her notes say “we”; the real {company} form (a public snapshot from {formatSnapshotDate(snapshotDate)}) asks what she did herself. On the live model, allow about five minutes: the correction is the last step.
        </p>
      ) : null}
      {spoken ? (
        <p className="notes-sample">
          In England and Wales, 880,000 people could not speak English well (<a href={ONS}>ONS, Census 2021</a>).
        </p>
      ) : null}
      {onStartOwn && <OwnApplicationInput busy={busy} liveModel={liveModel} onStart={onStartOwn} voice={voice} languages={languages} />}
    </section>
  );
}
