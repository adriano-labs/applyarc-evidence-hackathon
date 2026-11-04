// The client's single source of truth: the last workspace the server sent,
// plus the progress of a running model step. Every write carries the
// revision it was based on; a stale write reloads and says so.
import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from './api.js';
import { toolLine } from './flow.js';

const STALE = 'This was already changed, in another tab or by a second click. Showing the latest.';
// Failures where trying the same thing again can help; a refusal would only repeat.
const RETRYABLE = new Set(['busy', 'cut', 'timeout', 'network', 'invalid-output', 'invalid-draft', 'failed', 'incomplete', 'internal', 'provider']);
// The demo's shared budget ran out mid-journey; a fresh start runs on the labelled fixture.
const CAP_HINT = 'Press Start again to continue with Ellie’s or Ana’s labelled sample.';
const disconnected = (error) => error?.code === 'cut' || error?.code === 'network' || error instanceof TypeError;

export function useWorkspace() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState(null);
  const [pending, setPending] = useState(false);
  const revision = useRef(0);
  const actInFlight = useRef(false);
  const runInFlight = useRef(false);
  const recoveringRef = useRef(false);
  const recoveryTimerRef = useRef(null);
  const mountedRef = useRef(true);
  const recoveryTokenRef = useRef(0);

  const clearRecoveryTimer = useCallback(() => {
    if (recoveryTimerRef.current) {
      clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = null;
    }
  }, []);

  const stopRecovery = useCallback(() => {
    recoveringRef.current = false;
    recoveryTokenRef.current += 1;
    clearRecoveryTimer();
  }, [clearRecoveryTimer]);

  const accept = useCallback((next) => {
    if (!next || !next.workspace) return next;
    revision.current = next.workspace.revision;
    setData((prev) => ({ ...(prev || {}), ...next }));
    return next;
  }, []);

  const startRecovery = useCallback((label = 'Finishing your saved step') => {
    // Allow restarting recovery (e.g. after a failed state read retry)
    recoveringRef.current = true;
    setBusy({ name: 'recover', label, stage: label, started: performance.now(), chars: 0, retry: null, tools: [], history: [], documentPreviews: {} });
    setNotice(null);
    const token = ++recoveryTokenRef.current;

    const poll = async () => {
      if (!mountedRef.current || token !== recoveryTokenRef.current) return;
      try {
        const next = await api.getState();
        if (!mountedRef.current || token !== recoveryTokenRef.current) return;
        accept(next);
        if (next?.working) {
          clearRecoveryTimer();
          recoveryTimerRef.current = setTimeout(poll, 1000);
          return;
        }
        stopRecovery();
        setBusy(null);
      } catch (e) {
        if (!mountedRef.current || token !== recoveryTokenRef.current) return;
        recoveryTokenRef.current += 1;
        clearRecoveryTimer();
        setNotice({
          kind: 'error',
          message: 'Could not check whether your saved step finished. Try refreshing its status.',
          persistent: true,
          retry: () => {
            setNotice(null);
            startRecovery(label);
          },
        });
      }
    };

    clearRecoveryTimer();
    recoveryTimerRef.current = setTimeout(poll, 50);
  }, [accept, clearRecoveryTimer, stopRecovery]);

  const recover = useCallback(async (error, retry) => {
    if (disconnected(error) || error?.code === 'stale') {
      // Refresh the saved result, never repeat an uncertain write or model call.
      startRecovery('Checking your saved step');
      if (error?.code === 'stale') setNotice({ kind: 'info', message: STALE });
      return null;
    }
    const canRetry = RETRYABLE.has(error?.code);
    const message = canRetry ? `${error.message ?? ''} Nothing you saved was lost.`.trim()
      : error?.code === 'cap' ? `${error.message ?? ''} ${CAP_HINT}`.trim() : error.message;
    setNotice({ kind: 'error', message, ...(canRetry ? { retry } : {}) });
    return null;
  }, [startRecovery]);

  const load = useCallback(() => {
    const token = ++recoveryTokenRef.current;
    setNotice(null);
    return api.getState()
      .then((next) => {
        if (!mountedRef.current || token !== recoveryTokenRef.current) return null;
        accept(next);
        if (next?.working) {
          startRecovery('Finishing your saved step');
        }
        return next;
      })
      .catch((e) => {
        if (!mountedRef.current || token !== recoveryTokenRef.current) return null;
        setNotice({ kind: 'error', message: e.message, retry: load });
        return null;
      });
  }, [accept, startRecovery]);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      mountedRef.current = false;
      stopRecovery();
      clearRecoveryTimer();
    };
  }, [load, stopRecovery, clearRecoveryTimer]);

  const act = useCallback(async (name, input = {}) => {
    if (recoveringRef.current) return null;
    if (actInFlight.current) {
      return null;
    }
    const operation = {};
    actInFlight.current = operation;
    const token = recoveryTokenRef.current;
    setPending(true);
    setNotice(null);
    try {
      const next = await api.act(name, { revision: revision.current, ...input });
      return mountedRef.current && token === recoveryTokenRef.current ? accept(next) : null;
    } catch (error) {
      return mountedRef.current && token === recoveryTokenRef.current ? recover(error, () => act(name, input)) : null;
    } finally {
      if (actInFlight.current === operation) {
        actInFlight.current = false;
        setPending(false);
      }
    }
  }, [accept, recover]);

  const run = useCallback(async (name, input = {}, label = 'Working') => {
    if (recoveringRef.current) return null;
    if (runInFlight.current) return null;
    const operation = {};
    runInFlight.current = operation;
    const token = recoveryTokenRef.current;
    setNotice(null);
    const started = performance.now();
    setBusy({ name, label, stage: label, started, chars: 0, retry: null, tools: [], history: [], documentPreviews: {} });
    try {
      const done = await api.run(name, { revision: revision.current, ...input }, (event) => {
        if (mountedRef.current && token === recoveryTokenRef.current) setBusy((b) => b && progress(b, event));
      });
      return mountedRef.current && token === recoveryTokenRef.current ? accept(done) : null;
    } catch (error) {
      return mountedRef.current && token === recoveryTokenRef.current ? recover(error, () => run(name, input, label)) : null;
    } finally {
      if (runInFlight.current === operation) {
        runInFlight.current = false;
        if (!recoveringRef.current && token === recoveryTokenRef.current) setBusy(null);
      }
    }
  }, [accept, recover]);

  const reset = useCallback(async () => {
    stopRecovery();
    const token = recoveryTokenRef.current;
    recoveringRef.current = true;
    actInFlight.current = false;
    runInFlight.current = false;
    setPending(false);
    setBusy({ name: 'recover', label: 'Starting a fresh example', started: performance.now() });
    setNotice(null);
    try {
      const next = await api.reset();
      if (!mountedRef.current || token !== recoveryTokenRef.current) return null;
      const res = accept(next);
      recoveringRef.current = false;
      if (res?.working) startRecovery();
      else setBusy(null);
      return res;
    } catch (e) {
      if (mountedRef.current && token === recoveryTokenRef.current) startRecovery('Checking the reset');
      return null;
    }
  }, [accept, startRecovery, stopRecovery]);

  return { data, busy, notice, setNotice, act, run, reset, load, pending };
}

// Fold one streamed progress event into the running step's state.
export function progress(busy, event) {
  if (event.type === 'stage' && typeof event.label === 'string') {
    const label = event.label.slice(0, 500);
    return { ...busy, stage: label, retry: null, history: recent(busy.history, 'stage', label) };
  }
  if (event.type === 'tool') {
    const label = toolLine(event.name, event.note).slice(0, 500);
    return { ...busy, toolCounts: tallied(busy.toolCounts, event), tools: [...(busy.tools ?? []), label].slice(-8), history: recent(busy.history, 'tool', label) };
  }
  if (event.type === 'document-ready') return preview(busy, event);
  if (event.type !== 'model') return busy;
  if (event.event === 'delta') return { ...busy, chars: event.chars, retry: null };
  if (event.event === 'retry') return { ...busy, retry: { attempt: event.attempt + 1, of: 3, waitMs: event.waitMs, injected: Boolean(event.injected) } };
  return busy;
}

// Calls per tool so far, plus how many quotes matched and the latest word count.
function tallied(counts = {}, { name, note }) {
  const next = { ...counts, [name]: (counts[name] ?? 0) + 1 };
  if (name === 'verify_quote' && note === 'verbatim') next.verbatim = (counts.verbatim ?? 0) + 1;
  if (name === 'word_count' && typeof note === 'string') next.words = note.slice(0, 40);
  return next;
}

function recent(history = [], kind, label) {
  if (history.at(-1)?.label === label && history.at(-1)?.kind === kind) return history;
  return [...history, { kind, label }].slice(-8);
}

function preview(busy, event) {
  const { docId, segments } = event;
  if (busy.name !== 'draft' || !['answer', 'letter'].includes(docId) || !Array.isArray(segments)) return busy;
  if (!segments.length || segments.length > 100 || segments.some((segment) => typeof segment?.text !== 'string')) return busy;
  if (segments.reduce((n, segment) => n + segment.text.length, 0) > 20000) return busy;
  const title = docId === 'answer' ? 'Project answer' : 'Cover letter';
  const document = { docId, title, segments: structuredClone(segments) };
  return { ...busy, documentPreviews: { ...busy.documentPreviews, [docId]: document } };
}
