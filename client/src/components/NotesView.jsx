import { useEffect, useRef, useState } from 'react';
import { highlightParts } from '../lib/highlight.js';
import { NotesWelcome } from './NotesWelcome.jsx';
import { LanguageChoice } from './LanguageChoice.jsx';
import './NotesView.css';

export function NotesView({ sources, facts, questions, activeFactId, revealFactId, busy, sampleNotes, onAddNotes, onHover, company, wordLimit, snapshotDate, samples, liveModel, onStartSample, onStartPrepared, onStartOwn, voice, languages, model }) {
  const sectionRef = useRef(null);
  const [noteText, setNoteText] = useState('');
  const [noteLanguage, setNoteLanguage] = useState(() => (sources ?? []).filter((s) => s.kind !== 'correction').at(-1)?.language ?? 'en');
  const [sending, setSending] = useState(false);
  const [noteStatus, setNoteStatus] = useState(null);

  useEffect(() => {
    if (!revealFactId) return;
    const mark = sectionRef.current?.querySelector(`mark[data-fact="${revealFactId}"]`);
    mark?.scrollIntoView?.({ block: 'nearest' });
  }, [revealFactId]);

  const hasNotesSource = sources && sources.some((s) => s.kind === 'notes');

  if (!hasNotesSource) {
    return <NotesWelcome {...{ busy, sampleNotes, onAddNotes, company, snapshotDate, samples, liveModel, onStartSample, onStartPrepared, onStartOwn, voice, languages, model }} />;
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
      const res = await (noteLanguage === 'en' ? onAddNotes(trimmed) : onAddNotes(trimmed, { language: noteLanguage }));
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
          <LanguageChoice id="notes-add-language" languages={languages} value={noteLanguage} onChange={setNoteLanguage} disabled={sending || busy} />
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
