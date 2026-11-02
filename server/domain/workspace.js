// The workspace: one applicant's notes and facts, and one application's form,
// questions, documents, repair, approvals and exports. Plain JSON throughout.

export const DOC_IDS = ['answer', 'letter'];

export function createApplication(form) {
  return {
    form,
    coverage: {},
    questions: [],
    documents: { answer: null, letter: null },
    repair: null,
    approvals: { answer: null, letter: null },
    exports: [],
  };
}

export function createWorkspace({ form, applicant = 'Ellie', now = new Date().toISOString() }) {
  return {
    schema: 1,
    revision: 0,
    createdAt: now,
    applicant: { name: applicant, sources: [], facts: [] },
    application: createApplication(form),
  };
}

export function nextId(prefix, list) {
  return `${prefix}${list.length + 1}`;
}

export function formDocument(ws, docId) {
  return ws.application.form.documents.find((d) => d.id === docId);
}

export function requirements(ws) {
  return ws.application.form.documents.flatMap((d) =>
    d.requirements.map((r) => ({ ...r, docId: d.id })),
  );
}

export function findSource(ws, sourceId) {
  return ws.applicant.sources.find((s) => s.id === sourceId);
}

export function addSource(ws, { kind, text, questionId, now = new Date().toISOString() }) {
  const source = { id: nextId('s', ws.applicant.sources), kind, text, at: now };
  if (questionId) source.questionId = questionId;
  ws.applicant.sources.push(source);
  if (kind !== 'correction') {
    for (const id of DOC_IDS) ws.application.approvals[id] = null;
  }
  return source;
}

export function confirmedFacts(ws) {
  return ws.applicant.facts.filter((f) => f.status === 'confirmed');
}

export function findFact(ws, factId) {
  return ws.applicant.facts.find((f) => f.id === factId);
}

export function sourceReadinessBlock(ws) {
  if (ws.applicant.sources.some((s) => s.kind !== 'correction' && !s.read)) {
    return 'Read your new evidence first.';
  }
  if (ws.applicant.facts.some((f) => f.status === 'proposed')) {
    return 'Review the proposed facts first.';
  }
  return null;
}
