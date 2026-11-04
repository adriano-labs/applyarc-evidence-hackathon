import { useEffect, useRef, useState } from 'react';
import { getSample, getReceipts, getForms } from './api.js';

// The walk-through is a view of the workspace, so this tab remembers it across a reload.
// sessionStorage can throw (private mode, blocked storage); then it is simply not remembered.
function rememberedGuided() {
  try {
    return sessionStorage.getItem('ae-guided') === '1';
  } catch {
    return false;
  }
}
function rememberGuided(on) {
  try {
    if (on) sessionStorage.setItem('ae-guided', '1');
    else sessionStorage.removeItem('ae-guided');
  } catch {
    // not remembered; the walk-through still works in this page
  }
}

const RESET_NOTICE = 'Press Start again once more to clear this application. Your notes and facts will be removed.';

// A decision's own answer only; a stale or missing answer never becomes a sample prefill.
function currentConflictCorrection(data, context) {
  if (!context) return null;
  const question = data?.workspace?.application?.questions?.find((q) => q.id === context.questionId);
  const source = data?.workspace?.applicant?.sources?.find((s) => s.id === context.sourceId);
  const waiting = data?.view?.conflictDecisions?.some((d) => d.questionId === context.questionId && d.factId === context.factId);
  const current = waiting && question?.kind === 'source-conflict' && question.status === 'answered'
    && question.sourceId === context.sourceId && source?.kind === 'answer' && source.read === true
    && !source.withheld && typeof source.text === 'string' && source.text.trim();
  return { factId: context.factId, answerText: current ? source.text : null };
}

export function useAppState(ws) {
  const data = ws.data;

  const [tab, setTab] = useState(null);
  const [activeFactId, setActiveFactId] = useState(null);
  const [pack, setPack] = useState(null);
  const [commandsOpen, setCommandsOpen] = useState(false);
  const [pane, setPane] = useState('doc');
  const [receipts, setReceipts] = useState([]);
  const [sample, setSample] = useState(null);
  const [resetArmed, setResetArmed] = useState(false);
  const resetTimer = useRef(null);
  const [picking, setPicking] = useState(false);
  const [forms, setForms] = useState([]);
  const [openCorrectionFactId, setOpenCorrectionFactId] = useState(null);
  const [conflictCorrectionContext, setConflictCorrectionContext] = useState(null);
  const [pinnedFactId, setPinnedFactId] = useState(null);
  const [peekFactId, setPeekFactId] = useState(null);
  const [hintSeen, setHintSeen] = useState(false);
  const [guided, setGuided] = useState(rememberedGuided);
  const [story, setStory] = useState(null);
  const [reviewStep, setReviewStep] = useState(null);
  // A sample who speaks, chosen on the welcome: her voice note opens before any workspace exists.
  // Set only by choosing her; every other start and Start again clears it.
  const [starting, setStarting] = useState(null);
  useEffect(() => rememberGuided(guided), [guided]);

  const refreshReceipts = async () => {
    try {
      const res = await getReceipts();
      if (res && Array.isArray(res.receipts)) {
        setReceipts(res.receipts);
      } else if (Array.isArray(res)) {
        setReceipts(res);
      } else {
        setReceipts(res?.receipts || []);
      }
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    getSample().then((s) => setSample(s)).catch(() => {});
    refreshReceipts();
    // What Meta did shows a voice call as soon as it ends, not at the next step (sent by api.js).
    window.addEventListener('ae-voice-call', refreshReceipts);
    return () => window.removeEventListener('ae-voice-call', refreshReceipts);
  }, []);

  useEffect(() => {
    if (data?.view?.next) {
      setTab(null);
      const v = data.view.next;
      if (v === 'facts' || v === 'question' || v === 'decide' || v === 'repair') {
        setPane('rail');
      } else {
        setPane('doc');
      }
    }
  }, [data?.view?.next]);

  const openConflictCorrection = (factId, questionId) => {
    const question = data?.workspace?.application?.questions?.find((q) => q.id === questionId);
    setConflictCorrectionContext({ factId, questionId, sourceId: question?.sourceId });
    setOpenCorrectionFactId(factId);
    setGuided(false);
    setPane('rail');
  };

  const handleReset = () => {
    if (!resetArmed) {
      setResetArmed(true);
      ws.setNotice({ kind: 'info', message: RESET_NOTICE });
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => {
        setResetArmed(false);
        ws.setNotice((n) => (n?.message === RESET_NOTICE ? null : n));
      }, 5000);
      return;
    }
    ws.reset().then(() => {
      setPack(null);
      setTab(null);
      setResetArmed(false);
      setPicking(false);
      setForms([]);
      setGuided(false);
      setStarting(null);
      setStory(null);
      setReviewStep(null);
      setOpenCorrectionFactId(null);
      setConflictCorrectionContext(null);
      if (resetTimer.current) {
        clearTimeout(resetTimer.current);
        resetTimer.current = null;
      }
      ws.setNotice(null);
      refreshReceipts();
    });
  };

  return {
    tab,
    setTab,
    activeFactId,
    setActiveFactId,
    pack,
    setPack,
    commandsOpen,
    setCommandsOpen,
    pane,
    setPane,
    receipts,
    setReceipts,
    sample,
    setSample,
    resetArmed,
    setResetArmed,
    resetTimer,
    picking,
    setPicking,
    forms,
    setForms,
    openCorrectionFactId,
    setOpenCorrectionFactId,
    conflictCorrectionContext: currentConflictCorrection(data, conflictCorrectionContext),
    setConflictCorrectionContext,
    openConflictCorrection,
    pinnedFactId,
    setPinnedFactId,
    peekFactId,
    setPeekFactId,
    hintSeen,
    setHintSeen,
    refreshReceipts,
    handleReset,
    guided,
    setGuided,
    story,
    setStory,
    reviewStep,
    setReviewStep,
    starting,
    setStarting,
  };
}
