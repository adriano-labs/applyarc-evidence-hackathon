import './TopBar.css';
import { Command } from 'lucide-react';
import { formatMs, formatUsd, summariseReceipts } from '../lib/format.js';
import { WorkingState } from './WorkingState.jsx';
import { DroppedWordingNotice } from './DroppedWordingNotice.jsx';

function getModeBadgeText(mode) {
  if (mode.id === 'fixture') {
    return 'Fixture: hand-written outputs, not a model';
  }
  return mode.isMeta ? mode.label : `${mode.label || mode.model}, not Meta`;
}

// Muse Spark Open's licence requires this notice to be shown prominently.
const builtWithSparkOpen = (mode) => mode?.id === 'compatible' && /muse-spark-open/i.test(mode?.model ?? '');

export function TopBar({ company, role, mode, onCommands, onReset, onReceipts, earlier, receipts = [] }) {
  const modeText = getModeBadgeText(mode);
  const modeClass = mode.id === 'fixture' ? 'mode fixture' : mode.isMeta ? 'mode meta' : 'mode ' + mode.id;
  const earlierCount = typeof earlier === 'number' ? earlier : 0;

  let receiptsButton = null;
  if (mode && mode.isMeta && Array.isArray(receipts) && receipts.length > 0) {
    const summary = summariseReceipts(receipts);
    const n = summary.steps;
    const t = summary.toolCalls;
    const stepsLabel = n === 1 ? 'step' : 'steps';
    const toolCallsLabel = t === 1 ? 'tool call' : 'tool calls';
    const name = `What Meta did: ${n} ${stepsLabel}, ${t} ${toolCallsLabel}, ${formatMs(summary.totalMs)} total model time, ${formatUsd(summary.costUsd)}`;
    receiptsButton = (
      <button type="button" className="receipts-pill" onClick={onReceipts} aria-label={name}>
        <span className="receipt-summary">{name}</span>
        <span className="receipt-short" aria-hidden="true">Meta activity · {n} {stepsLabel}</span>
      </button>
    );
  }

  const header = (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">[1]</span>
        ApplyArc Evidence
      </div>
      {company || earlierCount > 0 ? <p className="crumb">
        <strong>{company}</strong>
        <span className="crumb-sep" aria-hidden="true">·</span>
        <span>{role}</span>
        {earlierCount > 0 ? (
          <span className="earlier">
            {earlierCount} earlier application{earlierCount > 1 ? 's' : ''}
          </span>
        ) : null}
      </p> : null}
      <div className="topbar-end">
        <span className={modeClass} aria-label={modeText} title={modeText}>
          <span style={{ display: 'none' }}>{modeText}</span>
          {mode && mode.id === 'fixture' ? (
            <>
              Fixture<span className="mode-long">: hand-written outputs, not a model</span>
            </>
          ) : mode && mode.isMeta ? (
            <>
              {mode.id === 'compatible' ? 'Meta open weight' : 'Meta'}<span className="mode-long">{mode.label && mode.label.startsWith('Meta') ? mode.label.slice(4) : mode.label ? (mode.label.replace(/^Meta\s*/i, '').startsWith(':') ? mode.label.replace(/^Meta\s*/i, '') : ' ' + mode.label.replace(/^Meta\s*/i, '')) : ''}</span>
            </>
          ) : (
            <>
              {mode.label || mode.model}<span className="mode-long">, not Meta</span>
            </>
          )}
        </span>
        {builtWithSparkOpen(mode) ? <span className="built-with">Built with Muse Spark Open</span> : null}
        {receiptsButton}
        <button type="button" className="topbar-btn" aria-label="Commands (Ctrl K)" onClick={onCommands}>
          <Command size={14} aria-hidden="true" />
          <kbd>K</kbd>
        </button>
        <button type="button" className="topbar-btn" onClick={onReset}>
          Start again
        </button>
      </div>
    </header>
  );

  if (mode && mode.id === 'fixture' && mode.fallbackReason === 'live-allowance-unavailable') {
    return (
      <div>
        {header}
        <div className="status-wrap">
          <div className="notice info" role="status">
            <p>Live Meta allowance is unavailable for another journey in this visit. Ellie’s sample and Ana’s written note still work with hand-written outputs, without Meta calls. Starting again clears the application; it does not renew the allowance.</p>
          </div>
        </div>
      </div>
    );
  }

  return header;
}

export function StatusLine({ busy, notice, modeLabel, onDismiss, titles }) {
  if (notice) {
    const isError = notice.kind === 'error';
    return (
      <div className={'notice ' + notice.kind} role={isError ? 'alert' : 'status'}>
        <p>{notice.message}</p>
        {notice.retry ? (
          <button type="button" className="btn small" onClick={notice.retry}>
            Try again
          </button>
        ) : null}
        {!notice.persistent && <button type="button" className="btn small link" onClick={onDismiss}>
          Dismiss
        </button>}
        <DroppedWordingNotice details={notice.details} titles={titles} />
      </div>
    );
  }

  return busy ? <WorkingState busy={busy} modeLabel={modeLabel} /> : null;
}
