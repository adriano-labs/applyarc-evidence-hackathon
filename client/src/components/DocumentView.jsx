import { Fragment, useEffect, useRef, useState } from 'react';
import { PenLine, Pencil } from 'lucide-react';
import './DocumentView.css';
import { ManuscriptHead } from './ManuscriptHead.jsx';
import { SentenceSuggestion } from './SentenceSuggestion.jsx';

function groupParagraphs(segments) {
  const paragraphs = [];
  let currentParagraph = [];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (segment.startsParagraph && currentParagraph.length > 0) {
      paragraphs.push(currentParagraph);
      currentParagraph = [];
    }
    currentParagraph.push(segment);
  }
  if (currentParagraph.length > 0) {
    paragraphs.push(currentParagraph);
  }
  return paragraphs;
}

function Citations({ factIds, citations, activeFactId, onCite, onPin, segmentId, original = false }) {
  const ids = Array.isArray(factIds) ? factIds : [];
  if (ids.length === 0) return null;
  const Tag = original ? 'span' : 'sup';

  return (
    <Tag className="cites">
      {ids.map((factId) => {
        const n = citations[factId];
        const isActive = activeFactId === factId;
        return (
          <button
            type="button"
            className="cite"
            key={factId}
            aria-label={original ? `Original source ${n}` : `Evidence ${n}`}
            data-active={isActive ? 'true' : 'false'}
            onMouseEnter={() => onCite?.(factId, segmentId)}
            onMouseLeave={() => onCite?.(null, segmentId)}
            onFocus={() => onCite?.(factId, segmentId)}
            onBlur={() => onCite?.(null, segmentId)}
            onClick={() => onPin?.(factId, segmentId)}
          >
            {n}
          </button>
        );
      })}
    </Tag>
  );
}

function SentenceEditor({ text, onSave, onCancel, onImprove, disabled = false }) {
  const [editValue, setEditValue] = useState(text || '');
  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  const rows = Math.max(2, Math.ceil((editValue.length || 0) / 60));

  const handleKeyDown = (e) => {
    if (disabled) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      if (onCancel) onCancel();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (onSave) onSave(editValue);
    }
  };

  const handleSave = () => {
    if (onSave) onSave(editValue);
  };

  return (
    <span className="sentence editing">
      <textarea
        aria-label="Edit sentence"
        disabled={disabled}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={rows}
        ref={textareaRef}
      />
      <span className="edit-actions">
        {onImprove && <button type="button" className="btn small" disabled={disabled || editValue !== text} onClick={onImprove}>Improve this sentence</button>}
        <button type="button" className="btn small primary" disabled={disabled} onClick={handleSave}>
          Save
        </button>
        <button type="button" className="btn small" disabled={disabled} onClick={onCancel}>
          Cancel
        </button>
      </span>
      {onImprove && editValue !== text && <span className="edit-suggestion-hint">Save or cancel your edit before asking for a suggestion.</span>}
    </span>
  );
}

// The sentence's words; the last word travels with its citations so a
// number never wraps onto a line of its own. Clicking the words edits the
// sentence; clicking a citation only points at its evidence.
function SentenceText({ segment, factIds, citations, activeFactId, onCite, onPin, locked, onEditStart, editable }) {
  const edit = (event) => {
    if (locked || !editable || event.target.closest('.cite')) return;
    onEditStart?.(segment);
  };
  const cited = segment.author !== 'user' && segment.kind === 'claim' && factIds.length > 0;
  const cut = cited ? segment.text.lastIndexOf(' ') + 1 : segment.text.length;
  return (
    <span className="sentence-text" data-editable={editable && !locked ? 'true' : 'false'} title={editable && !locked ? 'Click to edit' : undefined} onClick={edit}>
      {segment.text.slice(0, cut)}
      {cited && (
        <span className="cite-anchor">
          {segment.text.slice(cut)}
          <Citations factIds={factIds} citations={citations} activeFactId={activeFactId} onCite={onCite} onPin={onPin} segmentId={segment.id} />
        </span>
      )}
    </span>
  );
}

function Sentence({ segment, factIds, citations, activeFactId, onCite, onPin, isChanged, isPending, locked, onEditStart, isFlashing, citesActive, editable }) {
  return (
    <span className={`sentence ${segment.author}${isPending ? ' pending' : ''}${isFlashing ? ' flash' : ''}`} data-segment={segment.id} data-cites-active={citesActive ? 'true' : undefined}>
      <SentenceText segment={segment} factIds={factIds} citations={citations} activeFactId={activeFactId} onCite={onCite} onPin={onPin} locked={locked} onEditStart={onEditStart} editable={editable} />
      {segment.author === 'user' && (
        <span className="user-word-context">
          <span className="mark-yours" aria-label="Your words" role="img">
            <PenLine size={12} aria-hidden="true" />
          </span>
          <span className="mark-yours-label">Your words · not rechecked</span>
          {Array.isArray(factIds) && factIds.length > 0 && (
            <span className="original-sources">
              <span className="original-sources-label">Original sources</span>
              <Citations factIds={factIds} citations={citations} activeFactId={activeFactId} onCite={onCite} onPin={onPin} segmentId={segment.id} original />
            </span>
          )}
        </span>
      )}
      {isChanged && <span className="mark-corrected">corrected</span>}
      {isPending && <span className="mark-pending">change proposed</span>}
      {editable && !locked && (
        <button type="button" className="sentence-edit" aria-label="Edit this sentence" onClick={() => onEditStart?.(segment)}>
          <Pencil size={13} aria-hidden="true" />
        </button>
      )}
    </span>
  );
}

export function DocumentView(props) {
  const {
    title,
    doc,
    citations = {},
    approval = 'none',
    approvedRevision,
    stats = { words: 0, wordLimit: 0, overLimit: false },
    limitSource,
    locked = false,
    activeFactId = null,
    changedSegmentIds = [],
    pendingSegmentIds = [],
    flashSegmentId = null,
    onCite = () => {},
    onEdit,
    lastRepair = null,
    receipts = [],
    mode = null,
    onReceipts = () => {},
    onPin = () => {},
    hintSeen = false,
    facts = [], suggestion = null, liveModel = false, suggestionBusy = false,
    onStrengthen, onAcceptSuggestion, onDismissSuggestion,
    peek = null,
    languageLine = null,
  } = props;

  // Editing only where the caller can save it (the guided walk-through is read-only).
  const editable = typeof onEdit === 'function';

  const [editingId, setEditingId] = useState(null);
  const [improvingId, setImprovingId] = useState(null);
  const manuscriptRef = useRef(null);

  const segments = doc.segments || [];
  const paragraphs = groupParagraphs(segments);
  const savedSuggestion = suggestion?.docId === doc.id ? suggestion : null;
  const currentSegment = segments.find((s) => s.id === (savedSuggestion?.segmentId ?? improvingId));
  const selected = currentSegment ?? (savedSuggestion ? { id: savedSuggestion.segmentId, text: savedSuggestion.before } : null);
  const finishSuggestion = () => {
    setImprovingId(null);
    const id = selected?.id;
    setTimeout(() => [...(manuscriptRef.current?.querySelectorAll('[data-segment]') ?? [])]
      .find((el) => el.dataset.segment === id)?.querySelector('.sentence-edit')?.focus(), 0);
  };
  const closeSuggestion = async () => {
    if (savedSuggestion && !await onDismissSuggestion?.(savedSuggestion.id)) return null;
    finishSuggestion();
    return true;
  };
  const acceptSuggestion = async () => {
    const result = await onAcceptSuggestion?.(savedSuggestion.id);
    if (result) finishSuggestion();
    return result;
  };

  const handleEditStart = (segment) => {
    if (!editable || locked || suggestion || improvingId) return;
    setEditingId(segment.id);
  };

  const handleEditCancel = () => {
    setEditingId(null);
  };

  const handleEditSave = async (segmentId, value) => {
    const saved = await onEdit(segmentId, value);
    if (saved) setEditingId(null);
  };

  const getSortedFactIds = (factIds) => {
    const ids = Array.isArray(factIds) ? [...factIds] : [];
    return ids.sort((a, b) => {
      const na = citations[a];
      const nb = citations[b];
      if (na == null && nb == null) return 0;
      if (na == null) return 1;
      if (nb == null) return -1;
      if (na === nb) return 0;
      return na < nb ? -1 : 1;
    });
  };

  const formatCorrectionDate = (iso) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    } catch {
      return iso;
    }
  };

  let correctionNotice = null;
  if (lastRepair) {
    const date = formatCorrectionDate(lastRepair.at);
    const factNumber = lastRepair.factNumber;
    const changed = lastRepair.changed;
    const kept = lastRepair.kept;
    const sentenceWord = changed === 1 ? 'sentence' : 'sentences';
    if (kept === 0 || kept === undefined || kept === null) {
      correctionNotice = (
        <p className="correction-notice">
          Corrected on {date}: fact [{factNumber}] changed; {changed} {sentenceWord} rewritten.
        </p>
      );
    } else {
      correctionNotice = (
        <p className="correction-notice">
          Corrected on {date}: fact [{factNumber}] changed; {changed} {sentenceWord} rewritten, {kept} kept as you wrote it.
        </p>
      );
    }
  }

  return (
    <article className="manuscript" ref={manuscriptRef} aria-labelledby={`doc-title-${doc.id}`}>
      <ManuscriptHead
        docId={doc.id}
        title={title}
        revision={doc.revision}
        stats={stats}
        approval={approval}
        approvedRevision={approvedRevision}
        segments={segments}
        receipts={receipts}
        mode={mode}
        onReceipts={onReceipts}
        hintSeen={hintSeen}
        correctionNotice={correctionNotice}
        languageLine={languageLine}
      />
      <div className="manuscript-body">
        {paragraphs.map((paragraph, pIdx) => {
          const showPeek = peek && paragraph.some((s) => s.id === peek.segmentId);
          return (
            <Fragment key={pIdx}>
              <p className="para">
                {paragraph.map((segment, sIdx) => {
                  if (editingId === segment.id) {
                    return (
                      <SentenceEditor
                        key={segment.id}
                        text={segment.text}
                        disabled={locked || suggestionBusy}
                        onSave={(value) => handleEditSave(segment.id, value)}
                        onCancel={handleEditCancel}
                        onImprove={segment.kind === 'claim' && onStrengthen ? () => { setEditingId(null); setImprovingId(segment.id); } : undefined}
                      />
                    );
                  }

                  const factIds = getSortedFactIds(segment.factIds);
                  const isChanged = Array.isArray(changedSegmentIds) && changedSegmentIds.includes(segment.id);
                  const isPending = Array.isArray(pendingSegmentIds) && pendingSegmentIds.includes(segment.id);
                  const isFlashing = flashSegmentId && segment.id === flashSegmentId;
                  const citesActive = Boolean(activeFactId) && factIds.includes(activeFactId);

                  return (
                    <span key={segment.id}>
                      {sIdx > 0 && ' '}
                      <Sentence
                        segment={segment}
                        factIds={factIds}
                        citations={citations}
                        activeFactId={activeFactId}
                        onCite={onCite}
                        onPin={onPin}
                        isChanged={isChanged}
                        isPending={isPending}
                        locked={locked || Boolean(suggestion) || Boolean(improvingId)}
                        onEditStart={handleEditStart}
                        isFlashing={isFlashing}
                        citesActive={citesActive}
                        editable={editable}
                      />
                    </span>
                  );
                })}
              </p>
              {showPeek ? peek.content : null}
            </Fragment>
          );
        })}
      </div>
      {selected && <SentenceSuggestion key={`${doc.id}:${selected.id}:${savedSuggestion?.id ?? 'request'}`}
        segment={selected} suggestion={savedSuggestion} facts={facts} citations={citations} liveModel={liveModel}
        busy={suggestionBusy} stale={Boolean(savedSuggestion && (!currentSegment || doc.revision !== savedSuggestion.baseDocRevision || selected.text !== savedSuggestion.before || (savedSuggestion.afterFactIds ?? []).some((id) => !facts.some((f) => f.id === id && f.status === 'confirmed'))))}
        onRequest={(request) => onStrengthen(selected.id, request)} onAccept={acceptSuggestion} onClose={closeSuggestion} onPin={onPin} />}
      {stats.overLimit && (
        <footer className="manuscript-foot">
          <p className="over-limit" role="status">
            {stats.words} words: {stats.words - stats.wordLimit} over the limit. Shorten it before you approve.
          </p>
        </footer>
      )}
    </article>
  );
}
