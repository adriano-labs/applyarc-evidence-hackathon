import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { diffLines } from '../lib/diff.js';
import './ChangeQueue.css';

export function ChangeQueue({
  repair,
  fact,
  number,
  docTitles,
  busy,
  pending,
  onDecide,
  onApply,
  onShow,
  onPropose,
  onCancel,
  untouchedCount,
}) {
  const items = repair?.items ?? [];
  const needs = items.filter((item) => item.status !== 'proposed' && item.decision == null).length;
  const n = items.length;

  const isRecovering = busy?.name === 'recover';
  const isRepairBusy = busy?.name === 'repair';
  const isBusy = Boolean(busy) || Boolean(pending);
  const waiting = repair?.status !== 'review';
  const previous = fact?.history?.at?.(-1)?.statement;
  const sectionRef = useRef(null);
  const [focus, setFocus] = useState(0);
  const [openWrite, setOpenWrite] = useState({});

  const docCount = new Set(items.map((item) => item.docId)).size;

  useEffect(() => {
    if (focus < 0) setFocus(0);
    if (focus >= items.length && items.length > 0) setFocus(items.length - 1);
    if (items.length === 0) setFocus(0);
  }, [focus, items.length]);

  const handleKeyDown = (e) => {
    if (e.target && e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'j' || e.key === 'ArrowDown') {
      e.preventDefault();
      setFocus((f) => Math.min(items.length - 1, f + 1));
      return;
    }
    if (e.key === 'k' || e.key === 'ArrowUp') {
      e.preventDefault();
      setFocus((f) => Math.max(0, f - 1));
      return;
    }
    if (isBusy) {
      return;
    }
    if (e.key === 'y') {
      const item = items[focus];
      if (item && item.after) {
        e.preventDefault();
        onDecide?.(item.id, 'take');
      }
      return;
    }
    if (e.key === 'n') {
      const item = items[focus];
      if (item) {
        e.preventDefault();
        onDecide?.(item.id, 'keep');
      }
      return;
    }
  };

  const toggleWrite = (itemId) => {
    if (isBusy) return;
    setOpenWrite((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const submitWrite = async (itemId) => {
    if (isBusy) return;
    const textarea = sectionRef.current?.querySelector(`[data-write="${itemId}"] textarea`);
    const value = textarea?.value ?? '';
    const saved = await onDecide?.(itemId, 'write', value);
    if (saved && textarea?.value === value) {
      setOpenWrite((prev) => ({ ...prev, [itemId]: false }));
    }
  };

  const getChip = (item) => {
    if (item.decision === 'take') return { cls: 'decided', text: 'Taking the rewrite' };
    if (item.decision === 'keep') return { cls: 'decided', text: 'Keeping it' };
    if (item.decision === 'write') return { cls: 'decided', text: 'Your wording' };
    if (item.status === 'proposed') return { cls: 'proposed', text: 'Proposed' };
    if (item.status === 'conflict') return { cls: 'needs', text: 'Needs you' };
    if (item.status === 'needs-review') return { cls: 'needs', text: 'Needs review' };
    if (item.status === 'pending') return { cls: 'waiting', text: 'Waiting' };
    return { cls: item.status, text: item.status };
  };

  const isTakeChecked = (item) => {
    if (item.decision === 'take') return true;
    if (item.decision == null && item.status === 'proposed') return true;
    return false;
  };
  const isKeepChecked = (item) => item.decision === 'keep';
  const isWriteChecked = (item) => item.decision === 'write';

  const applyDisabled = isBusy || needs > 0 || repair?.status !== 'review';

  // A sentence as one line, its changed runs marked with `Mark` (del or ins).
  const line = (kind, label, runs, Mark) => (
    <p className={`queue-line queue-${kind}`}>
      <span className="queue-line-label">{label}</span>
      <span className="queue-line-text">{runs.map((r, k) => (r.changed ? <Mark key={k}>{r.text}</Mark> : <span key={k}>{r.text}</span>))}</span>
    </p>
  );

  const renderItemDiff = (item) => {
    const selected = item.decision === 'write' ? item.written : item.decision === 'keep' ? item.before : item.after;
    if (waiting || !selected) {
      return (
        <>
          {line('was', 'Was', [{ text: item.before, changed: false }], 'del')}
          {waiting ? null : <span className="queue-none">{item.reason || 'No rewrite proposed.'} Keep it only if you can stand behind it, or write your own.</span>}
        </>
      );
    }
    const { was, now } = diffLines(item.before, selected);
    return (
      <div className="queue-diff-pair">
        {line('was', 'Was', was, 'del')}
        {line('now', item.decision === 'write' ? 'Your wording' : 'Now', now, 'ins')}
      </div>
    );
  };

  // "Correcting [3] reopened the 2 sentences that cite it: 1 in the project answer, 1 in the cover letter. …"
  const buildSummary = () => {
    const reopen = n === 1 ? 'the 1 sentence that cites it' : `the ${n} sentences that cite it`;
    if (waiting) return `Correcting [${number}] reopens ${reopen}.${isBusy ? '' : ' Waiting for the rewrite.'}`;
    const where = Object.entries(docTitles ?? {})
      .map(([docId, title]) => [items.filter((it) => it.docId === docId).length, title.toLowerCase()])
      .filter(([count]) => count > 0)
      .map(([count, title]) => `${count} in the ${title}`)
      .join(', ');
    const rest = typeof untouchedCount !== 'number' ? '' : ` The other ${untouchedCount} ${untouchedCount === 1 ? 'sentence is' : 'sentences are'} untouched.`;
    return `Correcting [${number}] reopened ${reopen}: ${where}.${rest}`;
  };

  const showNeedsChip = !waiting && needs > 0;

  return (
    <section className="queue" aria-labelledby="queue-title" tabIndex={-1} onKeyDown={waiting ? undefined : handleKeyDown} ref={sectionRef}>
      <header className="queue-head">
        <div className="queue-title-row">
          <h2 id="queue-title">What changed</h2>
          <button type="button" className="btn link small queue-undo" disabled={isBusy} onClick={() => { if (isBusy) return; onCancel?.(); }}>
            Undo this correction
          </button>
        </div>
        <p className="queue-fact">
          <span className="queue-ref">[{number}]</span>
          {previous ? <del>{previous}</del> : null}
          {previous ? ' ' : null}
          <ins>{fact?.statement}</ins>
        </p>
        <div className="queue-impact" role="group" aria-label="Correction impact">
          <span className="queue-impact-item">{docCount === 1 ? '1 document' : `${docCount} documents`}</span>
          {waiting ? (
            <span className="queue-impact-item">{n === 1 ? '1 sentence affected' : `${n} sentences affected`}</span>
          ) : (
            <span className="queue-impact-item">{n === 1 ? '1 sentence to review' : `${n} sentences to review`}</span>
          )}
          {typeof untouchedCount === 'number' ? (
            <span className="queue-impact-item">{untouchedCount} untouched</span>
          ) : null}
        </div>
        <p className="queue-summary visually-hidden" role="status">{buildSummary()}</p>
        {showNeedsChip ? (
          <span className="chip needs chip-needs">{needs === 1 ? '1 needs you' : `${needs} need you`}</span>
        ) : null}
      </header>

      {isRecovering ? <p className="queue-busy" aria-live="polite">Checking saved changes…</p> : null}
      {!isRecovering && pending ? <p className="queue-busy" aria-live="polite">Saving your changes…</p> : null}
      {!isRecovering && !pending && isRepairBusy ? <p className="queue-busy" aria-live="polite">Rewriting the sentences that cite this fact…</p> : null}

      {waiting && !isBusy ? (
        <div className="queue-waiting">
          <p>The rewrite has not arrived yet.</p>
          <button type="button" className="btn small primary" onClick={() => onPropose?.()}>
            Propose the changes
          </button>
        </div>
      ) : null}

      <ol className="queue-items">
        {items.map((item, i) => {
          const chip = waiting ? { cls: 'waiting', text: 'Waiting' } : getChip(item);
          const takeChecked = isTakeChecked(item);
          const keepChecked = isKeepChecked(item);
          const writeChecked = isWriteChecked(item);
          return (
            <li
              key={item.id}
              className={'queue-item ' + item.status}
              data-focused={i === focus}
              onFocus={() => { if (!waiting) setFocus(i); }} // y and n act on the item the keyboard is in
            >
              <div className="queue-item-head">
                <span className="doc-name">{docTitles?.[item.docId]} · cites [{number}]</span>
                <span className={'chip ' + chip.cls}>{chip.text}</span>
              </div>

              {renderItemDiff(item)}

              {!waiting && item.status === 'conflict' ? (
                <p className="queue-note">You edited this sentence. Fact [{number}] now says: “{fact?.statement}” Keeping yours removes its citation to [{number}].</p>
              ) : null}

              {!waiting ? (
                <div className="queue-choices" role="radiogroup" aria-label="Choice for this change">
                  {item.after ? (
                    <button type="button" role="radio" aria-checked={takeChecked} className="btn small" disabled={isBusy} onClick={() => { if (isBusy) return; onDecide?.(item.id, 'take'); }}>
                      {takeChecked ? <Check size={14} aria-hidden="true" /> : null}
                      Take the rewrite
                    </button>
                  ) : null}
                  <button type="button" role="radio" aria-checked={keepChecked} className="btn small" disabled={isBusy} onClick={() => { if (isBusy) return; onDecide?.(item.id, 'keep'); }}>
                    {keepChecked ? <Check size={14} aria-hidden="true" /> : null}
                    {item.status === 'conflict' ? 'Keep mine' : 'Keep as is'}
                  </button>
                  <button type="button" role="radio" aria-checked={writeChecked} className="btn small" disabled={isBusy} onClick={() => toggleWrite(item.id)}>
                    {writeChecked ? <Check size={14} aria-hidden="true" /> : null}
                    Write my own
                  </button>
                </div>
              ) : null}

              {!waiting && openWrite[item.id] ? (
                <form data-write={item.id} onSubmit={(event) => { event.preventDefault(); void submitWrite(item.id); }}>
                  <textarea aria-label="Your wording" disabled={isBusy} defaultValue={item.written ?? item.after ?? item.before}></textarea>
                  <button type="submit" className="btn small primary" disabled={isBusy}>Use my wording</button>
                </form>
              ) : null}

              {onShow ? (
                <button type="button" className="btn link small queue-show" onClick={() => onShow(item.docId, item.segmentId)}>
                  {item.docId === 'letter' ? 'Show in the cover letter' : 'Show in the project answer'}
                  <ArrowRight size={12} aria-hidden="true" />
                </button>
              ) : null}
            </li>
          );
        })}
      </ol>

      <footer className="queue-foot">
        <button type="button" className="btn primary" disabled={applyDisabled} onClick={() => { if (isBusy) return; onApply?.(); }}>
          {n === 1 ? 'Apply 1 change' : `Apply ${n} changes`}
        </button>
        {!waiting && needs > 0 ? <p className="queue-hint">Decide {needs} more first.</p> : null}
      </footer>
    </section>
  );
}
