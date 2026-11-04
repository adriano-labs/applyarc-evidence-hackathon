// Keeping your own sentence after a correction keeps your words exactly but drops
// its citation to the corrected fact, which no longer supports it; each document
// says how many sentences are your own words and which requirements no confirmed
// fact covers, and the export carries both (UX review of 24f96a5, 29 Oct: a kept
// sentence still cited [10] while [10] now said Sam did the work).
import { describe, expect, it } from 'vitest';
import { applyRepair, decideItem, proposeRewrites } from '../../server/domain/repair.js';
import { documentStats } from '../../server/domain/documents.js';
import { buildExport } from '../../server/domain/exportPack.js';
import { verifyRun } from '../../server/domain/verifyRun.js';
import { actions } from '../../server/flows.js';
import { draftedWorkspace } from '../helpers.js';

const edited = 'My carefully edited sentence: I wrote the Helm change.';
async function keptAfterCorrection() {
  const ws = await draftedWorkspace();
  actions.edit(ws, { docId: 'letter', segmentId: 'letter-2', text: edited });
  for (const docId of ['answer', 'letter']) actions.approve(ws, { docId, docRevision: ws.application.documents[docId].revision });
  actions.changeFact(ws, { factId: 'f3', text: 'My teammate Sam wrote the Helm change; I tested it on two lab nodes.' });
  proposeRewrites(ws, [{ segmentId: 'answer-3', text: 'Sam wrote the Helm change; I tested it on two lab nodes.', factIds: ['f3'] }]);
  decideItem(ws, ws.application.repair.items.find((i) => i.segmentId === 'letter-2').id, 'keep');
  applyRepair(ws);
  return ws;
}
const segmentOf = (ws, docId, id) => ws.application.documents[docId].segments.find((s) => s.id === id);

describe('keeping your own sentence after a correction', () => {
  it('keeps your words exactly and drops only the citation to the corrected fact', async () => {
    const ws = await keptAfterCorrection();
    expect(segmentOf(ws, 'letter', 'letter-2')).toMatchObject({ text: edited, author: 'user', factIds: ['f2'] });
  });

  it('counts the sentences in your own words on each document', async () => {
    const ws = await keptAfterCorrection();
    expect(documentStats(ws, 'letter').ownWords).toBe(1);
    expect(documentStats(ws, 'answer').ownWords).toBe(0);
  });

  it('lists the requirements no confirmed fact covers', async () => {
    const ws = await draftedWorkspace();
    expect(documentStats(ws, 'answer').leftOut.map((r) => r.id)).toEqual(['goal', 'tech']);
    expect(documentStats(ws, 'letter').leftOut.map((r) => r.id)).toEqual(['motivation']);
  });

  it('carries your own words and what is not answered into the export', async () => {
    const ws = await keptAfterCorrection();
    for (const docId of ['answer', 'letter']) actions.approve(ws, { docId, docRevision: ws.application.documents[docId].revision });
    const pack = buildExport(ws);
    const letter = pack.documents.find((d) => d.id === 'letter');
    expect(letter.ownWords).toBe(1);
    expect(letter.sentences.find((s) => s.text === edited).own).toBe(true);
    // The corrected fact f3 covered "experience": after the correction that link waits
    // for review, so the requirement is listed as left out (not as covered-but-uncited).
    expect(letter.notAnswered).toEqual([
      'Why this role and this company, in your own words',
      'The experience that shows you can do the job',
    ]);
    expect(pack.documents.find((d) => d.id === 'answer').notAnswered).toEqual([
      'What you were trying to achieve',
      'The main components or technologies you used',
      'Your individual contribution, if you worked as part of a team',
    ]);
  });

  it('bumps a document once when kept sentences drop the corrected citation, so the old export fails', async () => {
    const ws = await draftedWorkspace();
    const answer = ws.application.documents.answer;
    answer.segments.push({
      id: 'answer-4', kind: 'claim', author: 'draft', startsParagraph: false,
      text: 'We used Kubernetes Jobs with a scheduler extender instead of Slurm.', factIds: ['f1'],
    });
    answer.revision += 1;
    const letterBefore = structuredClone(ws.application.documents.letter);
    for (const docId of ['answer', 'letter']) actions.approve(ws, { docId, docRevision: ws.application.documents[docId].revision });
    buildExport(ws, '2026-10-27T10:00:00.000Z');
    const answerRevision = answer.revision;
    actions.changeFact(ws, { factId: 'f1', text: 'We used Kubernetes Jobs instead of Slurm so each job had its own container.' });
    proposeRewrites(ws, []);
    for (const item of ws.application.repair.items) decideItem(ws, item.id, 'keep');
    const summary = applyRepair(ws);
    expect(summary).toMatchObject({ kept: 2, changed: 0 });
    expect(answer.revision).toBe(answerRevision + 1);
    expect(answer.segments.filter((s) => s.factIds.includes('f1'))).toEqual([]);
    expect(answer.segments.filter((s) => s.id === 'answer-1' || s.id === 'answer-4').every((s) => s.author === 'user')).toBe(true);
    expect(ws.application.documents.letter).toEqual(letterBefore);
    actions.approve(ws, { docId: 'answer', docRevision: answer.revision });
    expect(verifyRun(ws).find((c) => c.id === 'export').pass).toBe(false);
    buildExport(ws, '2026-10-27T11:00:00.000Z');
    expect(verifyRun(ws).find((c) => c.id === 'export').pass).toBe(true);
  });
});
