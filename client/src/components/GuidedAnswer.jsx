// The guided walk-through's cited answer: a number opens the words it came from, in place.
import { useEffect, useRef, useState } from 'react';
import { DocumentView } from './DocumentView.jsx';
import { CitePeek } from './CitePeek.jsx';
import { pronouns, sourceKinds } from '../flow.js';
import { sourceLabel } from './References.jsx';

export function GuidedAnswer({ workspace, view, busy = null, possessive = 'her', onCite, onHoverFact }) {
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
  const sourceLbl = activeFact ? sourceLabel(sourceKinds(workspace)[activeFact.sourceId], p.possessive) : undefined;

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
