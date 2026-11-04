import './GuidedRun.css';
import { FactsPanel, QuestionPanel, ResumeButton } from './StepPanels.jsx';
import { StatusLine } from './TopBar.jsx';
import { FinishList, FinishSummary, NotesText } from './GuidedReview.jsx';
import { GuidedAnswer } from './GuidedAnswer.jsx';
import { GuidedChange } from './GuidedChange.jsx';
import { CheckedDrafts } from './WorkingState.jsx';
import { ConflictDecisions } from './ConflictDecisions.jsx';
import { docTitles } from '../lib/trail.js';
import { VerifyRun } from './VerifyRun.jsx';
import { CoverageLine } from './CoverageLine.jsx';

export function GuidedBody({ stepKey, workspace, view, busy, notice, modeLabel, sample, possessive = 'her', handlers = {}, voice, pending, receipts = [] }) {
  const {
    onDecideFact,
    onHoverFact,
    onConfirmFacts,
    onAnswer,
    onResolveSourceConflict,
    onSkip,
    onPrimary,
    onCite,
  } = handlers;

  let content = null;

  if (stepKey === 'notes') {
    content = (
      <div>
        <NotesText workspace={workspace} />
        {!busy && view?.next === 'read' && <ResumeButton id="read" label="Read the saved notes" onPrimary={onPrimary} />}
      </div>
    );
  } else if (stepKey === 'facts') {
    content = (
      <FactsPanel
        workspace={workspace}
        view={view}
        busy={busy}
        sample={sample}
        onDecideFact={onDecideFact}
        onHoverFact={onHoverFact}
        onConfirmFacts={onConfirmFacts}
      />
    );
  } else if (stepKey === 'question' || stepKey === 'check') {
    const facts = workspace?.applicant?.facts || [];
    const proposedFacts = facts.filter((f) => f.status === 'proposed');
    if (proposedFacts.length > 0) {
      content = (
        <FactsPanel
          workspace={workspace}
          view={view}
          busy={busy}
          sample={sample}
          onDecideFact={onDecideFact}
          onHoverFact={onHoverFact}
          onConfirmFacts={onConfirmFacts}
        />
      );
    } else {
      const hasOpenQuestion = (workspace?.application?.questions ?? []).some((q) => q.status === 'open');
      if (!busy && !hasOpenQuestion && ['read', 'check'].includes(view?.next)) {
        content = <ResumeButton id={view.next} label={view.next === 'read' ? 'Read the saved answer' : 'Check the saved facts'} onPrimary={onPrimary} />;
      } else {
        content = <QuestionPanel workspace={workspace} view={view} sample={sample} busy={busy} onAnswer={onAnswer} onSkip={onSkip} onResolveSourceConflict={onResolveSourceConflict} voice={voice} />;
      }
    }
  } else if (stepKey === 'decide') {
    content = <ConflictDecisions decisions={view?.conflictDecisions} busy={Boolean(busy)} onCorrect={handlers.onCorrectConflict} onSettle={handlers.onSettleConflict} />;
  } else if (stepKey === 'draft') {
    const facts = workspace?.applicant?.facts || [];
    const n = facts.filter((f) => f && f.status === 'confirmed').length;
    content = <p className="guided-ready">{n} confirmed facts are ready.</p>;
  } else if (stepKey === 'answer') {
    content = <GuidedAnswer workspace={workspace} view={view} busy={busy} possessive={possessive} receipts={receipts} onCite={onCite} onHoverFact={onHoverFact} />;
  } else if (stepKey === 'change') {
    content = <GuidedChange workspace={workspace} view={view} busy={busy} pending={pending} sample={sample} handlers={handlers} voice={voice} receipts={receipts} />;
  } else if (stepKey === 'finish') {
    content = (
      <div className="guided-finish">
        <FinishSummary workspace={workspace} view={view} receipts={receipts} />
        <CoverageLine view={view} />
        <button type="button" className="btn primary big guided-see" onClick={() => onPrimary?.({ id: 'export', label: 'Preview the export' })}>
          See the application
        </button>
        {(workspace?.application?.questions ?? []).some((q) => q.status === 'open') ? (
          <div className="guided-open-point">
            <p className="guided-expect">One point still needs {possessive === 'her' ? 'her' : 'you'}: answer it or skip it. Either way, the application lists any point that is not answered.</p>
            <QuestionPanel workspace={workspace} view={view} sample={sample} busy={busy} onAnswer={onAnswer} onSkip={onSkip} onResolveSourceConflict={onResolveSourceConflict} voice={voice} />
          </div>
        ) : null}
        <FinishList workspace={workspace} possessive={possessive} onReview={handlers.onReview} />
        <VerifyRun workspace={workspace} fixture={modeLabel === 'Fixture'} auto />
      </div>
    );
  }

  return (
    <div>
      {busy || notice ? <StatusLine busy={busy} notice={notice} modeLabel={modeLabel} onDismiss={handlers.onDismissNotice} titles={docTitles(workspace)} /> : null}
      <CheckedDrafts busy={busy} titles={docTitles(workspace)} />
      {content}
    </div>
  );
}
