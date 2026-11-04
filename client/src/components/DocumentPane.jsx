import './DocumentPane.css';
import { CheckCircle2 } from 'lucide-react';
import { useRef } from 'react';
import { NotesView } from './NotesView.jsx';
import { DocumentView } from './DocumentView.jsx';
import { DocSpecimen } from './DocSpecimen.jsx';
import { currentStep } from './StepGuide.jsx';
import { NextApplication } from './NextApplication.jsx';
import { defaultTab, primaryAction, thenLine } from '../flow.js';
import { StatusLine } from './TopBar.jsx';
import { tabStates } from '../tabs.js';
import { CheckedDrafts } from './WorkingState.jsx';
import { docTitles } from '../lib/trail.js';
import { draftedFromLine } from '../lib/spokenLines.js';

// Each tab: its name, a short name for phones, and its keyboard shortcut.
const TABS = [
  { id: 'notes', name: 'Your notes', short: 'Notes', key: '1' },
  { id: 'answer', name: 'Project answer', short: 'Answer', key: '2' },
  { id: 'letter', name: 'Cover letter', short: 'Letter', key: '3' },
];

// The form's own titles; a council's "Supporting evidence" is "Evidence" on a phone.
function tabsFor(workspace) {
  const titles = docTitles(workspace);
  const short = (t) => (t.id === 'answer' && /^supporting/i.test(titles.answer) ? 'Evidence' : t.short);
  return TABS.map((t) => (t.id === 'notes' ? t : { ...t, name: titles[t.id] ?? t.name, short: short(t) }));
}

export function DocumentPane({
  tab,
  onTab,
  workspace,
  view,
  busy,
  onPrimary,
  onShowStep,
  modeLabel,
  notice,
  sample,
  activeFactId,
  revealFactId,
  changedSegmentIds,
  flashSegmentId,
  pendingSegmentIds,
  onAddNotes,
  onHoverFact,
  onCite,
  onEdit,
  onStrengthen,
  onAcceptSuggestion,
  onDismissSuggestion,
  pending,
  limitSource,
  packOpen,
  picking,
  forms,
  onChooseNextApplication,
  onCancelNextApplication,
  receipts,
  mode,
  onReceipts,
  onPin,
  hintSeen,
  onStartSample,
  samples: samplesProp,
  liveModel,
  ...handlers
}) {
  const currentTab = tab === null || tab === undefined ? defaultTab(view, workspace) : tab;

  const approvals = view?.approvals || {};
  const formDocs = workspace?.application?.form?.documents || [];

  const tabRefs = useRef({});

  const tabs = TABS.map((t) => t.id);

  const states = tabStates(view, workspace, busy);

  const handleTabClick = (t) => {
    if (onTab) onTab(t);
  };

  const handleTabKeyDown = (e, t) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const currentIndex = tabs.indexOf(t);
      if (currentIndex === -1) return;
      let nextIndex;
      if (e.key === 'ArrowRight') {
        nextIndex = (currentIndex + 1) % tabs.length;
      } else {
        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      }
      const nextTab = tabs[nextIndex];
      if (onTab) {
        onTab(nextTab);
      }
      setTimeout(() => {
        const ref = tabRefs.current[nextTab];
        if (ref && typeof ref.focus === 'function') {
          ref.focus();
        }
      }, 0);
    }
  };

  const renderBody = () => {
    if (currentTab === 'notes') {
      const sources = workspace?.applicant?.sources || [];
      const facts = workspace?.applicant?.facts || [];
      const questions = workspace?.application?.questions || [];
      const form = workspace?.application?.form || {};
      const company = form?.company;
      const formDocs = form?.documents || [];
      const answerDoc = formDocs.find((d) => d.id === 'answer') || formDocs[0];
      const wordLimit = answerDoc?.wordLimit;
      const snapshotDate = form?.snapshot?.fetchedAt;
      const panelId = 'panel-notes';
      return (
        <div role="tabpanel" id={panelId} aria-labelledby="tab-notes">
          <NotesView
            sources={sources}
            facts={facts}
            questions={questions}
            activeFactId={activeFactId}
            revealFactId={revealFactId}
            busy={Boolean(busy)}
            sampleNotes={sample?.notes}
            onAddNotes={onAddNotes}
            onHover={onHoverFact}
            company={company}
            wordLimit={wordLimit}
            snapshotDate={snapshotDate}
            samples={samplesProp ?? sample?.samples}
            liveModel={liveModel}
            onStartSample={onStartSample}
            languages={sample?.languages}
          />
        </div>
      );
    }
    if (currentTab === 'answer' || currentTab === 'letter') {
      const docId = currentTab === 'answer' ? 'answer' : 'letter';
      const doc = workspace?.application?.documents?.[docId] || null;
      const title = formDocs.find((d) => d.id === docId)?.title || (docId === 'answer' ? 'Project answer' : 'Cover letter');
      const stats = view?.stats?.[docId] || { words: 0, wordLimit: 0, overLimit: false };
      const approval = approvals[docId] || 'none';
      const citations = view?.citations || {};
      const locked = Boolean(busy) || Boolean(workspace?.application?.repair);
      const formDocsList = workspace?.application?.form?.documents || [];
      const formDocForThis = formDocsList.find((d) => d.id === docId);
      const lim = limitSource !== undefined ? limitSource : formDocForThis?.limitSource;
      let lastRepair = null;
      const appLastRepair = workspace?.application?.lastRepair;
      if (appLastRepair && Array.isArray(appLastRepair.docs) && appLastRepair.docs.includes(docId)) {
        const factNumber = appLastRepair.factId !== undefined ? citations[appLastRepair.factId] : appLastRepair.factNumber;
        lastRepair = {
          at: appLastRepair.at,
          changed: appLastRepair.changed,
          kept: appLastRepair.kept,
          factNumber,
        };
      }
      const panelId = `panel-${docId}`;
      if (!doc) {
        // Not written yet: an example of a cited sentence, and the way back to the current step.
        const { step } = currentStep(view, workspace);
        const onGo = step === 1 ? () => onTab?.('notes') : step === 2 ? () => onShowStep?.('facts') : step === 3 ? () => onShowStep?.('question') : null;
        return (
          <div role="tabpanel" id={panelId} aria-labelledby={`tab-${docId}`}>
            <DocSpecimen docId={docId} title={title} company={workspace?.application?.form?.company} wordLimit={formDocForThis?.wordLimit} limitSource={lim} step={step} onGo={onGo} />
          </div>
        );
      }
      return (
        <div role="tabpanel" id={panelId} aria-labelledby={`tab-${docId}`}>
          {workspace.application.suggestion && workspace.application.suggestion.docId !== docId && <p className="suggestion-intro">
            You have a sentence suggestion to review in the other document.{' '}
            <button type="button" className="btn link small" onClick={() => onTab?.(workspace.application.suggestion.docId)}>Open suggestion</button>
          </p>}
          <DocumentView
            key={`${workspace.application.form.id}:${docId}`}
            title={title}
            doc={doc}
            citations={citations}
            approval={approval}
            approvedRevision={workspace?.application?.approvals?.[docId]?.revision}
            stats={stats}
            limitSource={lim}
            locked={locked}
            activeFactId={activeFactId}
            changedSegmentIds={changedSegmentIds || []}
            flashSegmentId={flashSegmentId}
            pendingSegmentIds={pendingSegmentIds || []}
            onCite={onCite}
            onEdit={(segmentId, text) => onEdit && onEdit(docId, segmentId, text)}
            onStrengthen={(segmentId, request) => onStrengthen?.(docId, segmentId, request)}
            onAcceptSuggestion={onAcceptSuggestion}
            onDismissSuggestion={onDismissSuggestion}
            suggestion={workspace.application.suggestion}
            suggestionBusy={Boolean(busy) || Boolean(pending) || Boolean(workspace.application.repair)}
            facts={workspace.applicant.facts}
            liveModel={liveModel}
            lastRepair={lastRepair}
            receipts={receipts}
            mode={mode}
            onReceipts={onReceipts}
            onPin={onPin}
            hintSeen={hintSeen}
            languageLine={draftedFromLine(workspace, doc, receipts)}
          />
        </div>
      );
    }
    return null;
  };

  const action = primaryAction(view, workspace, currentTab, sample);
  const showNextStep = !packOpen && !picking;

  return (
    <section className="document-pane">
      <nav className="doc-tabs" role="tablist" aria-label="Documents">
        {tabsFor(workspace).map(({ id, name, short, key }) => {
          const state = states[id];
          return (
            <button
              key={id}
              ref={(el) => {
                tabRefs.current[id] = el;
              }}
              type="button"
              role="tab"
              id={`tab-${id}`}
              aria-controls={`panel-${id}`}
              aria-selected={currentTab === id ? 'true' : 'false'}
              tabIndex={currentTab === id ? 0 : -1}
              aria-keyshortcuts={key}
              title={`Press ${key}`}
              onClick={() => handleTabClick(id)}
              onKeyDown={(e) => handleTabKeyDown(e, id)}
            >
              <span className="tab-name">{name}</span>
              <span className="tab-short">{short}</span>
              <span className="tab-state" data-tone={state.tone ?? undefined} data-short={state.short}>
                {state.tone === 'approved' ? <CheckCircle2 size={14} aria-hidden="true" /> : null}
                {state.text}
              </span>
            </button>
          );
        })}
      </nav>
      <div className="document-body">
        {busy && <StatusLine busy={busy} modeLabel={modeLabel} />}
        <CheckedDrafts busy={busy} titles={docTitles(workspace)} />
        {picking ? (
          <NextApplication
            forms={forms || []}
            busy={Boolean(busy)}
            onChoose={onChooseNextApplication}
            onCancel={onCancelNextApplication}
          />
        ) : (
          renderBody()
        )}
      </div>
      {showNextStep && action && !busy ? (
        <div className="next-step">
          <div className="next-text">
            {action.hint ? <p className="next-now">{action.hint}</p> : null}
            {action.warning ? <p className="next-warn">{action.warning}</p> : null}
            {thenLine(view, workspace, sample) ? <p className="next-then">{thenLine(view, workspace, sample)}</p> : null}
          </div>
          <div className="next-actions">
            {action.show && !busy ? (
              <button type="button" className="btn" onClick={() => onShowStep && onShowStep(action.show)}>
                Show me
              </button>
            ) : null}
            {action.secondary && !busy ? (
              <button type="button" className="btn" onClick={() => onPrimary && onPrimary(action.secondary)}>
                {action.secondary.label}
              </button>
            ) : null}
            {action.id ? (
              <button
                type="button"
                className="btn primary big"
                disabled={Boolean(busy)}
                onClick={() => onPrimary && onPrimary(action)}
              >
                {action.label}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
