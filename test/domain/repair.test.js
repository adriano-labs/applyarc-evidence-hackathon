import { describe, expect, it } from 'vitest';
import { editSegment } from '../../server/domain/documents.js';
import { changeFact } from '../../server/domain/facts.js';
import { applyRepair, decideItem, proposeRewrites, startRepair } from '../../server/domain/repair.js';
import { draftedWorkspace } from '../helpers.js';

const CORRECTION = 'I found the /dev/shm problem by reading dmesg; my teammate Sam wrote the Helm change.';

async function changed({ editLetter = false } = {}) {
  const ws = await draftedWorkspace();
  if (editLetter) {
    // Paragraph breaks are part of the draft; edits keep them.
    editSegment(ws, 'letter', 'letter-2', 'In my final year I diagnosed a memory failure that killed GPU jobs, and fixed it.');
  }
  changeFact(ws, 'f3', CORRECTION);
  return { ws, repair: startRepair(ws, 'f3') };
}

describe('repair', () => {
  it('reopens only the sentences that cite the changed fact, in both documents', async () => {
    const { repair } = await changed();
    expect(repair.items.map((i) => i.segmentId)).toEqual(['answer-3', 'letter-2']);
    expect(repair.items.every((i) => i.status === 'pending')).toBe(true);
  });

  it('makes a sentence the applicant edited a conflict', async () => {
    const { repair } = await changed({ editLetter: true });
    expect(repair.items.find((i) => i.segmentId === 'letter-2').status).toBe('conflict');
  });

  it('refuses rewrites of sentences that do not cite the fact', async () => {
    const { ws } = await changed();
    const { refused } = proposeRewrites(ws, [
      { segmentId: 'answer-1', text: 'Something else.', factIds: ['f1'] },
      { segmentId: 'answer-3', text: 'I found the /dev/shm problem by reading dmesg; Sam wrote the Helm fix.', factIds: ['f3'] },
    ]);
    expect(refused).toEqual([{ segmentId: 'answer-1', reason: 'That sentence does not cite the changed fact.' }]);
    expect(ws.application.documents.answer.segments[0].text).toMatch(/^We chose Kubernetes/);
  });

  it('asks for review when the model gives no usable rewrite', async () => {
    const { ws } = await changed();
    // The rewrite keeps her own part (she found the problem); the letter gets none.
    const { repair } = proposeRewrites(ws, [{ segmentId: 'answer-3', text: 'I found the /dev/shm problem by reading dmesg; Sam wrote the Helm fix.', factIds: ['f3'] }]);
    expect(repair.items.map((i) => i.status)).toEqual(['proposed', 'needs-review']);
    expect(() => applyRepair(ws)).toThrow(/needs you/);
  });

  it('applies takes, keeps the applicant’s choice on a conflict, and leaves other sentences alone', async () => {
    const { ws } = await changed({ editLetter: true });
    const untouched = ws.application.documents.answer.segments[0].text;
    proposeRewrites(ws, [
      { segmentId: 'answer-3', text: 'I found the /dev/shm problem by reading dmesg; Sam wrote the Helm fix.', factIds: ['f3'] },
      { segmentId: 'letter-2', text: 'In my final year I diagnosed a memory failure that killed GPU jobs.', factIds: ['f3'] },
    ]);
    expect(() => applyRepair(ws)).toThrow(/needs you/);
    decideItem(ws, 'c2', 'keep');
    const summary = applyRepair(ws);
    const { answer, letter } = ws.application.documents;
    expect(summary).toMatchObject({ changed: 1, kept: 1, docs: ['answer'] });
    expect(answer.segments[2]).toMatchObject({ text: 'I found the /dev/shm problem by reading dmesg; Sam wrote the Helm fix.', author: 'repair' });
    expect(answer.segments[0].text).toBe(untouched);
    expect(letter.segments[1].author).toBe('user');
    expect(answer.revision).toBe(2);
    // The edit had already moved the letter to version 2. Keeping it drops the corrected citation, so the version moves once more.
    expect(letter.revision).toBe(3);
    expect(ws.application.repair).toBeNull();
  });

  it('lets the applicant write their own wording for a change', async () => {
    const { ws } = await changed();
    proposeRewrites(ws, []);
    decideItem(ws, 'c1', 'write', 'I diagnosed it with dmesg; Sam fixed it.');
    decideItem(ws, 'c2', 'keep');
    applyRepair(ws);
    expect(ws.application.documents.answer.segments[2]).toMatchObject({ text: 'I diagnosed it with dmesg; Sam fixed it.', author: 'user' });
  });

  // Live, 3 Nov: a still-true sentence came back unchanged, showed no reason and lost its only
  // citation when kept; a sentence with no rewrite gave no hint that it might now be untrue.
  it('proposes an unchanged rewrite of a still-true sentence, keeping its words, author and citations', async () => {
    const ws = await draftedWorkspace();
    const sentence = structuredClone(ws.application.documents.answer.segments[2]);
    changeFact(ws, 'f3', 'I found the /dev/shm problem by reading dmesg, and I wrote the Helm change that fixed it, with Sam reviewing it.');
    startRepair(ws, 'f3');
    const { repair } = proposeRewrites(ws, [{ segmentId: 'answer-3', text: sentence.text, factIds: ['f3'] }]);
    expect(repair.items[0]).toMatchObject({ status: 'proposed', after: sentence.text, afterFactIds: ['f3'], reason: expect.stringMatching(/^Still true after the correction/) });
    expect(repair.items[1]).toMatchObject({ status: 'needs-review', after: null, reason: expect.stringMatching(/^No rewrite came back that the corrected fact supports, so this sentence may now be untrue/) });
    decideItem(ws, 'c2', 'keep');
    expect(applyRepair(ws)).toMatchObject({ changed: 0, kept: 1, changedSegments: [] });
    expect(ws.application.documents.answer.segments[2]).toEqual(sentence);
    // The answer was still true, so its version stays. Keeping the letter drops the corrected citation, so that version moves once.
    expect(ws.application.documents.answer.revision).toBe(1);
    expect(ws.application.documents.letter.revision).toBe(2);
  });

  it('blocks edits while changes are under review', async () => {
    const { ws } = await changed();
    expect(() => editSegment(ws, 'answer', 'answer-1', 'x')).toThrow(/reviewing/);
  });
});
