import { useState } from 'react';
import { formatMs, formatTokens, formatUsd, summariseReceipts } from '../lib/format.js';
import './ReceiptsDrawer.css';

function stepLabel(step) {
  if (step === 'review') return 'Reviewed claims against cited evidence';
  if (step === 'revise') return 'Corrected only the unsupported sentences';
  if (step === 'extract') {
    return 'Read your words';
  }
  if (step === 'clarify') {
    return 'Checked what the form needs';
  }
  if (step === 'draft') {
    return 'Wrote a document';
  }
  if (step === 'repair') {
    return 'Rewrote the cited sentences';
  }
  if (step === 'transcribe') {
    return 'Turned your spoken words into text';
  }
  return step;
}

function errorMessage(error) {
  if (error === 'cut') {
    return 'Stopped: the stream was cut. Kept charged in the spend cap.';
  }
  if (error === 'timeout') {
    return 'Stopped: the model took too long to start. Kept charged in the spend cap.';
  }
  if (error === 'network' || error === 'cancelled') {
    return 'Stopped before the end. Kept charged in the spend cap.';
  }
  if (error === 'busy') {
    return 'The service was busy each time. Any attempt that may have run is counted in the spend cap.';
  }
  if (error === 'failed' || error === 'incomplete' || error === 'refused' || error === 'invalid-output') {
    return 'The model could not finish. Charged for what it used.';
  }
  return 'Refused before running. Nothing was charged.';
}

// Open state can be lifted (App opens it from the top bar) or kept here.
export function ReceiptsDrawer({ receipts = [], modeLabel = '', onDownload, open: openProp, onToggle }) {
  const [ownOpen, setOwnOpen] = useState(false);
  const open = openProp ?? ownOpen;
  const toggle = () => (onToggle ?? setOwnOpen)(!open);
  const summary = summariseReceipts(receipts);

  const title = typeof modeLabel === 'string' && modeLabel.startsWith('Meta')
    ? 'What Meta did'
    : 'What the model did';

  // Attempts that may have run and stay counted at their worst case, plus steps whose cost is unknown.
  const notSettled = (receipts ?? []).reduce((n, r) => n + (r?.unsettled || (r?.costUsd == null ? 1 : 0)), 0);

  let line;
  if (!Array.isArray(receipts) || receipts.length === 0) {
    line = 'No model calls yet';
  } else {
    const modelsText = Array.isArray(summary.models) ? summary.models.join(', ') : '';
    const stepsText = summary.steps === 1 ? '1 step' : `${summary.steps} steps`;
    const toolCallsText = summary.toolCalls === 1 ? '1 tool call' : `${summary.toolCalls} tool calls`;
    line = `${modelsText} · ${stepsText} · ${toolCallsText} · ${formatMs(summary.totalMs)} · ${formatUsd(summary.costUsd)}`;
    if (notSettled > 0) {
      line += ` + ${notSettled} not settled`;
    }
  }

  return (
    <section className="receipts">
      <button
        type="button"
        className="receipts-toggle"
        aria-expanded={open ? 'true' : 'false'}
        aria-controls="receipts-body"
        onClick={toggle}
      >
        <span className="receipts-title">{title}</span>
        <span className="receipts-line">{line}</span>
      </button>
      {open && (
        <div id="receipts-body" className="receipts-body">
          {notSettled > 0 ? (
            <p className="receipts-note">Attempts that may have run are counted at their worst case in the spend cap.</p>
          ) : null}
          <ol className="receipt-list">
            {Array.isArray(receipts) &&
              receipts.map((receipt, idx) => {
                const failed = Boolean(receipt && receipt.error);
                const attempts = receipt && typeof receipt.attempts === 'number' ? receipt.attempts : 0;
                const turns = receipt && typeof receipt.turns === 'number' ? receipt.turns : 0;
                const retries = attempts - turns > 0 ? attempts - turns : 0;
                const usage = receipt && receipt.usage ? receipt.usage : {};
                const reasoning = typeof usage.reasoning === 'number' ? usage.reasoning : 0;
                const injectedFaults = receipt?.injectedFaults ?? 0;

                return (
                  <li key={idx} className={'receipt' + (failed ? ' failed' : '')}>
                    <p className="receipt-step">
                      {stepLabel(receipt && receipt.step)}
                      {receipt && receipt.model ? (
                        <span>
                          {receipt.model}
                          {receipt.effort ? ` · effort ${receipt.effort}` : ''}
                        </span>
                      ) : null}
                    </p>
                    <p className="receipt-tokens">
                      {formatTokens(usage.input || 0)} in ({formatTokens(usage.cached || 0)} cached) · {formatTokens(usage.output || 0)} out
                      {reasoning > 0 ? ` · ${formatTokens(reasoning)} reasoning` : ''}
                    </p>
                    <p className="receipt-time">
                      first event {formatMs(receipt?.firstEventMs)}
                      {receipt?.firstOutputMs != null ? ` · first output ${formatMs(receipt.firstOutputMs)}` : ''}
                      {' · '}done {formatMs(receipt && receipt.totalMs)} · {formatUsd(receipt && receipt.costUsd)}
                      {retries > 0 ? ` · ${retries} ${retries === 1 ? 'retry' : 'retries'}` : ''}
                    </p>
                    {injectedFaults > 0 ? (
                      <p className="receipt-injected">
                        includes {injectedFaults} injected 429{injectedFaults > 1 ? 's' : ''} (a demo fault, not the model service)
                      </p>
                    ) : null}
                    {Array.isArray(receipt && receipt.toolCalls) && receipt.toolCalls.length > 0 && (
                      <ul className="receipt-tools">
                        {receipt.toolCalls.map((tc, tIdx) => (
                          <li key={tIdx}>
                            {tc && tc.name ? tc.name : ''}: {tc && tc.note ? tc.note : ''}
                          </li>
                        ))}
                      </ul>
                    )}
                    {failed && receipt.error ? (
                      <p className="receipt-error">{errorMessage(receipt.error)}</p>
                    ) : null}
                    {Array.isArray(receipt && receipt.requestIds) && receipt.requestIds.length > 0 && (
                      <p className="receipt-ids">{receipt.requestIds.join(', ')}</p>
                    )}
                  </li>
                );
              })}
          </ol>
          <button type="button" className="btn small" onClick={() => onDownload && onDownload()}>
            Download the trace (JSON)
          </button>
        </div>
      )}
    </section>
  );
}
