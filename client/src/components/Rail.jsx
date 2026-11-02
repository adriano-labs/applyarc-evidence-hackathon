import './Rail.css';
import { ChangeQueue } from './ChangeQueue.jsx';
import { ConflictDecisions } from './ConflictDecisions.jsx';
import { References } from './References.jsx';
import { ReceiptsDrawer } from './ReceiptsDrawer.jsx';
import { FactsPanel, QuestionPanel } from './StepPanels.jsx';
import { untouchedCount as getUntouchedCount } from '../flow.js';

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

  if (repair) {
    // A new aside (key) for the queue, so it opens at its top, not at the references' scroll position.
    const fact = facts.find((f) => f.id === repair.factId);
    const number = citations[repair.factId];
    const docTitles = { answer: 'Project answer', letter: 'Cover letter' };
    const untouchedCount = getUntouchedCount(workspace);
    return (
      <aside key="queue" className="rail" aria-label="Evidence">
        <ChangeQueue
          repair={repair}
          fact={fact}
          number={number}
          docTitles={docTitles}
          busy={busy}
          pending={pending}
          onDecide={onDecideChange}
          onApply={onApplyChanges}
          onShow={onShow}
          onPropose={onProposeRepair}
          onCancel={onCancelRepair}
          untouchedCount={untouchedCount}
        />
        <ReceiptsDrawer
          receipts={receipts}
          modeLabel={mode?.label}
          onDownload={onDownloadTrace}
          open={receiptsOpen}
          onToggle={onReceiptsToggle}
        />
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
      <ReceiptsDrawer
        receipts={receipts}
        modeLabel={mode?.label}
        onDownload={onDownloadTrace}
        open={receiptsOpen}
        onToggle={onReceiptsToggle}
      />
    </aside>
  );
}
