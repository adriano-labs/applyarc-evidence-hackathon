import './GuidedRun.css';
import { FactsPanel, QuestionPanel } from './StepPanels.jsx';
import { StatusLine } from './TopBar.jsx';
import { ChangeQueue } from './ChangeQueue.jsx';
import { untouchedCount, matchesSampleCorrection } from '../flow.js';
import { ChangedLine, Compare, FinishList, NotesText } from './GuidedReview.jsx';
import { GuidedAnswer } from './GuidedAnswer.jsx';
import { CheckedDrafts } from './WorkingState.jsx';
import { ConflictDecisions } from './ConflictDecisions.jsx';

// One approve button per document not yet approved, at its exact version.
function ApproveButtons({ workspace, view, onApprove, busy, pending }) {
  const approvals = view?.approvals ?? {};
  const isLocked = Boolean(busy) || Boolean(pending);
  return (
    <div className="guided-actions">
      {(workspace?.application?.form?.documents ?? []).filter((d) => approvals[d.id] !== 'approved').map((d) => {
        const revision = workspace?.application?.documents?.[d.id]?.revision;
        return (
          <button key={d.id} type="button" className="btn primary" disabled={isLocked} onClick={() => { if (isLocked) return; onApprove?.(d.id, revision); }}>
            Approve the {(d.title || '').toLowerCase()}, version {revision}
          </button>
        );
      })}
    </div>
  );
}

function ResumeButton({ id, label, onPrimary }) {
  return <div className="guided-actions"><button type="button" className="btn primary" onClick={() => onPrimary?.({ id })}>{label}</button></div>;
}

export function GuidedBody({ stepKey, workspace, view, busy, notice, modeLabel, sample, possessive = 'her', handlers = {}, voice, pending }) {
  const {
    onDecideFact,
    onHoverFact,
    onConfirmFacts,
    onAnswer,
    onResolveSourceConflict,
    onSkip,
    onCorrectFact,
    onDecideChange,
    onApplyChanges,
    onApprove,
    onPrimary,
    onCite,
    onCancelRepair,
    onProposeRepair,
  } = handlers;

  const isLocked = Boolean(busy) || Boolean(pending);

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
    content = <GuidedAnswer workspace={workspace} view={view} busy={busy} possessive={possessive} onCite={onCite} onHoverFact={onHoverFact} />;
  } else if (stepKey === 'change') {
    const repair = workspace?.application?.repair;
    const lastRepair = workspace?.application?.lastRepair;
    if (repair) {
      const facts = workspace?.applicant?.facts || [];
      const fact = facts.find((f) => f.id === repair.factId);
      const citations = view?.citations || {};
      const number = citations[repair.factId];
      const docTitles = { answer: 'Project answer', letter: 'Cover letter' };
      const untouched = untouchedCount(workspace);
      content = (
        <ChangeQueue
          repair={repair}
          fact={fact}
          number={number}
          docTitles={docTitles}
          busy={busy}
          pending={pending}
          onDecide={onDecideChange}
          onApply={onApplyChanges}
          onPropose={onProposeRepair}
          onCancel={onCancelRepair}
          untouchedCount={untouched}
        />
      );
    } else if (lastRepair) {
      const changed = lastRepair.changed ?? 0;
      content = (
        <div className="guided-change-done">
          <ChangedLine changed={changed} />
          <div className="guided-actions">
            <button type="button" className="btn primary" onClick={() => handlers.onReview?.(4)}>
              Review updated documents
            </button>
          </div>
          <ApproveButtons workspace={workspace} view={view} onApprove={onApprove} busy={busy} pending={pending} />
        </div>
      );
    } else {
      const fact = (workspace?.applicant?.facts ?? []).find((f) => f.status === 'confirmed' && matchesSampleCorrection(f, sample)) ?? null;
      const citations = view?.citations || {};
      const name = sample?.name || 'Ellie';
      if (fact) {
        const n = citations[fact.id];
        content = (
          <div className="guided-change-start">
            <Compare rows={[[`${name} remembers`, `“${sample?.correction?.text}”`], [`Fact [${n}] says`, fact.statement]]} />
            <button type="button" className="btn primary" disabled={isLocked} onClick={() => { if (isLocked) return; onCorrectFact?.(fact.id, sample?.correction?.text); }}>
              Correct this fact
            </button>
          </div>
        );
      } else {
        content = (
          <div className="guided-change-start">
            <p>No confirmed fact mentions this, so nothing needs rewriting.</p>
            <ApproveButtons workspace={workspace} view={view} onApprove={onApprove} busy={busy} pending={pending} />
          </div>
        );
      }
    }
  } else if (stepKey === 'finish') {
    content = (
      <div className="guided-finish">
        <FinishList workspace={workspace} possessive={possessive} onReview={handlers.onReview} />
        <button type="button" className="btn primary big" onClick={() => onPrimary?.({ id: 'export', label: 'Preview the export' })}>
          See the application
        </button>
      </div>
    );
  }

  return (
    <div>
      {busy || notice ? <StatusLine busy={busy} notice={notice} modeLabel={modeLabel} onDismiss={handlers.onDismissNotice} /> : null}
      <CheckedDrafts busy={busy} />
      {content}
    </div>
  );
}
