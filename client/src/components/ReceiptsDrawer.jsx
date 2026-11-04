// What Meta did, as an evidence trail: numbered runs of sentences with outcomes,
// one row per recorded step, each tagged with who did it, every technical fact
// one disclosure away. Built only from the receipts, the loop's recorded
// decisions and the saved workspace; nothing is invented while a step runs.
import { useState } from 'react';
import { Check, PenLine } from 'lucide-react';
import { formatMs, formatTokens, formatUsd, modelSteps } from '../lib/format.js';
import { preparedBy } from '../lib/prepared.js';
import { actorOf, codeRows, docTitles, family, isStage, plural, runFigures, stepSentence, summaryLine, tallyLine, toolTally, trailRuns } from '../lib/trail.js';
import { VerifyRun } from './VerifyRun.jsx';
import './ReceiptsDrawer.css';

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

function CopyIds({ ids }) {
  const [copied, setCopied] = useState(false);
  const copy = () => navigator.clipboard?.writeText(ids.join(', ')).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {});
  return <button type="button" className="btn link small" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>;
}

// Model, host and effort; tokens; timing and cost; tool calls; request ids. Closed by default.
function Details({ receipt }) {
  const usage = receipt.usage;
  // Attempts beyond the first per turn; a one-shot call (voice) has no turns and no retry.
  const retries = Math.max(0, (receipt.attempts ?? 0) - Math.max(receipt.turns ?? 0, 1));
  const timing = [
    receipt.firstEventMs != null ? `first event ${formatMs(receipt.firstEventMs)}` : null,
    receipt.firstOutputMs != null ? `first output ${formatMs(receipt.firstOutputMs)}` : null,
    typeof receipt.totalMs === 'number' ? `done ${formatMs(receipt.totalMs)}` : null,
    formatUsd(receipt.costUsd),
    retries ? plural(retries, 'retry', 'retries') : null,
  ].filter(Boolean).join(' · ');
  const tools = toolTally(receipt.toolCalls);
  const ids = Array.isArray(receipt.requestIds) ? receipt.requestIds : [];
  return (
    <details className="trail-details">
      <summary>Details</summary>
      <p>{[receipt.model, receipt.host, receipt.effort ? `effort ${receipt.effort}` : null].filter(Boolean).join(' · ')}</p>
      {receipt.step === 'transcribe' ? <><p>language hint: {receipt.languageBias ?? 'none'}</p><p>keywords: {receipt.keywords?.join(', ') || 'none'}</p></> : null}
      {usage ? <p>{formatTokens(usage.input || 0)} in ({formatTokens(usage.cached || 0)} cached) · {formatTokens(usage.output || 0)} out{usage.reasoning > 0 ? ` · ${formatTokens(usage.reasoning)} reasoning` : ''}</p> : null}
      <p>{timing}</p>
      {tools ? <p>tool calls: {tools}</p> : null}
      {receipt.injectedFaults > 0 ? <p>includes {receipt.injectedFaults} injected 429{receipt.injectedFaults > 1 ? 's' : ''} (a demo fault, not the model service)</p> : null}
      {ids.length > 0 ? <p className="trail-ids"><code>{ids.join(', ')}</code> <CopyIds ids={ids} /></p> : null}
    </details>
  );
}

function Row({ kind, tag, className = '', children }) {
  return (
    <li className={`trail-row ${kind} ${className}`.trim()}>
      <span className={`trail-tag ${kind}`}>{tag}</span>{' '}
      <div className="trail-row-body">{children}</div>
    </li>
  );
}

function ReceiptRow({ receipt, titles }) {
  return (
    <Row kind="model" tag={actorOf(receipt)} className={'receipt' + (receipt.error ? ' failed' : '')}>
      <p className="trail-sentence">{stepSentence(receipt, titles)}</p>
      {receipt.error ? <p className="trail-error">{errorMessage(receipt.error)}</p> : null}
      <Details receipt={receipt} />
    </Row>
  );
}

function Run({ run, title, decisions, titles }) {
  return (
    <li className={'trail-run' + (run.failed ? ' failed' : '')}>
      <div className="trail-run-head">
        <span className="trail-run-n">{run.n}</span>{' '}
        <span className="trail-run-title">
          {title}
          {run.host && run.host !== 'api.meta.ai' ? <> <span className="trail-run-host">{run.host}</span></> : null}
          {!run.failed ? <Check size={14} className="trail-run-done" aria-hidden="true" /> : null}
        </span>{' '}
        <span className="trail-run-meta">{runFigures(run)}</span>
      </div>
      <ol className="trail-rows">
        {run.rows.flatMap((row, i) => (isStage(row)
          ? [<Row key={i} kind="stage" tag="The app">{row.label}</Row>]
          : [<ReceiptRow key={i} receipt={row} titles={titles} />, ...codeRows(row.toolCalls).map((text, j) => <Row key={`${i}-${j}`} kind="code" tag="Checked by code">{text}</Row>)]))}
        {decisions.map((text) => <Row key={text} kind="you" tag={<><PenLine size={12} aria-hidden="true" />You</>}>{text}</Row>)}
      </ol>
    </li>
  );
}

// The step running now: its real stage label, the tool tally so far, any retry.
function Running({ busy, n }) {
  const tally = tallyLine(busy.toolCounts);
  return (
    <li className="trail-run running">
      <div className="working-stroke" aria-hidden="true" />
      <div className="trail-run-head">
        <span className="trail-run-n">{n}</span>{' '}
        <span className="trail-run-title">{busy.stage || busy.label}</span>
      </div>
      <ol className="trail-rows">
        {tally ? <Row kind="code" tag="Checked by code">{tally}</Row> : null}
        {busy.retry ? <li className="trail-row note">tried again, {busy.retry.attempt} of {busy.retry.of}</li> : null}
      </ol>
    </li>
  );
}

// When both of these weeks-old Meta models ran, their dates, from Meta's own posts (read 3 Nov 2026).
const DATED = (steps) => (steps.some((r) => /muse-voice-transcribe/i.test(r.model ?? '')) && steps.some((r) => /muse-wonder/i.test(r.model ?? ''))
  ? 'Muse Voice Transcribe was introduced in a Meta post dated 3 September 2026, and Muse Wonder in a Meta post dated 12 October 2026.' : null);

// Open state can be lifted (App opens it from the top bar) or kept here.
export function ReceiptsDrawer({ receipts = [], modeLabel = '', mode = null, busy = null, workspace = null, view = null, onDownload, open: openProp, onToggle }) {
  const [ownOpen, setOwnOpen] = useState(false);
  const open = openProp ?? ownOpen;
  const toggle = () => (onToggle ?? setOwnOpen)(!open);
  const rows = Array.isArray(receipts) ? receipts : [];
  const steps = modelSteps(rows);
  const groups = trailRuns(rows, workspace, view);
  const titles = docTitles(workspace);
  const { line, notSettled } = summaryLine(rows, groups.length);
  const openWeight = mode?.id === 'compatible';
  const running = busy?.name && busy.name !== 'recover' ? busy : null;

  const title = typeof modeLabel === 'string' && modeLabel.startsWith('Meta')
    ? 'What Meta did'
    : 'What the model did';

  const proposer = steps.findLast((r) => r.step !== 'transcribe');
  const who = !proposer ? null : proposer.provider === 'fixture' ? 'The fixture' : family(proposer.model, proposer.isMeta).tag.replace(/^Model$/, 'The model');
  const host = steps.find((r) => r.host)?.host;

  return (
    <section className="receipts">
      <button
        type="button"
        className="receipts-toggle"
        aria-expanded={open ? 'true' : 'false'}
        aria-controls="receipts-body"
        onClick={toggle}
      >
        <span className="receipts-title">{title}{openWeight ? <span className="trail-badge">Meta open weight</span> : null}</span>
        <span className="receipts-line">{line}</span>
        {workspace?.prepared ? (
          <span className="receipts-prepared">Facts and drafts: {preparedBy(workspace.prepared, mode?.model)}, before this visit and not counted here · Correction and repair: live in this visit</span>
        ) : null}
      </button>
      {open && (
        <div id="receipts-body" className="receipts-body">
          {notSettled > 0 ? (
            <p className="receipts-note">Attempts that may have run are counted at their worst case in the spend cap.</p>
          ) : null}
          {DATED(steps) ? <p className="receipts-note">{DATED(steps)}</p> : null}
          {openWeight && steps.length > 0 ? (
            <p className="receipts-note">Open-weight edition: {mode.model ?? 'the open-weight model'}{host ? `, served on ${host}` : ''}. Download the trace to verify.</p>
          ) : null}
          <ol className="trail">
            {groups.map(({ run, title: runName, decisions }) => <Run key={run.n} run={run} title={runName} decisions={decisions} titles={titles} />)}
            {running ? <Running busy={running} n={groups.length + 1} /> : null}
          </ol>
          {who ? <p className="trail-foot">{who} proposes. The app checks quotes, word counts and the form by code. You decide which facts, changes and versions are kept. Nothing is submitted.</p> : null}
          <p className="trail-footnote">A word-for-word match proves the quote, not the claim.</p>
          <VerifyRun workspace={workspace} fixture={mode?.id === 'fixture'} />
          <button type="button" className="btn small trail-download" onClick={() => onDownload && onDownload()}>
            Download the trace (JSON) to verify this run
          </button>
        </div>
      )}
    </section>
  );
}
