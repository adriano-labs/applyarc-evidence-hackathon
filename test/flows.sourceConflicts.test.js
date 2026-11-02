import { describe, expect, it, vi } from 'vitest';
import { actions, agentActions } from '../server/flows.js';
import { addSource } from '../server/domain/workspace.js';
import { draftBlockers } from '../server/domain/documents.js';
import { approve } from '../server/domain/review.js';
import { buildExport, exportBlockers } from '../server/domain/exportPack.js';
import { draftedWorkspace, workspaceWithNotes } from './helpers.js';

describe('reading a materially conflicting answer', () => {
  it.each([
    ['We tested an update on an isolated practice network.', 'I deployed the update to the production network.', 'Was this the isolated practice network or a live production network?'],
    ['We presented observations to a tutor and did not carry out building works.', 'I implemented the redesigned entrance ramp.', 'Did you build a model of the ramp or carry out work on the real building?'],
  ])('asks about the material scope before admitting facts: %s', async (notes, answer, question) => {
    const { ws, source } = workspaceWithNotes(notes);
    source.read = true;
    const added = addSource(ws, { kind: 'answer', text: answer });
    const extract = vi.fn(async () => ({ facts: [{ statement: answer, quote: answer, requirementIds: ['contribution'] }], conflicts: [{ quote: answer, priorSourceId: source.id, priorQuote: notes, question }] }));
    await agentActions.read(ws, { sourceId: added.id }, { extract }, () => {});
    expect(extract.mock.calls[0][0].evidence).toEqual(expect.arrayContaining([expect.objectContaining({ id: source.id, text: notes })]));
    expect(ws.applicant.facts).toEqual([]);
    expect(ws.application.questions[0]).toMatchObject({ text: question, status: 'open' });
    expect(draftBlockers(ws).join(' ')).toMatch(/conflicting details/);
  });

  it('keeps manual drafts intact, clears approval, and requires reapproval after discarding added material', async () => {
    const ws = await draftedWorkspace();
    ws.applicant.sources[0].read = true;
    actions.edit(ws, { docId: 'answer', segmentId: 'answer-1', text: 'My wording stays.' });
    for (const id of ['answer', 'letter']) approve(ws, id, ws.application.documents[id].revision);
    const before = structuredClone(ws.application);
    const added = addSource(ws, { kind: 'notes', text: 'I used Slurm instead of Kubernetes.' });
    const agent = { extract: async () => ({ facts: [], conflicts: [{ quote: added.text, priorSourceId: 's1', priorQuote: 'we used Kubernetes Jobs with a scheduler extender instead of Slurm', question: 'Which scheduler did you actually use for this project?' }] }) };
    await agentActions.read(ws, { sourceId: added.id }, agent, () => {});
    expect(ws.application.documents).toEqual(before.documents);
    expect(ws.application.approvals).toEqual({ answer: null, letter: null });
    expect(exportBlockers(ws)[0]).toMatch(/conflicting details/);
    expect(() => approve(ws, 'answer', ws.application.documents.answer.revision)).toThrow(/conflicting details/);
    expect(() => buildExport(ws)).toThrow(/conflicting details/);
    expect(() => actions.nextApplication(ws, { formId: 'next' })).toThrow(/conflicting details/);
    actions.skip(ws, { questionId: 'q1' });
    expect(ws.application.documents).toEqual(before.documents);
    expect(ws.application.approvals).toEqual({ answer: null, letter: null });
    expect(() => buildExport(ws)).toThrow(/Approve/);
    for (const id of ['answer', 'letter']) approve(ws, id, ws.application.documents[id].revision);
    expect(buildExport(ws).status).toBe('NOT SUBMITTED');
  });

  it('reads a clarified answer, but never automatically imports the held wording or changes earlier facts', async () => {
    const { ws, source } = workspaceWithNotes('We worked on a practice network.');
    source.read = true;
    const added = addSource(ws, { kind: 'notes', text: 'I updated production.' });
    await agentActions.read(ws, { sourceId: added.id }, { extract: async () => ({ facts: [], conflicts: [{ quote: added.text, priorSourceId: source.id, priorQuote: source.text, question: 'Was it a practice network or production?' }] }) }, () => {});
    const { source: resolved } = actions.answer(ws, { questionId: 'q1', text: 'I updated our practice network, not production.' });
    expect(exportBlockers(ws)[0]).toMatch(/conflicting details/);
    await agentActions.read(ws, { sourceId: resolved.id }, { extract: async () => ({ conflicts: [], facts: [{ quote: resolved.text, statement: resolved.text, requirementIds: [] }] }) }, () => {});
    expect(ws.applicant.facts).toHaveLength(1);
    expect(ws.applicant.facts[0]).toMatchObject({ sourceId: resolved.id, status: 'proposed' });
    expect(ws.application.questions).toHaveLength(1);
  });

  it('keeps explicitly skipped new notes out of later question checks', async () => {
    const { ws, source } = workspaceWithNotes('We worked on a practice network.');
    source.read = true;
    const added = addSource(ws, { kind: 'notes', text: 'I updated production.' });
    await agentActions.read(ws, { sourceId: added.id }, { extract: async () => ({ facts: [], conflicts: [{ quote: added.text, priorSourceId: source.id, priorQuote: source.text, question: 'Was it a practice network or production?' }] }) }, () => {});
    actions.skip(ws, { questionId: 'q1' });
    const clarify = vi.fn(async () => ({ coverage: [], questions: [] }));
    await agentActions.check(ws, {}, { clarify }, () => {});
    expect(clarify.mock.calls[0][0].notes).toEqual([source.text]);
  });

  it('admits compatible production detail without a keyword ban', async () => {
    const { ws, source } = workspaceWithNotes('I tested the release, then deployed it to production.');
    await agentActions.read(ws, { sourceId: source.id }, { extract: async () => ({ conflicts: [], facts: [{ statement: source.text, quote: source.text, requirementIds: [] }] }) }, () => {});
    expect(ws.applicant.facts[0].status).toBe('proposed');
    expect(ws.application.questions).toEqual([]);
  });
});
