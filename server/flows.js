// Every applicant action. Plain actions change the workspace directly; agent
// actions ask the model first and admit only what the domain accepts.
import { coverage, changeFact, confirmFacts, decideFact, linkFacts, proposeFacts } from './domain/facts.js';
import { editSegment } from './domain/documents.js';
import { refuse } from './domain/errors.js';
import { buildExport } from './domain/exportPack.js';
import { addQuestions, answerQuestion, askableRequirements, markChecked, skipQuestion } from './domain/questions.js';
import { applyRepair, cancelRepair, decideItem, startRepair } from './domain/repair.js';
import { approve } from './domain/review.js';
import { addSource, confirmedFacts, createApplication, findSource } from './domain/workspace.js';
import { startNextApplication } from './domain/applications.js';
import { draftDocuments } from './agent/draftFlow.js';
import { repairDocuments } from './agent/repairFlow.js';
import { prepareOwnApplication } from './domain/ownForm.js';
import { acceptSuggestion, dismissSuggestion } from './domain/sentenceSuggestion.js';
import { strengthen } from './agent/strengthen.js';
import { activeSourceContext, citedInDrafts, conflictedFacts, heldSourceConflict, holdSourceConflict, pendingSourceConflict } from './domain/sourceConflicts.js';
import { resolveSourceConflict } from './domain/sourceConflictCorrection.js';

const MAX_NOTES = 20000;
const factView = (f) => ({ id: f.id, statement: f.statement, quote: f.quote });

export const actions = {
  resolveSourceConflict,
  startOwnApplication(ws, input, ctx = {}) {
    if (ws.applicant.sources.length || ws.archive?.length) refuse('invalid', 'Press Start again first.');
    const { applicant, notes, form } = prepareOwnApplication(input, ctx);
    ws.applicant.name = applicant;
    ws.application = createApplication(form);
    const source = addSource(ws, { kind: 'notes', text: notes });
    return { id: source.id };
  },
  notes(ws, { text }) {
    const notes = String(text ?? '').trim();
    if (!notes) refuse('invalid', 'Paste or type your notes first.');
    if (notes.length > MAX_NOTES) refuse('invalid', 'Notes are limited to 20,000 characters.');
    return addSource(ws, { kind: 'notes', text: notes });
  },
  decideFact: (ws, { factId, decision }) => decideFact(ws, factId, decision),
  confirmFacts: (ws, { factIds }) => confirmFacts(ws, factIds),
  changeFact(ws, { factId, text }) {
    const fact = changeFact(ws, factId, text);
    return { fact, repair: startRepair(ws, factId) };
  },
  answer: (ws, { questionId, text }) => answerQuestion(ws, questionId, text),
  skip: (ws, { questionId }) => skipQuestion(ws, questionId),
  edit: (ws, { docId, segmentId, text }) => editSegment(ws, docId, segmentId, text),
  acceptSuggestion: (ws, { suggestionId }) => acceptSuggestion(ws, suggestionId),
  dismissSuggestion: (ws, { suggestionId }) => dismissSuggestion(ws, suggestionId),
  decideChange: (ws, { itemId, decision, text }) => decideItem(ws, itemId, decision, text),
  applyChanges: (ws) => applyRepair(ws),
  cancelRepair: (ws) => cancelRepair(ws),
  approve: (ws, { docId, docRevision }) => approve(ws, docId, docRevision),
  export: (ws) => buildExport(ws),
  nextApplication(ws, { formId }, { forms } = {}) {
    const conflict = pendingSourceConflict(ws);
    if (conflict) refuse('source-conflict', conflict);
    const list = forms ?? [];
    const form = list.find((f) => f.id === formId);
    if (!form) refuse('invalid', 'Unknown form.');
    return startNextApplication(ws, form);
  },
  startSample(ws, { sampleId }, ctx = {}) {
    const samples = ctx.samples ?? [];
    const sample = samples.find((s) => s.id === sampleId);
    if (!sample) refuse('invalid', 'There is no such sample.');
    if (ws.applicant.sources && ws.applicant.sources.length > 0) refuse('invalid', 'Press Start again first.');
    if (sample.liveOnly && !ctx.liveModel) refuse('invalid', `${sample.name}’s sample needs the live model; this copy runs on hand-written examples for Ellie only.`);
    ws.application.form = structuredClone(sample.form);
    const source = addSource(ws, { kind: 'notes', text: sample.notes });
    return { id: source.id };
  },
  // Keep or remove the earlier fact an answered conflict was about; Correct fact is the third way.
  settleConflict(ws, { questionId, factId, decision } = {}) {
    const question = ws.application.questions.find((q) => q.id === questionId);
    const waiting = conflictedFacts(ws, question);
    const fact = factId ? waiting.find((f) => f.id === factId) : waiting.length === 1 ? waiting[0] : null;
    if (!fact) refuse('invalid', waiting.length ? 'Say which earlier fact you mean.' : 'There is no earlier fact waiting for your decision.');
    if (!['keep', 'remove'].includes(decision)) refuse('invalid', 'Choose keep or remove.');
    if (decision === 'keep') question.kept = [...(question.kept ?? []), fact.id];
    else {
      // Removing a fact a draft cites would leave that sentence without evidence.
      if (citedInDrafts(ws, fact.id)) {
        refuse('invalid', 'Your drafts use this fact. Correct it instead, so only the sentences that cite it are rewritten.');
      }
      fact.history.push({ statement: fact.statement, quote: fact.quote, sourceId: fact.sourceId, at: new Date().toISOString(), removed: true });
      fact.status = 'rejected';
    }
    return question;
  },
};

async function read(ws, { sourceId }, agent, emit) {
  const source = findSource(ws, sourceId);
  if (!source || source.kind === 'correction') refuse('invalid', 'There is nothing to read there.');
  if (source.read) refuse('invalid', 'That text has already been read.');
  const question = ws.application.questions.find((q) => q.id === source.questionId);
  emit({ type: 'stage', label: 'Reading your words' });
  const evidence = activeSourceContext(ws, source);
  const { facts, conflicts } = await agent.extract({ form: ws.application.form, source, question, evidence, emit });
  const conflict = holdSourceConflict(ws, source, conflicts);
  if (conflict) return conflict;
  const proposals = facts.map((f) => ({
    ...f,
    requirementIds: [...new Set([...(f.requirementIds ?? []), ...(question?.requirementId ? [question.requirementId] : [])])],
  }));
  source.read = true;
  return proposeFacts(ws, source.id, proposals);
}

// Deterministic first: with nothing uncovered there is no model call at all.
async function check(ws, _input, agent, emit) {
  const askable = askableRequirements(ws);
  if (!askable.length) {
    const left = coverage(ws).filter((r) => !r.covered).length;
    const label = !left ? 'Every requirement is covered: no question needed'
      : `No question needed: ${left} requirement${left === 1 ? '' : 's'} will be left out of the drafts`;
    emit({ type: 'stage', label });
    return { added: [], refused: [], modelCalled: false };
  }
  emit({ type: 'stage', label: 'Checking what the form still needs' });
  const notes = activeSourceContext(ws, { id: null }).map((s) => s.text);
  const resultClarify = await agent.clarify({ form: ws.application.form, askable, facts: confirmedFacts(ws).map(factView), notes, emit });
  const { linked, refused: _refusedLinks } = linkFacts(ws, resultClarify.coverage ?? []);
  const result = addQuestions(ws, resultClarify.questions);
  // A personal requirement the model left uncovered and unasked: the app asks
  // it itself, marked as the app's, so it can never silently drop out.
  const covered = new Set(coverage(ws).filter((r) => r.covered).map((r) => r.id));
  const asked = new Set(ws.application.questions.map((q) => q.requirementId));
  const appProposals = askable.filter((r) => r.personal && !covered.has(r.id) && !asked.has(r.id)).map((r) => ({
    requirementId: r.id,
    question: `The form asks for "${r.text}": what would you write?`,
    why: 'The app asks this itself: the form wants it in your own words, and none of your confirmed facts says it in the first person.',
  }));
  const appResult = addQuestions(ws, appProposals, 'app');
  markChecked(ws, askable.map((r) => r.id));
  return { added: [...result.added, ...appResult.added], refused: [...result.refused, ...appResult.refused], linked, modelCalled: true };
}

async function draft(ws, _input, agent, emit) {
  return draftDocuments(ws, agent, emit);
}

// While the applicant has a question to answer, no model call runs. A decision on an
// earlier fact holds drafting, approval and export, not a repair or a suggestion.
function waitForApplicant(ws) {
  const waiting = heldSourceConflict(ws) ?? (ws.application.questions.some((q) => q.status === 'open') ? 'Answer or skip the open question first.' : null);
  if (waiting) refuse('not-ready', waiting);
}

async function repair(ws, _input, agent, emit) {
  waitForApplicant(ws);
  return repairDocuments(ws, agent, emit);
}

async function strengthenSentence(ws, input, agent, emit) {
  waitForApplicant(ws);
  return strengthen(ws, input, agent, emit);
}

export const agentActions = { read, check, draft, repair, strengthen: strengthenSentence };
