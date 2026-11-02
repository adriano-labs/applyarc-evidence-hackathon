export function tabStates(view, ws, busy) {
  const notes = getNotesState(view, ws, busy);
  const answer = getDocumentState('answer', view, ws);
  const letter = getDocumentState('letter', view, ws);
  return { notes, answer, letter };
}

function getNotesState(view, ws, busy) {
  if (busy?.name === 'read') {
    return { text: 'Reading…', short: 'Reading…', tone: null };
  }

  const facts = ws?.applicant?.facts || [];
  const proposed = facts.filter((f) => f.status === 'proposed');
  if (proposed.length > 0) {
    const n = proposed.length;
    return { text: `${n} to check`, short: `${n} to check`, tone: 'needs' };
  }

  const confirmed = facts.filter((f) => f.status === 'confirmed');
  if (confirmed.length > 0) {
    const n = confirmed.length;
    if (n === 1) {
      return { text: '1 fact confirmed', short: '1 fact', tone: null };
    }
    return { text: `${n} facts confirmed`, short: `${n} facts`, tone: null };
  }

  return { text: 'Start here', short: 'Start', tone: null };
}

function getDocumentState(docId, view, ws) {
  const repairItems = ws?.application?.repair?.items || [];
  if (repairItems.some((item) => item.docId === docId)) {
    return { text: 'Change proposed', short: 'Change', tone: 'needs' };
  }

  const doc = ws?.application?.documents?.[docId];
  if (!doc) {
    return { text: 'Not written yet', short: 'Not yet', tone: null };
  }

  const stats = view?.stats?.[docId];
  if (stats?.overLimit) {
    const words = stats.words;
    const wordLimit = stats.wordLimit;
    return { text: `${words} of ${wordLimit} words: over`, short: `${words}/${wordLimit}`, tone: 'needs' };
  }

  const approval = view?.approvals?.[docId];
  const revision = doc.revision;
  if (approval === 'approved') {
    return { text: `Approved · version ${revision}`, short: `v${revision}`, tone: 'approved' };
  }
  if (approval === 'stale') {
    return { text: `Changed: review version ${revision}`, short: `Review v${revision}`, tone: 'needs' };
  }

  const words = stats?.words ?? 0;
  const wordLimit = stats?.wordLimit ?? 0;
  return { text: `Version ${revision} · ${words} of ${wordLimit} words`, short: `${words}/${wordLimit}`, tone: null };
}
