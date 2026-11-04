// Guided walk-through frame: one step at a time, headline, one main button, and a step
// bar that opens any finished step as a read-only look back.
import { useEffect, useRef } from 'react';
import { ChevronLeft } from 'lucide-react';
import { demoLabel, pronouns, sourceKinds, unreadSource } from '../flow.js';
import { atKeyMoment } from '../lib/prepared.js';
import { drafter, family } from '../lib/trail.js';
import { reviewCopy } from './GuidedReview.jsx';
import { GuidedSteps, STEP_NAMES } from './GuidedSteps.jsx';
import { stepCopy } from './guidedCopy.js';
import './GuidedRun.css';

// Four core stages, the correction as the key moment, and the finish keep their existing IDs.
// `story` selects the correction after the drafts are written; a prepared workspace starts there.
export function guidedStep(view, ws, story) {
  if (ws?.application?.repair) return { n: 5, key: 'change' };
  const next = view?.next;
  if (atKeyMoment(ws, next)) return { n: 5, key: 'change' };
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

const firstNotes = (ws) => (ws?.applicant?.sources ?? []).find((s) => s.kind === 'notes');

// Facts found in the notes, whatever their status (the count the facts step announces).
function notesFactCount(ws) {
  const kinds = sourceKinds(ws);
  return (ws?.applicant?.facts ?? []).filter((f) => kinds[f.sourceId] === 'notes').length;
}

// Under the live step: write the answer (her application, for a sample in another language, as its
// headline says), then the key moment first, with review one click away.
function LiveActions({ stepKey, busy, p, what, onPrimary, onStory, onExit }) {
  if (stepKey === 'draft' && !busy) {
    return (
      <button type="button" className="btn primary big guided-main" onClick={() => onPrimary?.({ id: 'draft', label: 'Write both documents' })}>
        Write {p.possessive} {what}
      </button>
    );
  }
  if (stepKey !== 'answer') return null;
  return (
    <div className="guided-actions">
      <button type="button" className="btn primary big" disabled={Boolean(busy)} onClick={() => onStory?.('change')}>
        Next: correct one fact
      </button>
      <button type="button" className="btn big" disabled={Boolean(busy)} onClick={() => onExit?.()}>
        Review and finish
      </button>
    </div>
  );
}

// Under a look back: on to the next finished step, or back to the live one.
function ReviewAction({ reviewStep, live, stepKey, n, onReview }) {
  const forward = reviewStep + 1 < live;
  const label = forward ? `Next: ${STEP_NAMES[reviewStep]}` : live === 6 ? 'Return to the finish' : stepKey === 'change' ? 'Return to correction' : `Return to step ${n}`;
  return (
    <button type="button" className="btn primary big guided-main" onClick={() => onReview?.(forward ? reviewStep + 1 : null)}>
      {label}
    </button>
  );
}

// Moving between steps starts each one at the top of the page, as a new page would, and puts
// focus on its heading; not on first show. Returns the ref for the heading.
function useStepStart(stepId, reviewStep) {
  const shown = useRef(false);
  const headingRef = useRef(null);
  const prevStepRef = useRef(null);
  useEffect(() => {
    if (shown.current && document.scrollingElement) document.scrollingElement.scrollTop = 0;
    shown.current = true;
  }, [reviewStep]);
  useEffect(() => {
    if (prevStepRef.current !== null && prevStepRef.current !== stepId) headingRef.current?.focus?.();
    prevStepRef.current = stepId;
  }, [stepId]);
  return headingRef;
}

// `isMeta`: only a real Meta run may be credited to Meta; the fixture is "the app".
// `reviewStep`: the finished step being looked back at, or null for the live step.
// `copy`: a screen's own headline and why line (her spoken start), in place of the step's.
// `model`: the model this edition runs, for the key moment's words.
export function GuidedRun({ view, workspace, story, sampleName, isMeta = false, possessive = 'her', reviewStep = null, busy = null, receipts = [], copy = null, sample = null, voice = false, model, onPrimary, onStory, onReview, onExit, children }) {
  const { n, key } = guidedStep(view, workspace, story);
  const p = pronouns(possessive);
  const live = key === 'finish' ? 6 : n; // finish follows the key moment in history
  const at = reviewStep ?? live;
  const headingRef = useStepStart(reviewStep ?? key, reviewStep);
  // What drafted the documents: the receipts, or the prepared state's marker when they were drafted before this visit.
  const prepared = workspace?.prepared;
  const who = drafter(receipts) ?? (prepared ? family(prepared.model).tag : isMeta ? 'Meta' : 'The fixture');
  const c = copy ?? (reviewStep ? reviewCopy(reviewStep, workspace, sampleName, p) : stepCopy(key, { sampleName, possessive, isMeta, factCount: notesFactCount(workspace), busy, who, prepared, sample, voice, spoken: firstNotes(workspace)?.spoken === true, host: model }));

  return (
    <section className="guided">
      <div className="guided-top">
        {at > 1 ? (
          <button type="button" className="btn link small guided-back" onClick={() => onReview?.(at - 1)}>
            <ChevronLeft size={14} aria-hidden="true" />
            Back
          </button>
        ) : null}
        <button type="button" className="btn link small guided-exit" onClick={onExit} disabled={!onExit}>
          Open the full workspace
        </button>
      </div>
      <GuidedSteps live={live} reviewStep={reviewStep} lastRepair={workspace?.application?.lastRepair} stepKey={key} n={n} onReview={onReview} />
      {sample ? <p className="guided-demo">{demoLabel(sample, workspace)} · nothing is submitted</p> : null}
      <h1 ref={headingRef} tabIndex={-1}>{c.h1}</h1>
      <p className="guided-why">{c.why}</p>
      {c.expect ? <p className="guided-expect">{c.expect}</p> : null}
      <div className="guided-body">{children}</div>
      {reviewStep
        ? <ReviewAction reviewStep={reviewStep} live={live} stepKey={key} n={n} onReview={onReview} />
        : <LiveActions stepKey={key} busy={busy} p={p} what={sample?.language ? 'application' : 'answer'} onPrimary={onPrimary} onStory={onStory} onExit={onExit} />}
    </section>
  );
}
