import { describe, expect, it } from 'vitest';
import { draftOne } from '../server/agent/draftFlow.js';
import { decideFact, proposeFacts } from '../server/domain/facts.js';
import { workspaceWithNotes } from './helpers.js';

// Seen in review: when the sentence naming the one learner is dropped, the "them"
// sentence after "four learners" fails only on the final check, which used to
// throw the whole paid draft away. Now that sentence is dropped and the rest kept.
const four = 'I supported four learners with saving and finding documents during that session; six people attended altogether.';
const one = 'One learner kept losing their file because they clicked through the save window too quickly.';
const them = 'I asked them to choose a short filename, wrote down the folder location and let them repeat the steps on their own.';
const claim = (text, factIds) => ({ kind: 'claim', text, factIds });

describe('dropping a sentence never fails the whole draft', () => {
  it('drops the "them" sentence that lost its person and keeps the rest', async () => {
    const { ws, source } = workspaceWithNotes(`${four}\n\n${one} ${them}`);
    proposeFacts(ws, source.id, [four, one, them].map((quote) => ({ statement: quote, quote, requirementIds: [] })));
    for (const f of ws.applicant.facts) decideFact(ws, f.id, 'confirm');
    ws.application.coverage = {};
    const paraphrase = claim('A learner kept losing their file by clicking through the save window.', ['f2']);
    const agent = {
      provider: { id: 'test-double' },
      draft: async () => ({ segments: [claim(four, ['f1']), paraphrase, claim(them, ['f3'])] }),
      revise: async () => ({ rewrites: [] }),
      review: async ({ claims }) => ({ decisions: claims.map((c) => ({ id: c.id, verdict: c.text === paraphrase.text ? 'uncertain' : 'supported', reason: 'test' })) }),
    };
    const doc = ws.application.form.documents[0];
    const dropped = await draftOne(ws, 'answer', { form: ws.application.form, doc, docId: 'answer', facts: ws.applicant.facts, coverage: [] }, agent);
    expect(ws.application.documents.answer.segments.map((s) => s.text)).toEqual([four]);
    expect(dropped.map((d) => d.text)).toEqual([paraphrase.text, them]);
  });
});
