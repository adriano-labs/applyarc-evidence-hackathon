// The guided walk-through's cited answer: a number opens the words it came from, in place.
import { useEffect, useRef, useState } from 'react';
import { DocumentView } from './DocumentView.jsx';
import { CitePeek } from './CitePeek.jsx';
import { pronouns, sourceKinds } from '../flow.js';
import { sourceLabel } from './References.jsx';
import { withActor } from '../lib/actor.js';
import { languageName, spokenIds, workspaceLanguage } from '../lib/language.js';
import { draftedFromLine } from '../lib/spokenLines.js';
import { refusedCount } from '../lib/finish.js';
import { modelSteps } from '../lib/format.js';
import { family, plural } from '../lib/trail.js';

// Losses kept, from the record: the sentences the evidence check refused before she saw the draft,
// said where her words are in another language.
function RefusedCallout({ n, words, receipts }) {
  if (!n || !words) return null;
  const rewrite = modelSteps(receipts).findLast((r) => r.step === 'revise' && !r.error);
  const who = rewrite ? family(rewrite.model, rewrite.isMeta).tag.replace(/^Model$/, 'the model') : 'the model';
  return <p className="guided-refused">Before you saw this, the evidence check refused {plural(n, 'sentence', 'sentences')} against {words} and sent {n === 1 ? 'it' : 'them'} back to {who} to rewrite. See “What Meta did”.</p>;
}

export function GuidedAnswer({ workspace, view, busy = null, possessive = 'her', receipts = [], onCite, onHoverFact }) {
  const p = pronouns(possessive);
  const [shownDocId, setShownDocId] = useState('answer');
  const [pinned, setPinned] = useState(null);
  const [preview, setPreview] = useState(null);
  const peekRef = useRef(null);

  useEffect(() => {
    if (preview || pinned) {
      peekRef.current?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [preview, pinned]);

  const docId = shownDocId || 'answer';
  const doc = workspace?.application?.documents?.[docId] || null;
  const formDocs = workspace?.application?.form?.documents || [];
  const title = formDocs.find((d) => d.id === docId)?.title || (docId === 'answer' ? 'Project answer' : 'Cover letter');
  const citations = view?.citations || {};
  const stats = view?.stats?.[docId] || { words: 0, wordLimit: 0, overLimit: false };
  const approvals = view?.approvals || {};
  const approval = approvals[docId] || 'none';
  const locked = Boolean(busy);
  const facts = workspace?.applicant?.facts || [];

  const activePeek = preview || pinned;
  const activeFact = activePeek?.factId ? facts.find((f) => f.id === activePeek.factId) : null;
  const sourceLbl = activeFact ? withActor(sourceLabel(sourceKinds(workspace)[activeFact.sourceId], p.possessive, spokenIds(workspace).has(activeFact.sourceId)), activeFact, workspace?.applicant?.name) : undefined;

  let peekProp = null;
  if (activePeek && activeFact) {
    peekProp = {
      segmentId: activePeek.segmentId,
      content: (
        <div ref={peekRef}>
          <CitePeek fact={activeFact} n={citations[activeFact.id]} sourceLabel={sourceLbl} inline />
        </div>
      ),
    };
  }

  return (
    <div className="guided-answer">
      {doc ? (
        <DocumentView
          title={title}
          doc={doc}
          citations={citations}
          approval={approval}
          stats={stats}
          locked={locked}
          peek={peekProp}
          languageLine={draftedFromLine(workspace, doc, receipts)}
          onPin={(factId, segmentId) => {
            setPinned((prev) => (prev?.factId === factId && prev?.segmentId === segmentId ? null : { factId, segmentId }));
            if (onCite) onCite(factId);
            if (onHoverFact) onHoverFact(factId);
          }}
          onCite={(factId, segmentId) => {
            setPreview(factId == null ? null : { factId, segmentId });
            if (onCite) onCite(factId);
            if (factId != null && onHoverFact) onHoverFact(factId);
          }}
        />
      ) : null}
      <RefusedCallout n={refusedCount(receipts)} receipts={receipts} words={draftedFromLine(workspace, doc, receipts) ? `${p.possessive} ${languageName(workspaceLanguage(workspace))} words` : null} />
      <button
        type="button"
        className="btn link"
        onClick={() => setShownDocId((d) => (d === 'answer' ? 'letter' : 'answer'))}
      >
        {docId === 'answer' ? `Show ${p.possessive} cover letter` : `Show ${p.possessive} answer`}
      </button>
    </div>
  );
}
