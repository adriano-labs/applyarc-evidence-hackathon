// Strict JSON Schemas for each step's final answer. Ids are enums built from
// the live workspace, so the model can only name requirements and facts that
// exist. Every object lists all its keys as required and allows no others.
import { ACTORS } from '../domain/languages.js';

const object = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const list = (items) => ({ type: 'array', items });
const ids = (values) => (values.length ? { type: 'string', enum: values } : { type: 'string' });
const text = { type: 'string' };
const actor = { type: 'string', enum: ACTORS };

// bilingual: the applicant's words are not English, so each fact quotes them first,
// then gives the English meaning as its statement and says who did it; a conflict
// question comes with its English and the new words' meaning and actor.
export function extractSchema(requirementIds, sourceIds = [], bilingual = false) {
  const requirementList = list(ids(requirementIds));
  const conflict = { quote: text, priorSourceId: ids(sourceIds), priorQuote: text, question: text };
  return object({
    facts: list(object(bilingual
      ? { quote: text, statement: text, actor, requirementIds: requirementList }
      : { statement: text, quote: text, requirementIds: requirementList })),
    conflicts: list(object(bilingual ? { ...conflict, english: text, meaning: text, actor } : conflict)),
  });
}

export function clarifySchema(requirementIds, factIds, bilingual = false) {
  const question = { requirementId: ids(requirementIds), question: text };
  return object({
    coverage: list(object({ requirementId: ids(requirementIds), factIds: list(ids(factIds ?? [])) })),
    questions: list(object(bilingual ? { ...question, english: text, why: text } : { ...question, why: text })),
  });
}

export function draftSchema(factIds) {
  return object({
    segments: list(object({ kind: { type: 'string', enum: ['claim', 'frame'] }, text, factIds: list(ids(factIds)), startsParagraph: { type: 'boolean' } })),
  });
}

export function repairSchema(segmentIds, factIds) {
  return object({ rewrites: list(object({ segmentId: ids(segmentIds), text, factIds: list(ids(factIds)) })) });
}
