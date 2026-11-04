// The key moment: a fact changes. On a prepared workspace the applicant adds one note; the live
// model reads it, flags the contradiction itself and offers the correction, and if it reads the note
// as new facts instead, the sample's remembered correction is one click away. Otherwise that
// correction is applied to the fact it changes. Then the reviewed rewrites, and the renewed
// approvals. Nothing here changes a document without the applicant's decision.
import { CoverageLine } from './CoverageLine.jsx';
import { useState } from 'react';
import { ChangeQueue } from './ChangeQueue.jsx';
import { ConflictDecisions } from './ConflictDecisions.jsx';
import { ChangedLine, Compare } from './GuidedReview.jsx';
import { FactsPanel, QuestionPanel, ResumeButton } from './StepPanels.jsx';
import { matchesSampleCorrection, pronouns, untouchedCount } from '../flow.js';
import { noteAdded } from '../lib/prepared.js';
import { docTitles } from '../lib/trail.js';
import { glossFor, plainMeaning } from './GlossFields.jsx';
import { SpokenNote } from './SpokenNote.jsx';

// One approve button per document not yet approved, at its exact version.
function ApproveButtons({ workspace, view, locked, onApprove, primary = true }) {
  const approvals = view?.approvals ?? {};
  return (
    <div className="guided-actions">
      {(workspace?.application?.form?.documents ?? []).filter((d) => approvals[d.id] !== 'approved').map((d) => {
        const revision = workspace?.application?.documents?.[d.id]?.revision;
        return (
          <button key={d.id} type="button" className={primary ? 'btn primary' : 'btn'} disabled={locked} onClick={() => { if (locked) return; onApprove?.(d.id, revision); }}>
            Approve the {(d.title || '').toLowerCase()}, version {revision}
          </button>
        );
      })}
    </div>
  );
}

const approvedAll = (workspace, view) => {
  const docs = workspace?.application?.form?.documents ?? [];
  return docs.length > 0 && docs.every((d) => view?.approvals?.[d.id] === 'approved');
};

// The note that contradicts a confirmed fact, prefilled from the prepared state and added with one click.
function NoteToAdd({ workspace, name, locked, onAddNotes }) {
  const [text, setText] = useState(workspace.prepared.note ?? '');
  return (
    <div className="guided-note">
      <label htmlFor="guided-note">{name}’s note</label>
      <textarea id="guided-note" rows={3} value={text} disabled={locked} onChange={(e) => setText(e.target.value)} />
      <div className="guided-actions">
        <button type="button" className="btn primary" disabled={locked || !text.trim()} onClick={() => onAddNotes?.(text.trim())}>
          Add {name}’s note
        </button>
      </div>
    </div>
  );
}

// The facts read from the notes added at the key moment (on a prepared workspace, those since it
// was loaded; otherwise every note after her first). Any at all: her note came back as new facts.
function noteFacts(ws) {
  const notes = (ws?.applicant?.sources ?? []).filter((s) => s.kind === 'notes');
  const added = new Set((ws?.prepared ? notes.filter((s) => s.at >= ws.prepared.loadedAt) : notes.slice(1)).map((s) => s.id));
  return (ws?.applicant?.facts ?? []).filter((f) => added.has(f.sourceId));
}

// Her note changed nothing: the remembered correction is offered on every edition, with why when
// the model read the note as new facts. The repair after it still runs on the live model.
// Before her note's facts are checked, the offer sets them aside, so the correction is not listed twice.
function TypedOffer({ workspace, sample, onTyped, unchecked = false }) {
  const why = noteFacts(workspace).length ? `The model read ${pronouns(sample?.possessive).possessive} note as new facts, not as a correction. ` : '';
  const how = unchecked ? 'Correct the fact yourself instead: the facts read from the note are set aside, and the repair still runs live.' : 'Correct the fact yourself: one click, and the repair still runs live.';
  return (
    <div className="guided-typed-offer">
      <p>{why}{how}</p>
      <div className="guided-actions">
        <button type="button" className="btn primary" onClick={onTyped}>{unchecked ? 'Correct this fact instead' : 'Correct this fact'}</button>
      </div>
    </div>
  );
}

// After the note: whatever the live model's reading left for the applicant, in the panels the earlier
// steps use, or the renewed approvals when it left nothing to rewrite, with the typed correction.
function AfterNote({ workspace, view, busy, locked, sample, handlers, voice, onTyped }) {
  const next = view?.next;
  if (next === 'read' || next === 'check') {
    return busy ? null : <ResumeButton id={next} label={next === 'read' ? 'Read the saved note' : 'Check the saved facts'} onPrimary={handlers.onPrimary} />;
  }
  if (next === 'facts') {
    const unchecked = noteFacts(workspace).filter((f) => f.status === 'proposed');
    const setAside = async () => { for (const f of unchecked) await handlers.onDecideFact?.(f.id, 'reject'); onTyped(); };
    return (
      <>
        {onTyped && unchecked.length && !busy ? <TypedOffer workspace={workspace} sample={sample} onTyped={setAside} unchecked /> : null}
        <FactsPanel workspace={workspace} view={view} busy={busy} sample={sample} onDecideFact={handlers.onDecideFact} onHoverFact={handlers.onHoverFact} onConfirmFacts={handlers.onConfirmFacts} />
      </>
    );
  }
  if (next === 'decide') return <ConflictDecisions decisions={view?.conflictDecisions} busy={Boolean(busy)} onCorrect={handlers.onCorrectConflict} onSettle={handlers.onSettleConflict} />;
  if (next === 'question') return <QuestionPanel workspace={workspace} view={view} sample={sample} busy={busy} onAnswer={handlers.onAnswer} onSkip={handlers.onSkip} onResolveSourceConflict={handlers.onResolveSourceConflict} voice={voice} />;
  return (
    <div className="guided-change-start">
      <p>Nothing was corrected, so both documents stay as they were.</p>
      {onTyped ? <TypedOffer workspace={workspace} sample={sample} onTyped={onTyped} /> : null}
      <ApproveButtons workspace={workspace} view={view} locked={locked} onApprove={handlers.onApprove} primary={!onTyped} />
    </div>
  );
}

// The sample's remembered correction against the confirmed fact it changes, applied in one click.
function SampleStart({ workspace, view, locked, sample, handlers }) {
  const fact = (workspace?.applicant?.facts ?? []).find((f) => f.status === 'confirmed' && matchesSampleCorrection(f, sample)) ?? null;
  if (!fact) {
    return (
      <div className="guided-change-start">
        <p>No confirmed fact mentions this, so nothing needs rewriting.</p>
        <ApproveButtons workspace={workspace} view={view} locked={locked} onApprove={handlers.onApprove} />
      </div>
    );
  }
  const n = view?.citations?.[fact.id];
  return (
    <div className="guided-change-start">
      <Compare rows={[[`${sample?.name || 'Ellie'} remembers`, `“${sample?.correction?.text}”`], ...(fact.language ? [['In English', plainMeaning(sample.correction.meaning)]] : []),
        [`Fact [${n}] says`, fact.language ? `“${fact.quote}” (${fact.statement})` : fact.statement]]} />
      <button type="button" className="btn primary" disabled={locked} onClick={() => { if (locked) return; handlers.onCorrectFact?.(fact.id, sample?.correction?.text, ...(fact.language ? [glossFor(fact, { ...sample.correction, meaning: plainMeaning(sample.correction.meaning) })] : [])); }}>
        Correct this fact
      </button>
    </div>
  );
}

export function GuidedChange({ workspace, view, busy, pending, sample, handlers = {}, voice, receipts = [] }) {
  // typed: her note was set aside, or read without a correction, so the remembered correction is
  // applied directly: the one path that needs no model to flag anything, on every edition.
  const [typed, setTyped] = useState(false);
  const repair = workspace?.application?.repair;
  const lastRepair = workspace?.application?.lastRepair;
  const locked = Boolean(busy) || Boolean(pending);
  if (repair) {
    const fact = (workspace?.applicant?.facts ?? []).find((f) => f.id === repair.factId);
    return (
      <ChangeQueue repair={repair} fact={fact} number={view?.citations?.[repair.factId]} docTitles={docTitles(workspace)} busy={busy} pending={pending}
        onDecide={handlers.onDecideChange} onApply={handlers.onApplyChanges} onPropose={handlers.onProposeRepair} onCancel={handlers.onCancelRepair}
        untouchedCount={untouchedCount(workspace)} receipts={receipts} statusShown />
    );
  }
  if (lastRepair) {
    return (
      <div className="guided-change-done">
        <ChangedLine changed={lastRepair.changed ?? 0} />
        <CoverageLine view={view} />
        <div className="guided-actions">
          <button type="button" className="btn" onClick={() => handlers.onReview?.(4)}>Review updated documents</button>
        </div>
        <ApproveButtons workspace={workspace} view={view} locked={locked} onApprove={handlers.onApprove} />
        {busy ? <p className="guided-expect">Approve unlocks when this step finishes.</p> : null}
        {approvedAll(workspace, view) ? (
          <div className="guided-actions">
            <button type="button" className="btn primary big" onClick={() => handlers.onPrimary?.({ id: 'export', label: 'Preview the export' })}>See the application</button>
          </div>
        ) : null}
      </div>
    );
  }
  // A sample who speaks says her correction on the live model, which reads it and flags the contradiction itself.
  const spoken = Boolean(sample?.clips?.correction && voice);
  const onTyped = sample?.correction ? () => setTyped(true) : undefined;
  if (typed || (!workspace?.prepared && !spoken)) return <SampleStart workspace={workspace} view={view} locked={locked} sample={sample} handlers={handlers} />;
  const said = workspace?.prepared ? noteAdded(workspace) : (workspace?.applicant?.sources ?? []).filter((x) => x.kind === 'notes').length > 1;
  if (said) return <AfterNote workspace={workspace} view={view} busy={busy} locked={locked} sample={sample} handlers={handlers} voice={voice} onTyped={onTyped} />;
  return spoken
    ? <SpokenNote sample={sample} locked={locked} onAddNotes={handlers.onAddNotes} onTyped={onTyped} fallback={workspace?.prepared?.note ?? ''} />
    : <NoteToAdd workspace={workspace} name={sample?.name || 'Ellie'} locked={locked} onAddNotes={handlers.onAddNotes} />;
}
