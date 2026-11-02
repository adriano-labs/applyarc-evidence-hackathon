// Where am I: the six steps of an application, the current one marked and what
// waits on the applicant counted once. Driven only by view.next and the workspace.
import { CheckCircle2, ChevronRight } from 'lucide-react';
import { sourceKinds, unreadSource } from '../flow.js';
import './StepGuide.css';

export const LABELS = ['Notes', 'Facts', 'Question', 'Drafts', 'Approve', 'Export'];
const STEP_OF = { notes: 1, read: 1, facts: 2, question: 3, decide: 3, check: 3, draft: 4, approve: 5, repair: 5, 'repair-proposal': 5, export: 6 };

function stepOf(view, ws, fromAnswer) {
  const next = view?.next;
  // Reading the applicant's answer and checking its facts still belong to the question step.
  if ((next === 'read' && unreadSource(ws)?.kind === 'answer') || (next === 'facts' && fromAnswer)) return 3;
  return STEP_OF[next] ?? 1;
}

function detailOf(step, view, ws, proposed, fromAnswer) {
  const app = ws?.application ?? {};
  if (step === 2) return { needs: true, text: `${proposed.length} to check` };
  if (step === 3 && fromAnswer) return { needs: true, text: `${proposed.length} from your answer` };
  if (step === 3 && app.questions?.some((q) => q.status === 'open')) return { needs: true, text: '1 to answer' };
  if (step === 5 && app.repair) {
    const items = app.repair.items ?? [];
    const waiting = items.filter((i) => i.status !== 'proposed' && i.decision == null).length;
    return waiting ? { needs: true, text: `${waiting} needs you` } : { needs: false, text: `${items.length} to apply` };
  }
  if (step === 5 && view?.next === 'approve') {
    const docs = app.form?.documents ?? [];
    return { needs: false, text: `${docs.filter((d) => app.approvals?.[d.id]).length} of ${docs.length} approved` };
  }
  return null;
}

export function currentStep(view, ws) {
  const kinds = sourceKinds(ws);
  const proposed = (ws?.applicant?.facts ?? []).filter((f) => f.status === 'proposed');
  const fromAnswer = proposed.some((f) => kinds[f.sourceId] === 'answer');
  const step = stepOf(view, ws, fromAnswer);
  return { step, proposed, fromAnswer };
}

export function StepGuide({ view, workspace: ws }) {
  const { step: current, proposed, fromAnswer } = currentStep(view, ws);
  const exported = (ws?.application?.exports ?? []).length > 0;
  const label = (n) => (n === 5 && ws?.application?.repair ? 'Review changes' : LABELS[n - 1]);
  const detail = detailOf(current, view, ws, proposed, fromAnswer);
  return (
    <nav className="step-guide" aria-label="Steps">
      <ol aria-label="Progress">
        {LABELS.map((_, i) => {
          const n = i + 1;
          const done = n < current || (n === 6 && exported);
          return (
            <li key={n} className={`step${done ? ' done' : ''}${n === current ? ' current' : ''}`} aria-current={n === current ? 'step' : undefined}>
              {done ? <CheckCircle2 size={14} className="step-num done" aria-hidden="true" /> : <span className="step-num">{n}</span>}
              <span className="step-label">{label(n)}</span>
              {n === current && detail ? <span className={`step-detail${detail.needs ? ' chip-needs' : ''}`}>{detail.text}</span> : null}
              {n < 6 ? <ChevronRight size={12} className="step-sep" aria-hidden="true" /> : null}
            </li>
          );
        })}
      </ol>
      <p className="step-phone">{[`Step ${current} of 6`, label(current), detail?.text].filter(Boolean).join(' · ')}</p>
    </nav>
  );
}
