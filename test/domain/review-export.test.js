import { describe, expect, it } from 'vitest';
import { editSegment } from '../../server/domain/documents.js';
import { buildExport, exportBlockers, NOT_SUBMITTED } from '../../server/domain/exportPack.js';
import { approvalState, approve } from '../../server/domain/review.js';
import { draftedWorkspace } from '../helpers.js';

describe('approval and export', () => {
  it('binds approval to the exact revision and refuses a stale one', async () => {
    const ws = await draftedWorkspace();
    approve(ws, 'answer', 1);
    expect(approvalState(ws, 'answer')).toBe('approved');
    editSegment(ws, 'answer', 'answer-1', 'We picked Kubernetes Jobs for containers and quotas.');
    expect(approvalState(ws, 'answer')).toBe('stale');
    expect(() => approve(ws, 'answer', 1)).toThrow(/Review version 2/);
  });

  it('refuses to approve a document over the word limit', async () => {
    const ws = await draftedWorkspace();
    ws.application.documents.answer.segments[0].text = 'word '.repeat(300);
    expect(() => approve(ws, 'answer', 1)).toThrow(/limit is 300/);
  });

  it('exports only approved revisions, labelled NOT SUBMITTED, with the portal tasks', async () => {
    const ws = await draftedWorkspace();
    expect(exportBlockers(ws)).toHaveLength(2);
    approve(ws, 'answer', 1);
    approve(ws, 'letter', 1);
    const pack = buildExport(ws, '2026-10-27T10:00:00.000Z');
    expect(pack.status).toBe(NOT_SUBMITTED);
    expect(pack.documents.map((d) => [d.id, d.revision])).toEqual([['answer', 1], ['letter', 1]]);
    expect(pack.documents[0].references.map((r) => r.n)).toEqual([1, 2, 3]);
    expect(pack.documents[1].references.map((r) => r.n)).toEqual([2, 3]);
    expect(pack.portalTasks).toContain('Resume/CV');
    expect(ws.application.exports).toEqual([{ id: 'e1', at: '2026-10-27T10:00:00.000Z', revisions: { answer: 1, letter: 1 } }]);
  });

  it('refuses to export once an approved document has changed', async () => {
    const ws = await draftedWorkspace();
    approve(ws, 'answer', 1);
    approve(ws, 'letter', 1);
    editSegment(ws, 'letter', 'letter-2', 'I diagnosed and fixed a memory failure on my final-year project.');
    expect(() => buildExport(ws)).toThrow(/Approve the current cover letter/);
  });
});
