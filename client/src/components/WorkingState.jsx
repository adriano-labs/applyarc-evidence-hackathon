import { useEffect, useState } from 'react';
import { tallyLine } from '../lib/trail.js';
import './WorkingState.css';

const NEXT = {
  draft: 'Next, review both drafts and their evidence.',
  read: 'Next, check the facts against your notes.',
  check: 'Next, answer any missing detail before drafting.',
  repair: 'Next, choose which changes to keep.',
  strengthen: 'Next, compare the suggestion with your original.',
  voice: 'Next, check the words before anything else happens.',
};

function useElapsed(started, enabled) {
  const [elapsed, setElapsed] = useState(0);
  const [visible, setVisible] = useState(() => document.visibilityState !== 'hidden');
  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  useEffect(() => {
    if (!enabled || !visible || typeof started !== 'number') return;
    const update = () => {
      const now = started > 1e12 ? Date.now() : performance.now();
      setElapsed(Math.max(0, Math.floor((now - started) / 1000)));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [started, enabled, visible]);
  return { elapsed, paused: !visible };
}

function retryText(retry, modeLabel) {
  if (!retry) return null;
  const name = modeLabel?.startsWith('Meta') ? 'Meta' : 'The model';
  return retry.injected
    ? `Injected for the demo: one 429 (${name} was not busy); trying again, ${retry.attempt} of ${retry.of}`
    : `${name} is busy; trying again, ${retry.attempt} of ${retry.of}`;
}

export function WorkingState({ busy, modeLabel }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { elapsed, paused } = useElapsed(busy?.started, detailsOpen);
  if (!busy) return null;
  const events = busy.history?.length ? busy.history.map((event) => event.label) : busy.tools ?? [];
  const history = events.slice(-3).filter((label) => label !== (busy.stage || busy.label));
  const retry = retryText(busy.retry, modeLabel);
  const tally = tallyLine(busy.toolCounts);
  return (
    <section className="working-state" data-paused={paused ? 'true' : 'false'}>
      <div className="working-stroke" aria-hidden="true" />
      <p className="working-current" role="status" aria-live="polite" aria-atomic="true">
        <span>{busy.stage || busy.label}</span>
        {retry && <span className="working-retry">{retry}</span>}
      </p>
      <p className="working-next">{NEXT[busy.name] || 'You can review the result when this step finishes.'}</p>
      {tally && <p className="working-tally">{tally}</p>}
      {history.length > 0 && <ol className="working-history" aria-label="Recent activity">
        {history.map((label, index) => <li key={index}>{label}</li>)}
      </ol>}
      <details className="working-details" onToggle={(event) => setDetailsOpen(event.currentTarget.open)}>
        <summary>Timing and stream details</summary>
        <p>Elapsed: {elapsed} s</p>
        {busy.chars > 0 && <p>{busy.chars.toLocaleString('en-GB')} characters received</p>}
      </details>
    </section>
  );
}

export function CheckedDraftPreview({ preview, title }) {
  if (!preview) return null;
  const text = preview.segments.map((segment, index) => `${index && segment.startsParagraph ? '\n\n' : index ? ' ' : ''}${segment.text}`).join('');
  return (
    <article className="checked-draft">
      <h3>{title ?? preview.title}</h3>
      <p className="checked-draft-state">Checked draft · waiting for the other document</p>
      <p className="checked-draft-notice">Not saved or ready to approve yet</p>
      <p className="checked-draft-text">{text}</p>
    </article>
  );
}

// titles: the form's own document titles, by id.
export function CheckedDrafts({ busy, titles }) {
  return Object.values(busy?.documentPreviews ?? {}).map((preview) => <CheckedDraftPreview key={preview.docId} preview={preview} title={titles?.[preview.docId]} />);
}
