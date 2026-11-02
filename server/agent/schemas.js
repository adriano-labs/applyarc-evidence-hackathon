// Strict JSON Schemas for each step's final answer. Ids are enums built from
// the live workspace, so the model can only name requirements and facts that
// exist. Every object lists all its keys as required and allows no others.
const object = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const list = (items) => ({ type: 'array', items });
const ids = (values) => (values.length ? { type: 'string', enum: values } : { type: 'string' });
const text = { type: 'string' };

export function extractSchema(requirementIds, sourceIds = []) {
  return object({
    facts: list(object({ statement: text, quote: text, requirementIds: list(ids(requirementIds)) })),
    conflicts: list(object({ quote: text, priorSourceId: ids(sourceIds), priorQuote: text, question: text })),
  });
}

export function clarifySchema(requirementIds, factIds) {
  return object({
    coverage: list(object({ requirementId: ids(requirementIds), factIds: list(ids(factIds ?? [])) })),
    questions: list(object({ requirementId: ids(requirementIds), question: text, why: text })),
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
