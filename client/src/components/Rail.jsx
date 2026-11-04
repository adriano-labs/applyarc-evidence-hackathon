import './Rail.css';
import { useEffect, useRef } from 'react';
import { ChangeQueue } from './ChangeQueue.jsx';
import { ConflictDecisions } from './ConflictDecisions.jsx';
import { References } from './References.jsx';
import { ReceiptsDrawer } from './ReceiptsDrawer.jsx';
import { FactsPanel, QuestionPanel } from './StepPanels.jsx';
import { untouchedCount as getUntouchedCount } from '../flow.js';
import { spokenIds } from '../lib/language.js';
import { docTitles } from '../lib/trail.js';

export function Rail({
  workspace,
  view,
  busy,
  pending,
  receipts,
  mode,
  sample,
  activeFactId,
  revealFactId,
  openCorrectionFactId,
  conflictCorrectionContext,
  onCloseCorrection,
  onDecideChange,
  onApplyChanges,
  onAnswer,
  onResolveSourceConflict,
  onSkip,
  onDecideFact,
  onCorrectFact,
  onOpenCorrection,
  onSettleConflict,
  onHoverFact,
  onConfirmFacts,
  onDownloadTrace,
  onShow,
  receiptsOpen,
  onReceiptsToggle,
  onProposeRepair,
  onCancelRepair,
  voice,
  ...handlers
}) {
  const repair = workspace?.application?.repair;
  const citations = view?.citations || {};
  const facts = workspace?.applicant?.facts || [];
  const sources = workspace?.applicant?.sources || [];

  // Opened from the foot of the pane, the trail starts at its top (on a phone the pane is the page),
  // with focus on the way back, since the toggle that opened it is gone.
  const backRef = useRef(null);
  useEffect(() => { if (receiptsOpen) backRef.current?.focus?.(); }, [receiptsOpen]);
  // Something in the rail waits on the applicant: keep it on screen, with the trail open at its foot.
  const waiting = repair || openCorrectionFactId || ['facts', 'question', 'decide'].includes(view?.next);

  const drawer = (
    <ReceiptsDrawer
      receipts={receipts}
      modeLabel={mode?.label}
      mode={mode}
      busy={busy}
      workspace={workspace}
      view={view}
      onDownload={onDownloadTrace}
      open={receiptsOpen}
      onToggle={onReceiptsToggle}
    />
  );

  // Open, the trail takes the whole rail (a new aside, so it opens at its top), with one way back.
  if (receiptsOpen && !waiting) {
    return (
      <aside key="trail" className="rail" aria-label="Evidence">
        <button type="button" className="btn link small rail-back" ref={backRef} onClick={() => { onReceiptsToggle?.(false); setTimeout(() => document.querySelector('.rail .receipts-toggle')?.focus(), 0); }}>
          Back to your evidence
        </button>
        {drawer}
      </aside>
    );
  }

  if (repair) {
    // A new aside (key) for the queue, so it opens at its top, not at the references' scroll position.
    const fact = facts.find((f) => f.id === repair.factId);
    const number = citations[repair.factId];
    const titles = docTitles(workspace);
    const untouchedCount = getUntouchedCount(workspace);
    return (
      <aside key="queue" className="rail" aria-label="Evidence">
        <ChangeQueue
          repair={repair}
          fact={fact}
          number={number}
          docTitles={titles}
          busy={busy}
          pending={pending}
          onDecide={onDecideChange}
          onApply={onApplyChanges}
          onShow={onShow}
          onPropose={onProposeRepair}
          onCancel={onCancelRepair}
          untouchedCount={untouchedCount}
          receipts={receipts}
        />
        {drawer}
      </aside>
    );
  }

  // Build source kinds
  const sourceKinds = {};
  for (let i = 0; i < sources.length; i++) {
    if (sources[i] && sources[i].id) {
      sourceKinds[sources[i].id] = sources[i].kind;
    }
  }

  const questionCard = (
    <QuestionPanel
      workspace={workspace}
      view={view}
      sample={sample}
      busy={busy}
      onAnswer={onAnswer}
      onResolveSourceConflict={onResolveSourceConflict}
      onSkip={onSkip}
      voice={voice}
    />
  );

  const factsReview = (
    <FactsPanel
      workspace={workspace}
      view={view}
      busy={busy}
      onDecideFact={onDecideFact}
      onHoverFact={onHoverFact}
      onConfirmFacts={onConfirmFacts}
    />
  );

  return (
    <aside key="evidence" className="rail" aria-label="Evidence">
      <ConflictDecisions decisions={view?.conflictDecisions} busy={busy} onCorrect={onOpenCorrection} onSettle={onSettleConflict} />
      {questionCard}
      {factsReview}
      <References
        facts={facts}
        citations={citations}
        sources={sourceKinds}
        spoken={spokenIds(workspace)}
        activeFactId={activeFactId}
        revealFactId={revealFactId}
        locked={Boolean(busy)}
        onCorrect={onCorrectFact}
        onHover={onHoverFact}
        sample={sample}
        openCorrectionFactId={openCorrectionFactId}
        onCloseCorrection={onCloseCorrection}
        conflictCorrectionContext={conflictCorrectionContext}
      />
      {drawer}
    </aside>
  );
}
