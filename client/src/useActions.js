import { autoStep, leftOutNotice, packMarkdown, unreadSource } from './flow.js';
import { evidencePassHtml } from './lib/evidencePass.js';

function downloadBlob(filename, content, type) {
  const blob = new Blob([content], { type: type || 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function useActions(ws, ui) {
  const { act, run } = ws;
  const { setPack, refreshReceipts, setTab } = ui || {};

  async function followUp(result) {
    const view = result?.view || ws.data?.view;
    const workspace = result?.workspace || ws.data?.workspace;
    if (!view) return result;
    const step = autoStep(view);
    if (step === 'read') {
      const u = unreadSource(workspace);
      if (u && u.id) {
        const res = await run('read', { sourceId: u.id }, 'Reading your words');
        if (res && refreshReceipts) refreshReceipts();
        return res;
      }
      const res = await run('read', {}, 'Reading your words');
      if (res && refreshReceipts) refreshReceipts();
      return res;
    }
    if (step === 'check') {
      const res = await run('check', {}, 'Checking what the form still needs');
      if (res && refreshReceipts) refreshReceipts();
      return res;
    }
    if (step === 'repair') {
      const res = await run('repair', {}, 'Rewriting the sentences that cite the change');
      if (res && refreshReceipts) refreshReceipts();
      return res;
    }
    return result;
  }

  async function addNotes(text) {
    const res = await act('notes', { text });
    if (res) {
      await followUp(res);
    }
    if (res && refreshReceipts) refreshReceipts();
    return res;
  }

  async function startSample(sampleId) {
    const res = await act('startSample', { sampleId });
    if (res) {
      await followUp(res);
    }
    if (res && refreshReceipts) refreshReceipts();
    return res;
  }

  async function startOwnApplication(input) {
    const res = await act('startOwnApplication', input);
    if (res) await followUp(res);
    if (res && refreshReceipts) refreshReceipts();
    return res;
  }

  async function decideFact(factId, decision) {
    const res = await act('decideFact', { factId, decision });
    if (res) await followUp(res);
    if (res && refreshReceipts) refreshReceipts();
    return res;
  }

  async function confirmFacts(factIds) {
    const res = await act('confirmFacts', { factIds });
    if (res) await followUp(res);
    if (res && refreshReceipts) refreshReceipts();
    return res;
  }

  async function answer(questionId, text) {
    const res = await act('answer', { questionId, text });
    if (res) await followUp(res);
    if (res && refreshReceipts) refreshReceipts();
    return res;
  }

  async function skip(questionId) {
    const res = await act('skip', { questionId });
    if (res) await followUp(res);
    if (res && refreshReceipts) refreshReceipts();
    return res;
  }

  async function resolveSourceConflict(input) {
    const res = await act('resolveSourceConflict', input);
    if (res) await followUp(res);
    if (res && refreshReceipts) refreshReceipts();
    return res;
  }

  async function edit(docId, segmentId, text) {
    const res = await act('edit', { docId, segmentId, text });
    if (res && refreshReceipts) refreshReceipts();
    return res;
  }

  async function strengthen(docId, segmentId, request) {
    const res = await run('strengthen', { docId, segmentId, request }, 'Drafting and checking one sentence');
    if (res && refreshReceipts) refreshReceipts();
    return res;
  }

  const acceptSuggestion = (suggestionId) => act('acceptSuggestion', { suggestionId });
  const dismissSuggestion = (suggestionId) => act('dismissSuggestion', { suggestionId });

  async function correct(factId, text) {
    const res = await act('changeFact', { factId, text });
    if (res) {
      await followUp(res);
    }
    if (res && refreshReceipts) refreshReceipts();
    return res;
  }

  async function decideChange(itemId, decision, text) {
    const input = { itemId, decision };
    if (text !== undefined) {
      input.text = text;
    }
    const res = await act('decideChange', input);
    if (res && refreshReceipts) refreshReceipts();
    return res;
  }

  async function applyChanges() {
    const res = await act('applyChanges');
    if (res) {
      await followUp(res);
    }
    if (res && refreshReceipts) refreshReceipts();
    return res;
  }

  const cancelRepair = () => act('cancelRepair');

  async function approve(docId, docRevision) {
    const res = await act('approve', { docId, docRevision });
    if (res) {
      await followUp(res);
    }
    if (res && refreshReceipts) refreshReceipts();
    return res;
  }

  async function primary(action) {
    if (!action) return null;
    if (action.id === 'read') {
      const u = unreadSource(ws.data?.workspace);
      if (u && u.id) {
        const res = await run('read', { sourceId: u.id }, action.label || 'Reading your words');
        if (res && refreshReceipts) refreshReceipts();
        return res;
      }
      const res = await run('read', {}, action.label || 'Reading your words');
      if (res && refreshReceipts) refreshReceipts();
      return res;
    }
    if (action.id === 'check') {
      const res = await run('check', {}, action.label || 'Checking what the form still needs');
      if (res && refreshReceipts) refreshReceipts();
      return res;
    }
    if (action.id === 'repair') {
      const res = await run('repair', {}, action.label || 'Rewriting the sentences that cite the change');
      if (res && refreshReceipts) refreshReceipts();
      return res;
    }
    if (action.id === 'draft') {
      const res = await run('draft', {}, action.label || 'Writing both documents');
      if (res && refreshReceipts) refreshReceipts();
      const leftOut = leftOutNotice(res?.result?.dropped);
      if (leftOut && ws.setNotice) ws.setNotice({ kind: 'info', message: leftOut });
      return res;
    }
    if (action.id === 'export') {
      const res = await act('export');
      if (res && res.result) {
        if (setPack) setPack(res.result);
      }
      if (res && refreshReceipts) refreshReceipts();
      return res;
    }
    if (typeof action.id === 'string' && action.id.startsWith('goto:')) {
      const docId = action.id.slice(5);
      if (setTab) setTab(docId);
      return null;
    }
    if (action.id === 'try-correction') {
      if (ui && typeof ui.openCorrection === 'function') {
        ui.openCorrection(action.factId);
      }
      return null;
    }
    if (typeof action.id === 'string' && action.id.startsWith('approve:')) {
      const res = await approve(action.docId, action.docRevision);
      if (res && refreshReceipts) refreshReceipts();
      return res;
    }
    return null;
  }

  function downloadTrace(receipts, mode, budget) {
    const exportedAt = new Date().toISOString();
    const trace = { exportedAt, mode, budget, receipts };
    downloadBlob('applyarc-evidence-trace.json', JSON.stringify(trace, null, 2), 'application/json');
  }

  function downloadPackMarkdown(pack) {
    if (!pack) return;
    const content = packMarkdown(pack);
    downloadBlob('applyarc-pack.md', content, 'text/markdown');
  }

  function downloadEvidencePass(pack) {
    if (!pack) return;
    downloadBlob('evidence-pass.html', evidencePassHtml(pack), 'text/html');
  }

  async function copyText(text) {
    let copied = false;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function') {
        await navigator.clipboard.writeText(text);
        copied = true;
      }
    } catch { /* The notice below offers a manual copy when clipboard access fails. */ }
    ws.setNotice?.(copied
      ? { kind: 'info', message: 'Copied. Paste it into the employer’s form.' }
      : { kind: 'error', message: 'Could not copy automatically. Select the answer text and copy it manually.' });
    return copied;
  }

  return {
    addNotes,
    startSample,
    startOwnApplication,
    decideFact,
    confirmFacts,
    answer,
    resolveSourceConflict,
    skip,
    edit,
    strengthen,
    acceptSuggestion,
    dismissSuggestion,
    correct,
    decideChange,
    applyChanges,
    cancelRepair,
    approve,
    primary,
    downloadTrace,
    downloadPackMarkdown,
    downloadEvidencePass,
    copyText,
    followUp,
  };
}
