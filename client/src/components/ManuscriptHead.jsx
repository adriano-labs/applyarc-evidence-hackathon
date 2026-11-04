// A document's head: title and approval, version and who wrote it, and what the evidence check checks.
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { family } from '../lib/trail.js';
import './ManuscriptHead.css';

function ApprovalChip({ approval, revision, approvedRevision }) {
  if (approval === 'approved') {
    return (
      <span className="approval approved">
        <CheckCircle2 size={16} aria-hidden="true" />
        Approved · version {revision}
      </span>
    );
  }
  if (approval === 'stale') {
    return (
      <span className="approval stale">
        <AlertTriangle size={16} aria-hidden="true" />
        {approvedRevision !== undefined && approvedRevision !== null ? (
          <>
            <del>Approved · version {approvedRevision}</del>{' '}
          </>
        ) : null}
        Changed since you approved: review version {revision}
      </span>
    );
  }
  return null;
}

// Who wrote the document, as a link to the receipts. Another firm's model never reads as Meta.
function stampText(mode, receipts) {
  if (mode.id === 'fixture') return 'Fixture, not a model ›';
  const model = receipts.findLast((r) => r.flow === 'draft' && r.model)?.model ?? mode.model;
  const name = family(model, mode.isMeta).name;
  return mode.isMeta ? `${name} · Activity ›` : `${name} (not Meta) ›`;
}

function stampAriaLabel(mode, receipts) {
  if (mode.id === 'fixture') return 'Hand-written fixture, not a model · What the model did';
  const model = receipts.findLast((r) => r.flow === 'draft' && r.model)?.model ?? mode.model;
  return mode.isMeta ? `Drafted by ${model} · What Meta did` : `Drafted by ${model} (not Meta) · What the model did`;
}

// What the evidence check checks: drafted claims cite confirmed facts; the applicant's own sentences and the frame lines are counted apart.
function evidenceText(segments) {
  const count = (test) => segments.filter(test).length;
  const claims = count((s) => s.kind === 'claim' && s.author !== 'user');
  const own = count((s) => s.author === 'user');
  const frames = count((s) => s.kind === 'frame');
  const parts = [
    claims && (claims === 1 ? '1 statement, citing a fact you confirmed' : `${claims} statements, each citing a fact you confirmed`),
    own && (own === 1 ? '1 sentence in your own words' : `${own} sentences in your own words`),
    frames && (frames === 1 ? '1 greeting or sign-off line' : `${frames} greeting or sign-off lines`),
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

// languageLine: for words in another language, what drafted the English and who confirmed its meaning.
export function ManuscriptHead({ docId, title, revision, stats, approval, approvedRevision, segments = [], receipts = [], mode, onReceipts, hintSeen, correctionNotice, languageLine }) {
  const evidence = evidenceText(segments);
  return (
    <header className="manuscript-head">
      <div className="manuscript-title-row">
        <h2 id={`doc-title-${docId}`}>{title}</h2>
        <ApprovalChip approval={approval} revision={revision} approvedRevision={approvedRevision} />
      </div>
      <p className="manuscript-meta">
        <span>Version {revision} · {stats.words} of {stats.wordLimit} words</span>
        {mode ? (
          <>
            {' · '}
            <button type="button" className="btn link small manuscript-stamp" onClick={onReceipts} aria-label={stampAriaLabel(mode, receipts)} title={stampAriaLabel(mode, receipts)}>
              {stampText(mode, receipts)}
            </button>
          </>
        ) : null}
      </p>
      {languageLine ? <p className="manuscript-language">{languageLine}</p> : null}
      {stats.unanswered?.length ? <p className="manuscript-missing">Not answered yet: {stats.unanswered.map((r) => r.text).join('; ')}</p> : null}
      {mode && mode.id !== 'fixture' && <p className="manuscript-hint">AI drafts can contain mistakes. Check the wording before approving.</p>}
      <details className="manuscript-help">
        <summary>Evidence and editing help</summary>
        {evidence && <p className="manuscript-evidence">{evidence}</p>}
        {mode && mode.id !== 'fixture' && <p className="manuscript-hint">The AI reviews how each claim follows from your confirmed facts. Your own wording is labelled separately.</p>}
        {!hintSeen && <p className="manuscript-hint">Point at a number to see the words it came from; click it to keep it lit. Click a sentence to edit it.</p>}
      </details>
      {correctionNotice}
    </header>
  );
}
