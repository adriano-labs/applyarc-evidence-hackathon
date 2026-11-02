// A draft that leaves out a requirement a confirmed fact covers gets one redraft
// naming it, inside the single extra draft a document may have; if it is still
// left out, the draft is kept and the requirement shows as not answered.
import { describe, expect, it, vi } from 'vitest';
import { draftOne } from '../server/agent/draftFlow.js';
import { documentStats } from '../server/domain/documents.js';
import { coverage } from '../server/domain/facts.js';
import { draftedWorkspace } from './helpers.js';

const claim = (text, factIds, startsParagraph = false) => ({ kind: 'claim', text, factIds, startsParagraph });
const decision = claim('We chose Kubernetes Jobs over Slurm so every job ran in a container under a course quota.', ['f1'], true);
const problem = claim('Pods were killed because /dev/shm was only 64 MB.', ['f2']);
const ownPart = claim('I traced the failures through dmesg and wrote the Helm change that fixed them.', ['f3']);
const supportAll = async ({ claims }) => ({ decisions: claims.map((c) => ({ id: c.id, verdict: 'supported', reason: 'Supported.' })) });
function liveAgent(drafts) {
  const queue = [...drafts];
  return { provider: { id: 'meta-test-double' }, draft: vi.fn(async () => ({ segments: queue.length > 1 ? queue.shift() : queue[0] })), revise: vi.fn(async () => ({ rewrites: [] })), review: vi.fn(supportAll) };
}
async function blank() {
  const ws = await draftedWorkspace();
  ws.application.documents = { answer: null, letter: null };
  return ws;
}
const argsFor = (ws) => ({ form: ws.application.form, doc: ws.application.form.documents[0], docId: 'answer', facts: ws.applicant.facts, coverage: [], applicant: ws.applicant.name });
const texts = (ws) => ws.application.documents.answer.segments.map((s) => s.text);
const missingLine = (ws, id, facts) => `Not answered yet: "${coverage(ws).find((r) => r.id === id).text}". Use ${facts}.`;

describe('a draft that leaves a requirement out', () => {
  it('is redrafted once, naming the requirement, and the redraft that answers it is kept', async () => {
    const ws = await blank();
    const agent = liveAgent([[decision, problem], [decision, problem, ownPart]]);
    expect(await draftOne(ws, 'answer', argsFor(ws), agent, () => {})).toEqual([]);
    expect(agent.draft).toHaveBeenCalledTimes(2);
    expect(agent.draft.mock.calls[1][0].problems).toEqual([missingLine(ws, 'contribution', 'fact f3')]);
    expect(texts(ws)).toEqual([decision.text, problem.text, ownPart.text]);
    expect(documentStats(ws, 'answer').unanswered).toEqual([]);
  });

  it('is kept after one redraft that still leaves it out, and shows it as not answered', async () => {
    const ws = await blank();
    const agent = liveAgent([[decision, problem]]);
    await draftOne(ws, 'answer', argsFor(ws), agent, () => {});
    expect(agent.draft).toHaveBeenCalledTimes(2);
    expect(texts(ws)).toEqual([decision.text, problem.text]);
    expect(documentStats(ws, 'answer').unanswered.map((r) => r.id)).toEqual(['contribution']);
  });

  it('asks for one redraft in all when the answer is also over the word limit', async () => {
    const ws = await blank();
    const limit = ws.application.form.documents[0].wordLimit;
    const long = claim(`We chose Kubernetes Jobs over Slurm ${Array.from({ length: limit }, (_, i) => `w${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26) % 26)}`).join(' ')}.`, ['f1'], true);
    const agent = liveAgent([[long], [decision, problem, ownPart]]);
    await draftOne(ws, 'answer', argsFor(ws), agent, () => {});
    expect(agent.draft).toHaveBeenCalledTimes(2);
    expect(agent.draft.mock.calls[1][0].problems).toEqual([
      `Over the word limit: ${long.text.split(/\s+/).length} words of ${limit}. Cut it to under ${limit} words and keep every requirement answered.`,
      missingLine(ws, 'problem', 'fact f2'),
      missingLine(ws, 'contribution', 'fact f3'),
    ]);
    expect(texts(ws)).toEqual([decision.text, problem.text, ownPart.text]);
  });

  it('is not redrafted when every covered requirement is answered', async () => {
    const ws = await blank();
    const agent = liveAgent([[decision, problem, ownPart]]);
    await draftOne(ws, 'answer', argsFor(ws), agent, () => {});
    expect(agent.draft).toHaveBeenCalledTimes(1);
  });
});
