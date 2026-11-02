// The shape gate: a document is never presented as ready when the answer carries
// letter text, a sentence is said twice, the text is over the word limit, or no
// claim survives. 29 Oct held-out runs on Modal: an empty answer, a letter pasted
// into the answer, and answers over the limit all passed the evidence check.
import { describe, expect, it, vi } from 'vitest';
import { draftOne } from '../server/agent/draftFlow.js';
import { draftedWorkspace } from './helpers.js';

const claim = (text, factIds = ['f1'], startsParagraph = false) => ({ kind: 'claim', text, factIds, startsParagraph });
const good = claim('We chose Kubernetes Jobs over Slurm so every job ran in a container under a course quota.', ['f1'], true);
const supportAll = async ({ claims }) => ({ decisions: claims.map((c) => ({ id: c.id, verdict: 'supported', reason: 'Supported.' })) });
// A live model double whose answer drafts come in order; the last one repeats.
function liveAgent(drafts) {
  const queue = [...drafts];
  return { provider: { id: 'meta-test-double' }, draft: vi.fn(async () => ({ segments: queue.length > 1 ? queue.shift() : queue[0] })), revise: vi.fn(async () => ({ rewrites: [] })), review: vi.fn(supportAll) };
}
// These tests are about revision, scheduling and shape, so only the requirement their
// drafts answer is covered; completeness has its own tests (draftFlow.completeness.test.js).
async function blank() {
  const ws = await draftedWorkspace();
  ws.application.documents = { answer: null, letter: null };
  ws.application.coverage = { decision: ['f1'] };
  return ws;
}
const argsFor = (ws) => ({ form: ws.application.form, doc: ws.application.form.documents[0], docId: 'answer', facts: ws.applicant.facts, coverage: [], applicant: ws.applicant.name });
const texts = (ws) => ws.application.documents.answer.segments.map((s) => s.text);

describe('the shape gate', () => {
  it('keeps letter text out of the project answer even when it is written as a claim', async () => {
    const ws = await blank();
    const agent = liveAgent([[claim('Dear Graphcore team,', ['f1'], true), claim('I am applying for the Graduate Cloud Platform Engineer 2027 role at Graphcore.'), good, claim('Yours sincerely, Ellie')]]);
    const dropped = await draftOne(ws, 'answer', argsFor(ws), agent, () => {});
    expect(texts(ws)).toEqual([good.text]);
    expect(dropped.map((d) => d.reason)).toEqual(Array(3).fill('Greetings and sign-offs belong in the cover letter.'));
    expect(agent.revise).not.toHaveBeenCalled();
  });

  // Independent review of aad0d7f (29 Oct): "I am applying for … because …" can be a
  // supported motivation sentence; only greetings, sign-offs and the letter's own frame
  // sentences are letter text.
  it('keeps a supported motivation sentence and refuses only the letter\'s own frame sentences', async () => {
    const ws = await blank();
    const motivation = claim('I am applying for this job because I enjoy tracing failures back to their cause.', ['f3']);
    const roleLine = 'I am applying for the Graduate Cloud Platform Engineer 2027 role at Graphcore.';
    const agent = liveAgent([[good, motivation, claim(roleLine), claim('Thank you for considering my application.')]]);
    const dropped = await draftOne(ws, 'answer', argsFor(ws), agent, () => {});
    expect(texts(ws)).toEqual([good.text, motivation.text]);
    expect(dropped).toEqual([roleLine, 'Thank you for considering my application.'].map((text) => ({ docId: 'answer', text, reason: 'Greetings and sign-offs belong in the cover letter.' })));
  });

  it('says a sentence once', async () => {
    const ws = await blank();
    const second = claim('I traced the failures through dmesg and wrote the Helm change that fixed them.', ['f3']);
    const agent = liveAgent([[good, second, claim('I traced the failures through dmesg and wrote the Helm change that fixed them', ['f3'])]]);
    const dropped = await draftOne(ws, 'answer', argsFor(ws), agent, () => {});
    expect(texts(ws)).toEqual([good.text, second.text]);
    expect(dropped).toEqual([{ docId: 'answer', text: 'I traced the failures through dmesg and wrote the Helm change that fixed them', reason: 'Said already.' }]);
  });

  it('does not silently delete non-identical wording on fuzzy overlap alone', async () => {
    // Semantic/style duplication belongs to writing review. Lexical similarity also matches distinct actors, counts and dates.
    const ws = await blank();
    const first = claim('Kemble Brook Electrical takes on adult apprentices and pairs each one with the same electrician for their first year, which is why it stands out to me.', ['f3']);
    const again = claim('Kemble Brook Electrical stands out to me because it takes on adult apprentices and pairs each one with the same electrician for their first year.', ['f3']);
    const agent = liveAgent([[good, first, again]]);
    const dropped = await draftOne(ws, 'answer', argsFor(ws), agent, () => {});
    expect(texts(ws)).toEqual([good.text, first.text, again.text]);
    expect(dropped).toEqual([]);
  });

  it('redrafts once when the answer is over the word limit, then refuses it', async () => {
    const ws = await blank();
    const limit = ws.application.form.documents[0].wordLimit;
    const long = claim(`We chose Kubernetes Jobs over Slurm ${Array.from({ length: limit }, (_, i) => `w${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26) % 26)}`).join(' ')}.`, ['f1'], true);
    const agent = liveAgent([[long], [long]]);
    await expect(draftOne(ws, 'answer', argsFor(ws), agent, () => {})).rejects.toMatchObject({ code: 'over-limit' });
    expect(agent.draft).toHaveBeenCalledTimes(2);
    expect(agent.draft.mock.calls[1][0].problems).toEqual([`Over the word limit: ${long.text.split(/\s+/).length} words of ${limit}. Cut it to under ${limit} words and keep every requirement answered.`]);
    expect(ws.application.documents.answer).toBeNull();
  });

  it('keeps a redraft that comes back under the limit', async () => {
    const ws = await blank();
    const limit = ws.application.form.documents[0].wordLimit;
    const long = claim(`We chose Kubernetes Jobs over Slurm ${Array.from({ length: limit }, (_, i) => `w${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26) % 26)}`).join(' ')}.`, ['f1'], true);
    const agent = liveAgent([[long], [good]]);
    expect(await draftOne(ws, 'answer', argsFor(ws), agent, () => {})).toEqual([]);
    expect(texts(ws)).toEqual([good.text]);
  });

  it('redrafts once when no claim survives, then fails closed', async () => {
    const ws = await blank();
    const bad = claim('I deployed the production service.', ['f1'], true);
    const agent = liveAgent([[bad], [good]]);
    agent.review = vi.fn(async ({ claims }) => ({ decisions: claims.map((c) => ({ id: c.id, verdict: c.text.includes('production') ? 'contradicted' : 'supported', reason: 'The evidence does not say this.' })) }));
    expect(await draftOne(ws, 'answer', argsFor(ws), agent, () => {})).toEqual([]);
    expect(texts(ws)).toEqual([good.text]);
    expect(agent.draft).toHaveBeenCalledTimes(2);
    expect(agent.draft.mock.calls[1][0].problems).toEqual(['Sentence 1: The evidence does not say this.']);
    const ws2 = await blank();
    const stuck = liveAgent([[bad]]);
    stuck.review = agent.review;
    await expect(draftOne(ws2, 'answer', argsFor(ws2), stuck, () => {})).rejects.toMatchObject({ code: 'invalid-draft' });
    expect(stuck.draft).toHaveBeenCalledTimes(2);
    expect(ws2.application.documents.answer).toBeNull();
  });
});
