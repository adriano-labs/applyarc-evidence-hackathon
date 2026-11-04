// The walk-through's step bar: four numbered stages, the correction as the key moment, and a
// line saying where you are. Finished steps open as a read-only look back; the step ids stay.
import { Check } from 'lucide-react';
import { STEP_LABELS } from './GuidedReview.jsx';

export const KEY_STEP = 5;
export const STEP_NAMES = [...STEP_LABELS.slice(0, KEY_STEP - 1), 'Correct a fact'];

export function stepText({ reviewStep, stepKey, n }) {
  if (reviewStep) return reviewStep === KEY_STEP ? 'Looking back: the correction' : `Looking back at step ${reviewStep} of 4`;
  if (stepKey === 'finish') return 'Ready to export';
  if (stepKey === 'change') return 'Key moment: correct a fact';
  return `Step ${n} of 4`;
}

// The key moment carries no number and is done only once a correction was saved.
function Step({ s, live, reviewStep, lastRepair, onReview }) {
  const keyMoment = s === KEY_STEP;
  const available = s < live;
  const done = available && (!keyMoment || Boolean(lastRepair));
  const current = s === live;
  const cls = `guided-step${keyMoment ? ' guided-step-key' : ''}${done ? ' done' : ''}${s === reviewStep ? ' viewing' : ''}`;
  const inner = (
    <>
      {!keyMoment || done ? <span className="guided-step-mark" aria-hidden="true">{done ? <Check size={12} /> : s}</span> : null}
      <span className="guided-step-copy">
        <span className="guided-step-label">{STEP_NAMES[s - 1]}</span>
        {keyMoment ? <span className="guided-step-tag">Key moment</span> : null}
      </span>
    </>
  );
  if (available || (current && reviewStep)) {
    return <button type="button" className={cls} aria-current={current ? 'step' : undefined} onClick={() => onReview?.(available ? s : null)}>{inner}</button>;
  }
  return <span className={cls} aria-current={current ? 'step' : undefined}>{inner}</span>;
}

export function GuidedSteps({ live, reviewStep, lastRepair, stepKey, n, onReview }) {
  return (
    <>
      <ol className="guided-steps" aria-label="Steps">
        {STEP_NAMES.map((name, i) => (
          <li key={name}><Step s={i + 1} live={live} reviewStep={reviewStep} lastRepair={lastRepair} onReview={onReview} /></li>
        ))}
      </ol>
      <p className="guided-step-text">{stepText({ reviewStep, stepKey, n })}</p>
    </>
  );
}
