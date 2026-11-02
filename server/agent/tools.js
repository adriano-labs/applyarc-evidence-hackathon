// The three tools the model calls during a step. The app defines and runs
// them; they only read. They make the checks visible on the receipt; the
// domain still validates everything the model returns.
import { isVerbatim, wordCount } from '../domain/text.js';

const object = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });

export const TOOL_DEFINITIONS = [
  {
    type: 'function', name: 'verify_quote', strict: true,
    description: 'Check that a quote is copied exactly from the applicant’s own text. Returns verbatim true or false.',
    parameters: object({ quote: { type: 'string' } }),
  },
  {
    type: 'function', name: 'form_requirements', strict: true,
    description: 'Read the employer’s form for this step: the question, its word limit, and each requirement with whether confirmed facts cover it.',
    parameters: object({}),
  },
  {
    type: 'function', name: 'word_count', strict: true,
    description: 'Count the words in a draft the way the form’s limit counts them, and return the limit.',
    parameters: object({ text: { type: 'string' } }),
  },
];

// ctx: { sources: [applicant texts], form: what form_requirements returns, wordLimit? }
export function runTool(name, args, ctx) {
  if (name === 'verify_quote') return { verbatim: ctx.sources.some((s) => isVerbatim(String(args.quote ?? ''), s)) };
  if (name === 'form_requirements') return ctx.form;
  if (name === 'word_count') return { words: wordCount(String(args.text ?? '')), limit: ctx.wordLimit ?? null };
  return { error: `Unknown tool ${name}` };
}
