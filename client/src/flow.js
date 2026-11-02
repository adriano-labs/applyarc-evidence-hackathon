export function unreadSource(ws) {
  const sources = ws?.applicant?.sources || [];
  for (let i = 0; i < sources.length; i++) {
    const s = sources[i];
    if (s.kind === 'correction') continue;
    if (s.read === true) continue;
    return s;
  }
  return null;
}

// The confirmed fact the sample correction changes, while no correction has been tried yet.
// Is this the fact the sample correction changes? A live model's quote can differ from the
// notes' wording, so a sample names a key phrase (`anchor`); without one, the whole quote must match.
export function matchesSampleCorrection(fact, sample) {
  const correction = sample?.correction;
  if (!correction || !fact?.quote) return false;
  return correction.anchor ? fact.quote.includes(correction.anchor) : fact.quote.trim() === correction.quote?.trim();
}

function sampleCorrectionFact(ws, sample) {
  const app = ws?.application;
  if (!sample?.correction || app?.repair || app?.lastRepair) return null;
  return (ws?.applicant?.facts ?? []).find((f) => f.status === 'confirmed' && matchesSampleCorrection(f, sample)) ?? null;
}

// The next document to approve: the open one if it still needs approving, else the first that does.
// What the applicant should know before approving: their own unchecked words, and requirements not answered.
function approveWarning(stats) {
  const own = stats.ownWords ?? 0;
  const missing = [...(stats.unanswered ?? []), ...(stats.leftOut ?? [])].map((r) => r.text);
  const parts = [
    own ? `${own} ${own === 1 ? 'sentence is' : 'sentences are'} in your own words and not checked against your facts.` : null,
    missing.length ? `Not answered: ${missing.join('; ')}.` : null,
  ].filter(Boolean);
  return parts.length ? `Before you approve: ${parts.join(' ')}` : undefined;
}

function approveAction(view, ws, currentTab) {
  const pending = (ws?.application?.form?.documents || []).filter((d) => view?.approvals?.[d.id] !== 'approved');
  const doc = pending.find((d) => d.id === currentTab) || pending[0];
  if (!doc) return null;
  const title = (doc.title || '').toLowerCase();
  if (doc.id !== currentTab) return { id: `goto:${doc.id}`, label: `Review and approve the ${title}` };
  const stats = view?.stats?.[doc.id] || {};
  if (stats.overLimit) return { id: null, hint: `The ${title} is ${stats.words} words: shorten it to ${stats.wordLimit} before you approve it.` };
  const revision = ws?.application?.documents?.[doc.id]?.revision;
  const warning = approveWarning(stats);
  return { id: `approve:${doc.id}`, label: `Approve the ${title}, version ${revision}`, docId: doc.id, docRevision: revision, ...(warning ? { warning } : {}) };
}

export function primaryAction(view, ws, currentTab, sample) {
  const v = view?.next;
  if (v === 'read') {
    const u = unreadSource(ws);
    if (u && u.kind === 'answer') {
      return { id: 'read', label: 'Read my answer' };
    }
    return { id: 'read', label: 'Read my notes' };
  }
  if (v === 'check') {
    return { id: 'check', label: 'Check what the form still needs' };
  }
  if (v === 'draft') {
    return { id: 'draft', label: 'Write both documents' };
  }
  if (v === 'export') {
    if (ws?.application?.exports && ws.application.exports.length > 0) {
      return { id: 'next-application', label: 'Start your next application', secondary: { id: 'export', label: 'Open your pack' } };
    }
    return { id: 'export', label: 'Preview the export' };
  }
  if (v === 'repair-proposal') {
    return { id: 'repair', label: 'Propose the changes' };
  }
  if (v === 'approve') {
    const approve = approveAction(view, ws, currentTab);
    const fact = sampleCorrectionFact(ws, sample);
    if (!fact) return approve;
    return { id: 'try-correction', label: `Try ${sample.name}’s correction`, hint: `Now: correct one of ${sample.name}’s facts, or approve.`, factId: fact.id, ...(approve?.id ? { secondary: approve } : {}), ...(approve?.warning ? { warning: approve.warning } : {}) };
  }
  if (v === 'facts') {
    return { id: null, hint: 'Now: confirm or reject each fact.', show: 'facts' };
  }
  if (v === 'question') {
    if (view?.sourceCorrections?.length) return { id: null, hint: 'Now: choose the right account, or explain the difference.', show: 'question' };
    return { id: null, hint: 'Now: answer one question, or skip it.', show: 'question' };
  }
  if (v === 'decide') {
    return { id: null, hint: 'Now: decide on the earlier fact your answer was about.', show: 'decide' };
  }
  if (v === 'repair') {
    return { id: null, hint: 'Now: review the proposed changes, then apply them.', show: 'repair' };
  }
  return null;
}

export function thenLine(view, ws, sample) {
  const v = view?.next;
  if (v === 'read') {
    return 'Then: you confirm each fact it finds.';
  }
  if (v === 'facts') {
    return 'Then: the app asks about anything missing.';
  }
  if (v === 'question') {
    if (view?.sourceCorrections?.length) return 'Then: review the changes to your existing documents.';
    return 'Then: both documents are written from your facts.';
  }
  if (v === 'decide') {
    return 'Then: both documents are written.';
  }
  if (v === 'draft') {
    return 'Then: every sentence cites its facts.';
  }
  if (v === 'approve') {
    return sampleCorrectionFact(ws, sample) ? 'Then: only the sentences citing that fact are rewritten.' : 'Then: export a pack marked NOT SUBMITTED.';
  }
  if (v === 'repair') {
    return 'Then: approve the new versions.';
  }
  if (v === 'export') {
    if (ws?.application?.exports && ws.application.exports.length > 0) {
      return 'Your pack is ready. Nothing was submitted.';
    }
    return 'Nothing is submitted: you paste it in yourself.';
  }
  return null;
}

export function autoStep(view) {
  const v = view?.next;
  if (v === 'read') return 'read';
  if (v === 'check') return 'check';
  if (v === 'repair-proposal') return 'repair';
  return null;
}

export function defaultTab(view, ws) {
  const repair = ws?.application?.repair;
  if (repair && Array.isArray(repair.items) && repair.items.length > 0) {
    return repair.items[0].docId;
  }
  const v = view?.next;
  if (v === 'notes' || v === 'read' || v === 'facts' || v === 'check' || v === 'question') {
    return 'notes';
  }
  return 'answer';
}

export function factRequirements(ws) {
  const coverage = ws?.application?.coverage || {};
  const result = {};
  const reqKeys = Object.keys(coverage);
  for (let r = 0; r < reqKeys.length; r++) {
    const reqId = reqKeys[r];
    const factIds = coverage[reqId] || [];
    for (let f = 0; f < factIds.length; f++) {
      const factId = factIds[f];
      if (!result[factId]) {
        result[factId] = [];
      }
      result[factId].push(reqId);
    }
  }
  return result;
}

export function sourceKinds(ws) {
  const sources = ws?.applicant?.sources || [];
  const result = {};
  for (let i = 0; i < sources.length; i++) {
    const s = sources[i];
    if (s && s.id) {
      result[s.id] = s.kind;
    }
  }
  return result;
}

export function untouchedCount(ws) {
  const repair = ws?.application?.repair;
  const documents = ws?.application?.documents ?? {};
  const total = ['answer', 'letter'].reduce((sum, id) => sum + (documents[id]?.segments?.length ?? 0), 0);
  const changed = Array.isArray(repair?.items) ? repair.items.length : 0;
  return total - changed;
}

function formatDateEnGB(date) {
  return date.toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTimeEnGB(date) {
  return date.toLocaleString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' UTC';
}

// Under each document in the pack: the applicant's own unchecked words, and what is not answered.
export function docNotes(doc) {
  const own = doc.ownWords ?? 0;
  return [
    own ? `Your own words, not checked against your facts: ${own} ${own === 1 ? 'sentence' : 'sentences'}.` : null,
    doc.notAnswered?.length ? `Not answered: ${doc.notAnswered.join('; ')}.` : null,
  ].filter(Boolean);
}

export function packMarkdown(pack) {
  const app = pack.application || {};
  const company = app.company || '';
  const role = app.role || '';
  const lines = [];
  lines.push(`# ${pack.status}: ${company} · ${role}`);
  lines.push('');
  if (pack.notice) {
    lines.push(pack.notice);
    lines.push('');
  }
  const formUrl = app.url || '';
  const snapshot = app.snapshotFetchedAt ? formatDateEnGB(new Date(app.snapshotFetchedAt)) : '';
  lines.push(app.source === 'applicant-pasted'
    ? 'Form: Pasted and confirmed by the applicant. The employer page has not been checked.'
    : `Form: ${formUrl} (snapshot of ${snapshot})`);
  const prepared = pack.createdAt ? formatDateTimeEnGB(new Date(pack.createdAt)) : '';
  lines.push(`Prepared: ${prepared}`);
  lines.push('');
  
  const docs = pack.documents || [];
  for (let d = 0; d < docs.length; d++) {
    const doc = docs[d];
    lines.push(`## ${doc.title} (version ${doc.revision}, ${doc.words} of ${doc.wordLimit} words)`);
    lines.push('');
    for (const note of docNotes(doc)) lines.push(note);
    if (docNotes(doc).length) lines.push('');
    if (doc.text) {
      lines.push(doc.text);
      lines.push('');
    }
    if (doc.references && Array.isArray(doc.references) && doc.references.length > 0) {
      lines.push('Your evidence');
      for (let r = 0; r < doc.references.length; r++) {
        const ref = doc.references[r];
        lines.push(`${ref.n}. ${ref.statement} (your words: “${ref.quote}”)`);
      }
      lines.push('');
    }
  }
  if (pack.portalTasks && Array.isArray(pack.portalTasks) && pack.portalTasks.length > 0) {
    lines.push('## Still to do on the employer’s site');
    lines.push('');
    for (let t = 0; t < pack.portalTasks.length; t++) {
      lines.push(`- [ ] ${pack.portalTasks[t]}`);
    }
    lines.push('');
  }
  const result = lines.join('\n');
  return result.endsWith('\n') ? result : `${result}\n`;
}

export function pendingSegmentIds(ws, docId) {
  const repair = ws?.application?.repair;
  if (!repair) return [];
  if (!docId) return [];
  const items = repair.items || [];
  const ids = [];
  for (let i = 0; i < items.length; i++) {
    if (items[i] && items[i].docId === docId && items[i].segmentId) {
      ids.push(items[i].segmentId);
    }
  }
  return ids;
}

// Pronoun forms for a sample applicant, from the possessive the server gives ('her' or 'his').
export function pronouns(possessive = 'her') {
  return possessive === 'his'
    ? { possessive: 'his', Possessive: 'His', subject: 'he', object: 'him', reflexive: 'himself' }
    : { possessive: 'her', Possessive: 'Her', subject: 'she', object: 'her', reflexive: 'herself' };
}

// What a model step's tool call did, in plain words, for the status line while it runs.
// The receipts keep the exact tool names.
export function toolLine(name, note) {
  if (name === 'verify_quote') return note === 'verbatim' ? 'Checked a quote word for word against the notes' : 'Found a quote that is not word for word in the notes';
  if (name === 'word_count') return `Counted the words: ${note}`;
  if (name === 'form_requirements') return 'Read what the form asks for';
  return `${name}: ${note}`;
}

// After a draft, the sentences the evidence check left out, said once and plainly.
export function leftOutNotice(dropped = []) {
  const n = dropped.length;
  if (!n) return null;
  return n === 1
    ? 'The review could not establish support for 1 sentence, so it was left out. Check the evidence before adding your own wording.'
    : `The review could not establish support for ${n} sentences, so they were left out. Check the evidence before adding your own wording.`;
}
