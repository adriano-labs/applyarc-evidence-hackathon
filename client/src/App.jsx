import './App.css';
import { useEffect, useState } from 'react';
import { useWorkspace } from './useWorkspace.js';
import { getForms } from './api.js';
import { defaultTab, pendingSegmentIds, sourceKinds } from './flow.js';
import { TopBar, StatusLine } from './components/TopBar.jsx';
import { FormPanel } from './components/FormPanel.jsx';
import { DocumentPane } from './components/DocumentPane.jsx';
import { Rail } from './components/Rail.jsx';
import { ExportDialog } from './components/ExportDialog.jsx';
import { CommandMenu } from './components/CommandMenu.jsx';
import { PhoneBar } from './components/PhoneBar.jsx';
import { StepGuide } from './components/StepGuide.jsx';
import { CitePeek } from './components/CitePeek.jsx';
import { GuidedBody } from './components/GuidedBody.jsx';
import { GuidedRun, guidedStep } from './components/GuidedRun.jsx';
import { GuidedReview } from './components/GuidedReview.jsx';
import { Welcome } from './components/Welcome.jsx';
import { ReceiptsDrawer } from './components/ReceiptsDrawer.jsx';
import { sourceLabel } from './components/References.jsx';
import { useActions } from './useActions.js';
import { useAppState } from './useAppState.js';
import { useKeyboard } from './useKeyboard.js';
import { buildCommands } from './commands.js';

export function App() {
  const ws = useWorkspace();
  const data = ws.data;
  const busy = ws.busy;
  const notice = ws.notice;

  const [flashSegmentId, setFlashSegmentId] = useState(null);
  const [receiptsOpen, setReceiptsOpen] = useState(false);

  // Open "What the model did" and bring it into view (on a phone, in the side pane).
  const openReceipts = () => {
    setReceiptsOpen(true);
    setPane('rail');
    setTimeout(() => document.getElementById('receipts-body')?.scrollIntoView?.({ block: 'nearest' }), 0);
  };

  const appState = useAppState(ws);
  const {
    tab,
    setTab,
    activeFactId,
    setActiveFactId,
    pinnedFactId,
    setPinnedFactId,
    peekFactId,
    setPeekFactId,
    hintSeen,
    setHintSeen,
    pack,
    setPack,
    commandsOpen,
    setCommandsOpen,
    pane,
    setPane,
    receipts,
    sample,
    picking,
    setPicking,
    forms,
    setForms,
    openCorrectionFactId,
    setOpenCorrectionFactId,
    conflictCorrectionContext,
    setConflictCorrectionContext,
    openConflictCorrection,
    refreshReceipts,
    handleReset,
    guided,
    setGuided,
    story,
    setStory,
    reviewStep,
    setReviewStep,
  } = appState;

  useKeyboard({ setCommandsOpen, setTab, setPinnedFactId, setPeekFactId });

  const actions = useActions(ws, {
    setPack,
    refreshReceipts,
    setTab,
    openCorrection: (factId) => {
      setOpenCorrectionFactId(factId);
      setConflictCorrectionContext(null);
      if (window.matchMedia?.('(max-width: 767px)').matches) {
        setPane('rail');
      }
    },
  });

  if (!data) {
    if (notice) {
      return (
        <div className="load-failed" role="alert">
          <p>{notice.message}</p>
          {notice.retry ? (
            <button type="button" className="btn primary" onClick={notice.retry}>
              Try again
            </button>
          ) : null}
        </div>
      );
    }
    return <p className="loading">Opening your workspace…</p>;
  }

  const workspace = data.workspace;
  const view = data.view;
  const mode = data.mode;
  const voice = data.voice === true;
  const budget = data.budget;

  const form = workspace?.application?.form || {};
  const activeSample = { ...sample, ...((sample?.samples ?? []).find((s) => s.formId === form.id) ?? {}) };
  // A workspace started from a sample's notes; only such a workspace can show the walk-through.
  const sampleRun = Boolean(activeSample?.notes) && (workspace?.applicant?.sources ?? []).some((s) => s.kind === 'notes' && s.text === activeSample.notes);
  const documents = workspace?.application?.documents || {};
  const portalTasks = form.portalTasks || [];
  const snapshot = { ...form.snapshot, url: form.url };
  const coverageAll = view?.coverage || [];
  const questions = workspace?.application?.questions || [];

  const getFormDocForId = (docId) => (form.documents ?? []).find((d) => d.id === docId) ?? null;

  const currentTabResolved = tab === null ? defaultTab(view, workspace) : tab;

  const modeLabel = mode?.label || '';

  const facts = workspace?.applicant?.facts || [];
  const proposedFactsCount = facts.filter((f) => f && f.status === 'proposed').length;
  const openQuestionsCount = questions.filter((q) => q && q.status === 'open').length;
  const repair = workspace?.application?.repair;
  const repairNeedsDecisionCount = repair && Array.isArray(repair.items)
    ? repair.items.filter((item) => item && item.status !== 'proposed' && item.decision == null).length
    : 0;
  const needsYou = proposedFactsCount + openQuestionsCount + repairNeedsDecisionCount + (view?.conflictDecisions?.length ?? 0);

  const changedSegmentIds = (() => {
    const lastRepair = workspace?.application?.lastRepair;
    const changed = lastRepair?.changedSegments;
    if (!Array.isArray(changed)) return [];
    const docId = currentTabResolved === 'answer' ? 'answer' : currentTabResolved === 'letter' ? 'letter' : null;
    if (!docId) return [];
    const ids = [];
    for (let i = 0; i < changed.length; i++) {
      if (changed[i] && changed[i].docId === docId && changed[i].segmentId) {
        ids.push(changed[i].segmentId);
      }
    }
    return ids;
  })();

  const shownFactId = activeFactId ?? pinnedFactId;

  const onCite = (factId) => {
    setActiveFactId(factId);
    if (factId) {
      setHintSeen(true);
    }
  };

  // On a phone a pinned citation also opens the evidence sheet, since the references are in the other pane.
  const peekFact = peekFactId ? (workspace?.applicant?.facts ?? []).find((f) => f.id === peekFactId) : null;
  const onPin = (factId) => {
    setPinnedFactId((p) => (p === factId ? null : factId));
    setHintSeen(true);
    if (factId && window.matchMedia?.('(max-width: 767px)').matches) {
      setPeekFactId(factId);
    }
  };

  const commands = buildCommands({
    view,
    workspace,
    currentTab: currentTabResolved,
    setTab,
    actions,
    setPicking,
    setForms,
    receipts,
    mode,
    budget,
    handleReset,
    sample: activeSample,
  });

  const handleShow = (docId, segmentId) => {
    if (!docId) return;
    setTab(docId);
    setPane('doc');
    // After it renders, scroll and flash
    setTimeout(() => {
      const el = document.querySelector(`[data-segment="${segmentId}"]`);
      if (el && typeof el.scrollIntoView === 'function') {
        try {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        } catch (e) {
          el.scrollIntoView();
        }
      }
      setFlashSegmentId(segmentId);
      setTimeout(() => {
        setFlashSegmentId((current) => (current === segmentId ? null : current));
      }, 1200);
    }, 50);
  };

  // "Show me": bring the step's control into view and focus it (on a phone, open the side pane first).
  const onShowStep = (show) => {
    if (window.matchMedia?.('(max-width: 767px)').matches) setPane('rail');
    setTimeout(() => {
      const target = document.querySelector({ facts: '.facts-review', question: '.question-card textarea', decide: '.conflict-card button', repair: '.queue' }[show]);
      target?.focus?.();
      target?.scrollIntoView?.({ block: 'nearest' });
    }, 0);
  };

  const topBar = (
    <TopBar
      company={form.company}
      role={form.role}
      mode={mode}
      budget={budget}
      onCommands={() => setCommandsOpen((v) => !v)}
      onReset={handleReset}
      onReceipts={openReceipts}
      earlier={workspace.archive?.length ?? 0}
      receipts={receipts}
    />
  );
  const onPrimary = (action) => {
    if (action && action.id === 'next-application') {
      setPicking(true);
      getForms()
        .then((res) => setForms(Array.isArray(res?.forms) ? res.forms : Array.isArray(res) ? res : []))
        .catch(() => setForms([]));
      return;
    }
    actions.primary(action);
  };
  const stepHandlers = {
    onDismissNotice: () => ws.setNotice(null),
    onDecideFact: (factId, decision) => actions.decideFact(factId, decision),
    onHoverFact: setActiveFactId,
    onConfirmFacts: (factIds) => actions.confirmFacts(factIds),
    onAnswer: (questionId, text) => actions.answer(questionId, text),
    onResolveSourceConflict: actions.resolveSourceConflict,
    onSkip: (questionId) => actions.skip(questionId),
    onCorrectFact: (factId, text) => actions.correct(factId, text),
    onDecideChange: actions.decideChange,
    onApplyChanges: actions.applyChanges,
    onApprove: actions.approve,
    onPrimary,
    onEdit: (docId, segmentId, text) => actions.edit(docId, segmentId, text),
    onCite,
    onCancelRepair: actions.cancelRepair,
    onProposeRepair: () => actions.primary({ id: 'repair', label: 'Rewriting the sentences that cite the change' }),
    onShow: handleShow,
    onReview: setReviewStep,
    onSettleConflict: (questionId, factId, decision) => ws.act('settleConflict', { questionId, factId, decision }),
    onCorrectConflict: openConflictCorrection,
  };
  // A sample's notes open the walk-through at once; a refused start goes back to the welcome.
  const addNotes = (text) => {
    if (text === activeSample?.notes) setGuided(true);
    return actions.addNotes(text);
  };
  const startSample = async (id) => {
    setGuided(true);
    if (!(await actions.startSample(id))) setGuided(false);
  };
  // The welcome and the walk-through have no rail, so they carry What Meta did and the command menu themselves.
  const receiptsDrawer = (
    <aside className="guided-receipts">
      <ReceiptsDrawer receipts={receipts} modeLabel={mode?.label} onDownload={() => actions.downloadTrace(receipts, mode, budget)} open={receiptsOpen} onToggle={setReceiptsOpen} />
    </aside>
  );
  const commandMenu = commandsOpen ? <CommandMenu commands={commands} onClose={() => setCommandsOpen(false)} /> : null;
  const exportDialog = pack ? <ExportDialog pack={pack} onClose={() => setPack(null)} onCopy={(text) => actions.copyText(text)} onDownload={() => actions.downloadPackMarkdown(pack)} onDownloadPass={() => actions.downloadEvidencePass(pack)} /> : null;

  // Ellie's sample runs as a guided walk-through: one step at a time, the full workspace one click away.
  if (guided && sampleRun) {
    return (
      <div className="app">
        {topBar}
        <GuidedRun view={view} workspace={workspace} story={story} sampleName={activeSample?.name} possessive={activeSample?.possessive} isMeta={Boolean(mode?.isMeta)} onPrimary={onPrimary} onStory={setStory} onExit={() => { setReviewStep(null); setGuided(false); }} reviewStep={reviewStep} onReview={setReviewStep} busy={busy}>
          {reviewStep ? (
            <GuidedReview n={reviewStep} workspace={workspace} view={view} possessive={activeSample?.possessive} />
          ) : (
            <GuidedBody stepKey={guidedStep(view, workspace, story).key} workspace={workspace} view={view} busy={busy} pending={ws.pending} notice={notice} modeLabel={modeLabel} sample={activeSample} possessive={activeSample?.possessive} handlers={stepHandlers} voice={voice} />
          )}
        </GuidedRun>
        {receiptsDrawer}
        {exportDialog}
        {commandMenu}
      </div>
    );
  }

  // A fresh workspace opens on the welcome alone; the workspace appears with the first notes.
  if (!(workspace?.applicant?.sources ?? []).length) {
    return (
      <div className="app">
        {topBar}
        {notice ? (
          <div className="status-wrap">
            <StatusLine busy={busy} notice={notice} modeLabel={modeLabel} onDismiss={() => ws.setNotice(null)} />
          </div>
        ) : null}
        <Welcome form={form} sample={activeSample} busy={busy} liveModel={mode?.id !== 'fixture'} onAddNotes={addNotes} onStartSample={startSample} onStartOwn={actions.startOwnApplication} voice={voice} />
        {receiptsDrawer}
        {commandMenu}
      </div>
    );
  }

  return (
    <div className="app">
      {topBar}
      <StepGuide view={view} workspace={workspace} />
      {sampleRun ? (
        <div className="guided-return">
          <button type="button" className="btn link small" onClick={() => setGuided(true)}>
            Back to the guided walk-through
          </button>
        </div>
      ) : null}
      {notice ? (
        <div className="status-wrap">
          <StatusLine busy={busy} notice={notice} modeLabel={modeLabel} onDismiss={() => ws.setNotice(null)} />
        </div>
      ) : null}
      <main className="workspace" data-pane={pane} data-repair={repair ? '' : undefined}>
        <FormPanel
          company={form.company}
          formDoc={(() => {
            const fd = currentTabResolved === 'letter'
              ? getFormDocForId('letter') || {}
              : currentTabResolved === 'notes'
                ? getFormDocForId('answer') || (form.documents && form.documents[0]) || {}
                : getFormDocForId('answer') || (form.documents && form.documents[0]) || {};
            return fd;
          })()}
          coverage={
            currentTabResolved === 'letter'
              ? coverageAll.filter((c) => c.docId === 'letter')
              : coverageAll.filter((c) => c.docId === 'answer' || c.docId === 'notes')
          }
          questions={questions}
          citations={view?.citations || {}}
          activeFactId={shownFactId}
          onCite={onCite}
          portalTasks={portalTasks}
          snapshot={snapshot}
        />
        <DocumentPane
          tab={tab}
          onTab={setTab}
          workspace={workspace}
          view={view}
          busy={busy}
          modeLabel={modeLabel}
          notice={notice}
          onShowStep={onShowStep}
          flashSegmentId={flashSegmentId}
          onPrimary={onPrimary}
          sample={activeSample}
          activeFactId={shownFactId}
          revealFactId={pinnedFactId}
          changedSegmentIds={changedSegmentIds}
          pendingSegmentIds={pendingSegmentIds(workspace, currentTabResolved)}
          onAddNotes={addNotes}
          onHoverFact={setActiveFactId}
          onCite={onCite}
          onEdit={(docId, segmentId, text) => actions.edit(docId, segmentId, text)}
          onStrengthen={actions.strengthen}
          onAcceptSuggestion={actions.acceptSuggestion}
          onDismissSuggestion={actions.dismissSuggestion}
          pending={ws.pending}
          receipts={receipts}
          mode={mode}
          onReceipts={openReceipts}
          onPin={onPin}
          hintSeen={hintSeen}
          limitSource={(getFormDocForId(currentTabResolved === 'letter' ? 'letter' : currentTabResolved === 'answer' ? 'answer' : null))?.limitSource}
          packOpen={Boolean(pack)}
          picking={picking}
          forms={forms}
          onStartSample={startSample}
          liveModel={mode?.id !== 'fixture'}
          onChooseNextApplication={async (formId) => {
            const res = await ws.act('nextApplication', { formId });
            setPicking(false);
            setTab(null);
            if (res && actions.followUp) {
              await actions.followUp(res);
            } else if (actions.followUp && ws.data) {
              await actions.followUp({ view: ws.data.view, workspace: ws.data.workspace });
            }
            refreshReceipts();
          }}
          onCancelNextApplication={() => {
            setPicking(false);
          }}
        />
        <Rail
          workspace={workspace}
          view={view}
          busy={busy}
          pending={ws.pending}
          receipts={receipts}
          mode={mode}
          sample={activeSample}
          activeFactId={shownFactId}
          revealFactId={pinnedFactId}
          openCorrectionFactId={openCorrectionFactId}
          conflictCorrectionContext={conflictCorrectionContext}
          onCloseCorrection={() => { setOpenCorrectionFactId(null); setConflictCorrectionContext(null); }}
          onDecideChange={(itemId, decision, text) => actions.decideChange(itemId, decision, text)}
          onApplyChanges={() => actions.applyChanges()}
          onAnswer={stepHandlers.onAnswer}
          onResolveSourceConflict={stepHandlers.onResolveSourceConflict}
          onSkip={stepHandlers.onSkip}
          onDecideFact={stepHandlers.onDecideFact}
          onCorrectFact={(factId, text) => actions.correct(factId, text)}
          onOpenCorrection={openConflictCorrection}
          onSettleConflict={stepHandlers.onSettleConflict}
          onHoverFact={setActiveFactId}
          onConfirmFacts={stepHandlers.onConfirmFacts}
          onDownloadTrace={() => actions.downloadTrace(receipts, mode, budget)}
          onShow={handleShow}
          receiptsOpen={receiptsOpen}
          onReceiptsToggle={setReceiptsOpen}
          onProposeRepair={() => actions.primary({ id: 'repair', label: 'Rewriting the sentences that cite the change' })}
          onCancelRepair={actions.cancelRepair}
          voice={voice}
        />
      </main>
      <PhoneBar pane={pane} onPane={setPane} needsYou={needsYou} />
      {exportDialog}
      {commandMenu}
      {peekFact ? (
        <CitePeek
          fact={peekFact}
          n={view?.citations?.[peekFact.id]}
          sourceLabel={sourceLabel(sourceKinds(workspace)[peekFact.sourceId])}
          onClose={() => setPeekFactId(null)}
          onCorrect={(id) => {
            setPeekFactId(null);
            setConflictCorrectionContext(null);
            setPane('rail');
            setOpenCorrectionFactId(id);
          }}
        />
      ) : null}
    </div>
  );
}
