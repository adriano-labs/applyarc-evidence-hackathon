// Guided walk-through frame: one step at a time, headline, one main button, and a step
// bar that opens any finished step as a read-only look back.
import { useEffect, useRef } from 'react';
import { Check, ChevronLeft } from 'lucide-react';
import { pronouns, sourceKinds, unreadSource } from '../flow.js';
import { STEP_LABELS, reviewCopy } from './GuidedReview.jsx';
import './GuidedRun.css';

// Which of the five guided steps the workspace is on. `story` is the walk-through's
// own step once the drafts are written ('change' after "Next: change a fact").
export function guidedStep(view, ws, story) {
  if (ws?.application?.repair) return { n: 5, key: 'change' };
  const next = view?.next;
  if (next === 'export') return { n: 5, key: 'finish' };
  if (story === 'change') return { n: 5, key: 'change' };
  if (next === 'approve') return { n: 4, key: 'answer' };
  if (next === 'draft') return { n: 3, key: 'draft' };
  if (next === 'check') return { n: 3, key: 'check' };
  if (next === 'question') return { n: 3, key: 'question' };
  if (next === 'decide') return { n: 3, key: 'decide' };
  // Reading her answer to the question still belongs to step 3.
  if (next === 'read' && unreadSource(ws)?.kind === 'answer') return { n: 3, key: 'question' };
  if (next === 'facts') {
    const kinds = sourceKinds(ws);
    const fromAnswer = (ws?.applicant?.facts ?? []).some((f) => f.status === 'proposed' && kinds[f.sourceId] === 'answer');
    return fromAnswer ? { n: 3, key: 'question' } : { n: 2, key: 'facts' };
  }
  return { n: 1, key: 'notes' };
}


// Facts found in the notes, whatever their status (the count the facts step announces).
function notesFactCount(ws) {
  const kinds = sourceKinds(ws);
  return (ws?.applicant?.facts ?? []).filter((f) => kinds[f.sourceId] === 'notes').length;
}

// `isMeta`: only a real Meta run may be credited to Meta; the fixture is "the app".
// `reviewStep`: the finished step being looked back at, or null for the live step.
export function GuidedRun({ view, workspace, story, sampleName, isMeta = false, possessive = 'her', reviewStep = null, busy = null, onPrimary, onStory, onReview, onExit, children }) {
  const { n, key } = guidedStep(view, workspace, story);
  const N = notesFactCount(workspace);
  const p = pronouns(possessive);
  const live = key === 'finish' ? 6 : n; // the finish comes after step 5
  const at = reviewStep ?? live;
  const forward = Boolean(reviewStep) && reviewStep + 1 < live;

  // Moving between steps starts each one at the top of the page, as a new page would; not on first show.
  const shown = useRef(false);
  const headingRef = useRef(null);
  const prevStepRef = useRef(null);
  useEffect(() => {
    if (shown.current && document.scrollingElement) document.scrollingElement.scrollTop = 0;
    shown.current = true;
  }, [reviewStep]);

  useEffect(() => {
    const stepId = reviewStep ?? key;
    if (prevStepRef.current !== null && prevStepRef.current !== stepId) {
      headingRef.current?.focus?.();
    }
    prevStepRef.current = stepId;
  }, [reviewStep, key]);

  const copy = {
    notes: {
      h1: `These are ${sampleName}’s rough notes`,
      why: `${isMeta ? 'Meta reads' : 'The app reads'} them and keeps every fact tied to ${p.possessive} exact words.`,
    },
    facts: {
      h1: `${isMeta ? 'Meta found' : 'Found'} ${N} facts in ${sampleName}’s own words`,
      why: `Check each one is right. Only facts you confirm can be used in ${p.possessive} answer.`,
    },
    check: {
      h1: 'Checking what the form still needs',
      why: `The app compares ${p.possessive} facts with what the form asks for, and asks only if something is missing.`,
    },
    question: {
      h1: `One thing ${p.possessive} notes don’t say`,
      why: `The form asks what ${p.subject} did ${p.reflexive}, so the app asks ${p.object} once.`,
    },
    decide: {
      h1: 'Is this earlier fact still right?',
      why: `${p.Possessive} answer was about a fact from ${p.possessive} notes. Keep it, correct it or remove it before the drafts are written.`,
    },
    draft: {
      h1: busy?.name === 'draft' ? `Writing ${p.possessive} application` : `Ready to write ${p.possessive} answer`,
      why: 'Every sentence will cite the facts it uses.',
    },
    answer: {
      h1: `${p.Possessive} answer, with evidence beside it`,
      why: 'Tap a number to see the words it came from.',
    },
    change: {
      h1: 'Facts change. Watch what happens.',
      why: 'Correct one fact and only the sentences that used it are rewritten.',
    },
    finish: {
      h1: 'Done: two documents you can stand behind',
      why: 'Nothing has been sent. Copy them into the employer’s form yourself.',
    },
  };

  const c = reviewStep ? reviewCopy(reviewStep, workspace, sampleName, p) : copy[key] || copy.notes;


  return (
    <section className="guided">
      <div className="guided-top">
        {at > 1 ? (
          <button type="button" className="btn link small guided-back" onClick={() => onReview?.(at - 1)}>
            <ChevronLeft size={14} aria-hidden="true" />
            Back
          </button>
        ) : null}
        <button type="button" className="btn link small guided-exit" onClick={onExit}>
          Open the full workspace
        </button>
      </div>
      <ol className="guided-steps" aria-label="Steps">
        {STEP_LABELS.map((label, i) => {
          const s = i + 1;
          const done = s < live;
          const current = s === live;
          const cls = `guided-step${done ? ' done' : ''}${s === reviewStep ? ' viewing' : ''}`;
          const inner = (
            <>
              <span className="guided-step-mark" aria-hidden="true">{done ? <Check size={12} /> : s}</span>
              <span className="guided-step-label">{label}</span>
            </>
          );
          return (
            <li key={label}>
              {done || (current && reviewStep) ? (
                <button type="button" className={cls} aria-current={current ? 'step' : undefined} onClick={() => onReview?.(done ? s : null)}>
                  {inner}
                </button>
              ) : (
                <span className={cls} aria-current={current ? 'step' : undefined}>
                  {inner}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <p className="guided-step-text">{reviewStep ? `Looking back at step ${reviewStep} of 5` : key === 'finish' ? 'All 5 steps done' : `Step ${n} of 5`}</p>
      <h1 ref={headingRef} tabIndex={-1}>{c.h1}</h1>
      <p className="guided-why">{c.why}</p>
      <div className="guided-body">{children}</div>
      {reviewStep ? (
        <button type="button" className="btn primary big guided-main" onClick={() => onReview?.(forward ? reviewStep + 1 : null)}>
          {forward ? `Next: ${STEP_LABELS[reviewStep]}` : live === 6 ? 'Return to the finish' : `Return to step ${n}`}
        </button>
      ) : null}
      {!reviewStep && key === 'draft' ? (
        <button type="button" className="btn primary big guided-main" disabled={Boolean(busy)} onClick={() => onPrimary && onPrimary({ id: 'draft', label: 'Write both documents' })}>
          Write {p.possessive} answer
        </button>
      ) : null}
      {!reviewStep && key === 'answer' ? (
        <button type="button" className="btn primary big guided-main" disabled={Boolean(busy)} onClick={() => onStory && onStory('change')}>
          Next: change a fact
        </button>
      ) : null}
    </section>
  );
}
