import './FormPanel.css';
import {
  CheckCircle2,
  Circle,
  MessageCircleQuestion,
  MinusCircle,
} from 'lucide-react';
import { useState } from 'react';

function getRequirementState(requirement, questions) {
  if (requirement.covered) {
    return { state: 'covered', label: 'Covered' };
  }
  if (requirement.needsReview) {
    return { state: 'review', label: 'Needs review: a fact it relied on changed' };
  }

  const question = questions.find((q) => q.requirementId === requirement.id);
  if (question) {
    if (question.status === 'open') {
      return { state: 'asked', label: 'Asked you' };
    }
    if (question.status === 'skipped') {
      return { state: 'skipped', label: 'Left out' };
    }
  }

  return { state: 'missing', label: 'Needs your detail' };
}

function getRequirementIcon(state, size = 16) {
  if (state === 'covered') {
    return <CheckCircle2 size={size} aria-hidden="true" />;
  }
  if (state === 'asked') {
    return <MessageCircleQuestion size={size} aria-hidden="true" />;
  }
  if (state === 'skipped') {
    return <MinusCircle size={size} aria-hidden="true" />;
  }
  return <Circle size={size} aria-hidden="true" />;
}

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function lowerFirst(str) {
  if (!str) return str;
  return str.charAt(0).toLowerCase() + str.slice(1);
}

export function FormPanel({
  company,
  formDoc = {},
  coverage = [],
  questions = [],
  citations = {},
  activeFactId,
  onCite,
  portalTasks = [],
  snapshot = {},
}) {
  const [open, setOpen] = useState(false);

  const title = formDoc.title || '';
  const wordLimit = formDoc.wordLimit;
  const limitSource = formDoc.limitSource;

  const total = coverage.length;
  const coveredCount = coverage.filter((c) => c.covered).length;

  // Check if there's an open question for any requirement
  const openQuestion = questions.find((q) => q.status === 'open');
  let summary;
  if (openQuestion) {
    const req = coverage.find((c) => c.id === openQuestion.requirementId);
    if (req) {
      const askingText = lowerFirst(req.text);
      if (limitSource === 'guide') {
        summary = `${company} · ${title.toLowerCase()}, about ${wordLimit} words (a guide) · Asking you: ${askingText}`;
      } else {
        summary = `${company} · ${title.toLowerCase()}, up to ${wordLimit} words · Asking you: ${askingText}`;
      }
    } else {
      if (limitSource === 'guide') {
        summary = `${company} · ${title.toLowerCase()}, about ${wordLimit} words (a guide) · ${coveredCount} of ${total} covered`;
      } else {
        summary = `${company} · ${title.toLowerCase()}, up to ${wordLimit} words · ${coveredCount} of ${total} covered`;
      }
    }
  } else {
    if (limitSource === 'guide') {
      summary = `${company} · ${title.toLowerCase()}, about ${wordLimit} words (a guide) · ${coveredCount} of ${total} covered`;
    } else {
      summary = `${company} · ${title.toLowerCase()}, up to ${wordLimit} words · ${coveredCount} of ${total} covered`;
    }
  }

  const portalText = () => {
    if (snapshot?.source === 'applicant-pasted') return null;
    if (!portalTasks || portalTasks.length === 0) return null;
    if (portalTasks.length === 1) {
      return '1 thing to do on the employer’s site is listed in your export.';
    }
    return `${portalTasks.length} things to do on the employer’s site are listed in your export.`;
  };

  return (
    <aside className="form-panel" data-open={open} aria-label="What the employer asks">
      <div className="strip-row">
        <p className="brief-summary">{summary}</p>
        <button
          type="button"
          className="btn-link"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Hide the question' : 'Show the question'}
        </button>
      </div>
      <div className="brief-body">
        <h2>{formDoc.required === false ? 'Optional cover letter' : `What ${company} asks`}</h2>
        {formDoc.required === false && <p>This letter is optional; whether the employer needs it has not been checked.</p>}
        <blockquote className="form-question">{formDoc.question}</blockquote>

        <h3>{formDoc.required === false ? 'What we include' : 'What it asks for'}</h3>
        <ul className="requirements">
          {coverage.map((requirement) => {
            const { state } = getRequirementState(requirement, questions);
            const factEntries = (requirement.factIds || [])
              .filter((factId) => citations && citations[factId] !== undefined)
              .map((factId) => ({ factId, n: citations[factId] }))
              .sort((a, b) => a.n - b.n);

            return (
              <li
                key={requirement.id}
                className={'req ' + state}
                data-state={state}
              >
                {getRequirementIcon(state, 16)}
                <span className="req-text">{requirement.text}</span>
                {factEntries.length > 0 && (
                  <span className="req-cites">
                    [{factEntries.map((entry, i) => (
                      <span key={entry.factId}>
                        {i > 0 && ', '}
                        <button
                          type="button"
                          className="cite"
                          aria-label={`Evidence ${entry.n}`}
                          data-active={activeFactId === entry.factId ? 'true' : undefined}
                          onMouseEnter={() => onCite?.(entry.factId)}
                          onFocus={() => onCite?.(entry.factId)}
                          onMouseLeave={() => onCite?.(null)}
                          onBlur={() => onCite?.(null)}
                        >
                          {entry.n}
                        </button>
                      </span>
                    ))}]
                  </span>
                )}
                {state === 'asked' && (
                  <span className="req-state">Asked you</span>
                )}
                {state === 'review' && (
                  <span className="req-state">Needs review: a fact it relied on changed</span>
                )}
                {state === 'skipped' && (
                  <span className="req-state">Left out</span>
                )}
                {state === 'missing' && (
                  <span className="visually-hidden">not covered yet</span>
                )}
              </li>
            );
          })}
        </ul>

        {portalText() && <p className="brief-portal">{portalText()}</p>}

        {snapshot?.source === 'applicant-pasted' && <p className="form-source">Pasted and confirmed by you. The complete employer form and remaining steps have not been checked.</p>}
        {snapshot?.source === 'applicant-pasted' && formDoc.limitSource === 'applicant' && <p className="form-source">The word limit was entered by you from the employer’s question.</p>}
        {snapshot && snapshot.url && snapshot.source !== 'applicant-pasted' && (
          <p className="form-source">
            <a
              href={snapshot.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {company} form, snapshot of {formatDate(snapshot.fetchedAt)}
            </a>
          </p>
        )}
      </div>
    </aside>
  );
}
