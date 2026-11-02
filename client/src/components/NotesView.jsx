import { useEffect, useRef, useState } from 'react';
import { highlightParts } from '../lib/highlight.js';
import { SampleCards } from './SampleCards.jsx';
import { OwnApplicationInput } from './OwnApplicationInput.jsx';
import './NotesView.css';

const formatSnapshotDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '');

export function NotesView({ sources, facts, questions, activeFactId, revealFactId, busy, sampleNotes, onAddNotes, onHover, company, wordLimit, snapshotDate, samples, liveModel, onStartSample, onStartOwn, voice }) {
  const sectionRef = useRef(null);
  const [noteText, setNoteText] = useState('');
  const [sending, setSending] = useState(false);
  const [noteStatus, setNoteStatus] = useState(null);

  useEffect(() => {
    if (!revealFactId) return;
    const mark = sectionRef.current?.querySelector(`mark[data-fact="${revealFactId}"]`);
    mark?.scrollIntoView?.({ block: 'nearest' });
  }, [revealFactId]);

  const hasNotesSource = sources && sources.some((s) => s.kind === 'notes');

  if (!hasNotesSource) {
    const formattedDate = formatSnapshotDate(snapshotDate);

    return (
      <section className="notes notes-compose">
        <h2 className="notes-headline">Application answers you can stand behind.</h2>
        <ol className="notes-how" aria-label="How it works">
          <li>Paste your rough notes. Confirm the facts the app finds in them.</li>
          <li>Get the employer’s answer and a cover letter, with every claim citing your own words.</li>
          <li>Change a fact, and only the sentences that used it are rewritten for you to review.</li>
        </ol>
        <p className="notes-promise">Built for applicants, not employers: it never screens, scores or ranks anyone, and never submits anything.</p>
        {Array.isArray(samples) && samples.length > 0 ? (
          <SampleCards samples={samples} liveModel={liveModel} onStart={onStartSample} />
        ) : sampleNotes ? (
          <button type="button" className="btn primary big" onClick={() => onAddNotes && onAddNotes(sampleNotes)}>
            Try it with Ellie’s notes
          </button>
        ) : null}
        {sampleNotes ? (
          <p className="notes-sample">
            Ellie is a sample graduate; her notes are made up. The {company} form is real: a snapshot taken on {formattedDate}.
          </p>
        ) : null}
        {onStartOwn && <OwnApplicationInput busy={busy} liveModel={liveModel} onStart={onStartOwn} voice={voice} />}
      </section>
    );
  }

  const getQuestionText = (questionId) => {
    if (!questions) return '';
    const q = questions.find((qq) => qq.id === questionId);
    return q ? q.text : '';
  };

  const trimmed = noteText.trim();
  const canSave = trimmed.length > 0 && trimmed.length <= 20000 && Boolean(liveModel) && typeof onAddNotes === 'function' && !busy && !sending;

  const handleAddNote = async () => {
    if (!canSave) return;
    setSending(true);
    setNoteStatus(null);
    try {
      const res = await onAddNotes(trimmed);
      if (!res) {
        setNoteStatus({ type: 'error', message: 'Could not add your note. Your text is still here; try again.' });
        return;
      }
      setNoteText('');
      setNoteStatus({ type: 'success', message: 'Note added. Review any new facts or questions.' });
    } catch {
      setNoteStatus({ type: 'error', message: 'Could not add your note. Your text is still here; try again.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="notes" ref={sectionRef}>
      <details className="notes-add">
        <summary>Add a note</summary>
        <div className="notes-compose">
          <label htmlFor="notes-add-textarea">New note</label>
          <textarea
            id="notes-add-textarea"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            maxLength={20000}
            rows={4}
            disabled={sending || busy}
          />
          <p className="notes-help">Use fictional information only. Your earlier notes and drafts stay here.</p>
          {!liveModel ? (
            <p className="notes-help">Adding notes is not available in this mode.</p>
          ) : null}
          {noteStatus?.type === 'error' ? (
            <p role="alert" className="notes-error">{noteStatus.message}</p>
          ) : null}
          {noteStatus?.type === 'success' ? (
            <p aria-live="polite">{noteStatus.message}</p>
          ) : null}
          <div className="notes-actions">
            <button type="button" className="btn primary" onClick={handleAddNote} disabled={!canSave}>
              {sending ? 'Adding note…' : 'Add note'}
            </button>
          </div>
        </div>
      </details>
      {sources.map((source) => {
        let heading;
        if (source.kind === 'notes') {
          heading = 'Your notes';
        } else if (source.kind === 'answer') {
          heading = `Your answer to “${getQuestionText(source.questionId)}”`;
        } else if (source.kind === 'correction') {
          heading = 'Your correction';
        } else {
          heading = source.kind;
        }

        const quotes = (facts || [])
          .filter((f) => f.sourceId === source.id && (f.status === 'proposed' || f.status === 'confirmed'))
          .map((f) => ({ id: f.id, quote: f.quote, status: f.status }));

        const parts = highlightParts(source.text, quotes);

        return (
          <article className="source" key={source.id}>
            <h2>{heading}</h2>
            <p className="source-text">
              {parts.map((part, idx) => {
                if (part.factId) {
                  return (
                    <mark
                      key={idx}
                      data-fact={part.factId}
                      data-status={part.status}
                      data-active={part.factId === activeFactId ? 'true' : 'false'}
                      onMouseEnter={() => onHover && onHover(part.factId)}
                      onMouseLeave={() => onHover && onHover(null)}
                    >
                      {part.text}
                    </mark>
                  );
                }
                return <span key={idx}>{part.text}</span>;
              })}
            </p>
          </article>
        );
      })}
    </section>
  );
}
