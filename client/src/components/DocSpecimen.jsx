import './DocSpecimen.css';
import { LABELS } from './StepGuide.jsx';

export function DocSpecimen({ docId, title, company, wordLimit, limitSource, step, onGo }) {
  const meta =
    limitSource === 'guide'
      ? `Not written yet · about ${wordLimit} words (a guide; the form sets no limit)`
      : `Not written yet · up to ${wordLimit} words`;

  const bodyLine =
    docId === 'letter'
      ? `This becomes your cover letter. Each factual claim will cite a fact you confirmed, like this:`
      : `This becomes your answer to ${company}’s question. Each factual claim will cite a fact you confirmed, like this:`;

  let stepLine = null;
  let stepButton = null;
  if (step < 4) {
    stepLine = `You are on step ${step} of 6. Writing starts at step 4.`;
    if (onGo) {
      const label = LABELS[step - 1];
      stepButton = (
        <button type="button" className="btn" onClick={onGo}>
          Go to step {step}: {label}
        </button>
      );
    }
  } else {
    stepLine = 'Step 4 of 6: the button below writes both documents.';
  }

  return (
    <article className="manuscript doc-specimen">
      <h2>{title}</h2>
      <p className="manuscript-meta">{meta}</p>
      <p>{bodyLine}</p>
      <h3>Example</h3>
      <div className="specimen-example">
        <p className="specimen-sentence">
          Our team built a self-service GPU job runner for the department’s teaching cluster.
          <sup className="specimen-cite">1</sup>
        </p>
        <div className="specimen-ref">
          <div className="specimen-ref-number">1</div>
          <p className="specimen-quote">
            “<mark>We built a self-service GPU job runner for the department's machine learning teaching cluster.</mark>”
          </p>
          <div className="specimen-from">Illustrative notes — not your submitted evidence</div>
        </div>
      </div>
      {stepLine ? <p className="step-line">{stepLine}</p> : null}
      {stepButton ? <div className="step-actions">{stepButton}</div> : null}
    </article>
  );
}
