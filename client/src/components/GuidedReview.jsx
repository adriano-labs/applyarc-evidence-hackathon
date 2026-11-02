// A read-only look back at a finished step of the guided walk-through, and the finish's
// list of what was done, one row a step. Nothing here changes the workspace.
import { pronouns } from '../flow.js';
import { GuidedAnswer } from './GuidedAnswer.jsx';

export const STEP_LABELS = ['Notes', 'Facts', 'Question', 'Answer', 'Change'];

const notesOf = (ws) => (ws?.applicant?.sources ?? []).find((s) => s?.kind === 'notes')?.text ?? '';
const confirmedOf = (ws) => (ws?.applicant?.facts ?? []).filter((f) => f?.status === 'confirmed');
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

export function NotesText({ workspace }) {
  return (
    <div className="guided-notes">
      {notesOf(workspace).split(/\n\s*\n/).map((para, i) => <p key={i}>{para}</p>)}
    </div>
  );
}

// Two aligned columns: what each line is, and what it says.
export function Compare({ rows }) {
  return (
    <dl className="guided-compare">
      {rows.map(([term, value]) => (
        <div key={term}>
          <dt>{term}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ChangedLine({ changed }) {
  return <p className="guided-changed">Only {plural(changed, 'sentence', 'sentences')} changed. Everything else stayed exactly as it was.</p>;
}

// Headline and why line for looking back at step n.
export function reviewCopy(n, ws, name, p) {
  const copy = {
    1: { h1: `${name}’s notes, as ${p.subject} wrote them`, why: 'Every fact points back to a line here.' },
    2: { h1: `The ${plural(confirmedOf(ws).length, 'fact', 'facts')} ${name} confirmed`, why: `Each one is tied to ${p.possessive} exact words. Only these can be used in ${p.possessive} answer.` },
    3: { h1: `The question the app asked ${p.object}`, why: `${p.Possessive} answer became facts too, tied to ${p.possessive} own words.` },
    4: { h1: `${p.Possessive} answer, with evidence beside it`, why: 'Tap a number to see the words it came from.' },
    5: ws?.application?.lastRepair
      ? { h1: `The fact ${p.subject} corrected`, why: 'Only the sentences that used it were rewritten.' }
      : { h1: 'Nothing needed correcting', why: 'Both documents stayed as they were written.' },
  };
  return copy[n] ?? { h1: '', why: '' };
}

export function GuidedReview({ n, workspace: ws, view, possessive = 'her' }) {
  const p = pronouns(possessive);
  if (n === 1) return <NotesText workspace={ws} />;
  if (n === 2) {
    return (
      <ol className="guided-fact-list" aria-label="Confirmed facts">
        {confirmedOf(ws).map((f) => (
          <li key={f.id}>
            <p className="guided-fact-statement">{f.statement}</p>
            <p className="guided-fact-quote">“{f.quote}”</p>
          </li>
        ))}
      </ol>
    );
  }
  if (n === 3) {
    const sources = ws?.applicant?.sources ?? [];
    return (ws?.application?.questions ?? []).filter((q) => q.status === 'answered').map((q) => (
      <Compare key={q.id} rows={[['The app asked', q.text], [`${p.Possessive} answer`, sources.find((s) => s.id === q.sourceId)?.text ?? '']]} />
    ));
  }
  if (n === 4) return <GuidedAnswer workspace={ws} view={view} possessive={possessive} />;
  const repair = ws?.application?.lastRepair;
  if (!repair) return <p>No fact was corrected.</p>;
  const fact = (ws?.applicant?.facts ?? []).find((f) => f.id === repair.factId);
  return (
    <>
      <Compare rows={[['Was', fact?.history?.at(-1)?.statement ?? ''], ['Now', fact?.statement ?? '']]} />
      <ChangedLine changed={repair.changed ?? 0} />
    </>
  );
}

// The finish, like a "check your answers" page: each step, what it produced, and a way back.
export function FinishList({ workspace: ws, possessive = 'her', onReview }) {
  const p = pronouns(possessive);
  const docs = ws?.application?.form?.documents ?? [];
  const claims = docs.flatMap((d) => ws?.application?.documents?.[d.id]?.segments ?? []).filter((s) => s.kind === 'claim' && s.author !== 'user').length;
  const answered = (ws?.application?.questions ?? []).filter((q) => q.status === 'answered').length;
  const repair = ws?.application?.lastRepair;
  const changed = repair?.changed ?? 0;
  const values = [
    `${plural(notesOf(ws).split(/\s+/).filter(Boolean).length, 'word', 'words')} of rough notes`,
    `${plural(confirmedOf(ws).length, 'fact', 'facts')} confirmed, each tied to ${p.possessive} own words`,
    answered ? `${plural(answered, 'question', 'questions')} answered in ${p.possessive} own words` : 'No question needed',
    `${plural(claims, 'statement', 'statements')} in ${plural(docs.length, 'document', 'documents')}, each citing ${p.possessive} facts`,
    repair ? `1 fact corrected; only the ${changed === 1 ? '1 sentence that used it was' : `${changed} sentences that used it were`} rewritten` : 'No fact corrected',
  ];
  return (
    <dl className="guided-summary">
      {STEP_LABELS.map((label, i) => (
        <div key={label} className="guided-summary-row">
          <dt>{label}</dt>
          <dd>{values[i]}</dd>
          <dd className="guided-summary-action">
            <button type="button" className="btn link small" aria-label={`View ${label.toLowerCase()}`} onClick={() => onReview?.(i + 1)}>
              View
            </button>
          </dd>
        </div>
      ))}
    </dl>
  );
}
