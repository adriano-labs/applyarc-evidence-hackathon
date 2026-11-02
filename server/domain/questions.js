// Clarifying questions: at most one per uncovered requirement, never asked twice.
import { refuse } from './errors.js';
import { coverage } from './facts.js';
import { addSource, nextId } from './workspace.js';

const MAX_QUESTION = 300;

// Requirements no confirmed fact covers, that no earlier question has asked
// about (whatever happened to it) and that no earlier check already looked at.
export function askableRequirements(ws) {
  const asked = new Set(ws.application.questions.map((q) => q.requirementId));
  const checked = new Set(ws.application.checked ?? []);
  return coverage(ws).filter((r) => !r.covered && !asked.has(r.id) && !checked.has(r.id));
}

// After a check, each requirement it looked at is settled: asked about, or
// left for the drafts to leave out. It is never raised again.
export function markChecked(ws, requirementIds) {
  ws.application.checked = [...new Set([...(ws.application.checked ?? []), ...requirementIds])];
}

export function addQuestions(ws, proposals, askedBy = 'model') {
  const askable = new Map(askableRequirements(ws).map((r) => [r.id, r]));
  const added = [];
  const refused = [];
  for (const p of proposals) {
    const text = String(p?.question ?? '').trim();
    let reason = null;
    if (!askable.has(p?.requirementId)) reason = 'That requirement is covered or was already asked about.';
    else if (!text.endsWith('?') || text.length > MAX_QUESTION) reason = 'A question must be one short sentence ending in "?".';
    if (reason) {
      refused.push({ requirementId: p?.requirementId ?? null, reason });
      continue;
    }
    const question = {
      id: nextId('q', ws.application.questions),
      requirementId: p.requirementId,
      text,
      why: String(p.why ?? '').trim(),
      status: 'open',
      askedBy,
    };
    ws.application.questions.push(question);
    askable.delete(p.requirementId);
    added.push(question.id);
  }
  return { added, refused };
}

function openQuestion(ws, questionId) {
  const question = ws.application.questions.find((q) => q.id === questionId);
  if (!question) refuse('invalid', 'That question does not exist.');
  if (question.status !== 'open') refuse('invalid', 'That question has already been answered or skipped.');
  return question;
}

// The answer becomes a source the applicant wrote, so facts can quote it.
export function answerQuestion(ws, questionId, text, now = new Date().toISOString()) {
  const question = openQuestion(ws, questionId);
  const answer = String(text ?? '').trim();
  if (!answer) refuse('invalid', 'Write an answer, or skip the question.');
  const source = addSource(ws, { kind: 'answer', text: answer, questionId, now });
  Object.assign(question, { status: 'answered', sourceId: source.id });
  return { question, source };
}

// "I don't know" is a valid answer: the requirement stays uncovered and the
// drafts must not claim it.
export function skipQuestion(ws, questionId) {
  const question = openQuestion(ws, questionId);
  question.status = 'skipped';
  return question;
}
