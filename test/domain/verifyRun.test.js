// Verify this run: each check passes on a finished run and fails, naming the ids, on a workspace
// broken in exactly its way. No model is called and the saved workspace is never changed.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { editSegment } from '../../server/domain/documents.js';
import { buildExport } from '../../server/domain/exportPack.js';
import { changeFact } from '../../server/domain/facts.js';
import { preparedWorkspace } from '../../server/domain/prepared.js';
import { startRepair } from '../../server/domain/repair.js';
import { approve } from '../../server/domain/review.js';
import { verifyRun } from '../../server/domain/verifyRun.js';
import { fromRoot } from '../../server/paths.js';
import { draftedWorkspace } from '../helpers.js';

// A live run's saved records: the model drafted, the review held one sentence back for one rewrite.
const LIVE = [
  { step: 'draft', docId: 'answer', provider: 'meta', at: '2026-10-27T09:05:00.000Z' },
  { kind: 'stage', flow: 'draft', label: 'Revising 1 unsupported sentence', at: '2026-10-27T09:05:01.000Z' },
  { step: 'review', provider: 'meta', at: '2026-10-27T09:05:02.000Z' },
];

// Ellie's run to the finish: drafted, her own opening, both documents approved and exported.
async function finished() {
  const ws = await draftedWorkspace();
  editSegment(ws, 'answer', 'answer-1', 'We picked Kubernetes Jobs over Slurm so each job ran in a container.');
  approve(ws, 'answer', 2);
  approve(ws, 'letter', 1);
  buildExport(ws, '2026-10-27T10:00:00.000Z');
  return ws;
}
const segment = (ws, id) => ['answer', 'letter'].flatMap((d) => ws.application.documents[d].segments).find((s) => s.id === id);
const checkOf = (ws, id, records = LIVE) => verifyRun(ws, records).find((c) => c.id === id);

describe('verify this run', () => {
  it('passes every check on a finished run, each with its count, and changes nothing', async () => {
    const ws = await finished();
    const before = structuredClone(ws);
    const checks = verifyRun(ws, LIVE);
    expect(checks.map((c) => [c.id, c.pass, c.count, c.failures])).toEqual([
      ['quotes', true, 3, []], ['citations', true, 3, []], ['numbers', true, 3, []], ['approvals', true, 2, []],
      ['own', true, 1, []], ['export', true, 1, []], ['review', true, 3, []],
    ]);
    expect(checks.map((c) => c.text)).toEqual([
      '3 of 3 confirmed facts quote Ellie’s text word for word',
      '3 of 3 drafted statements cite at least one fact, all confirmed',
      '3 of 3 drafted statements state no number their cited facts do not',
      '2 of 2 approvals match the current version',
      '1 of 1 sentences marked as Ellie’s own are untouched by the model',
      'Export e1 is stamped NOT SUBMITTED and holds exactly the approved versions',
      'Model review on record: 3 cited sentences supported, 1 held back',
    ]);
    expect(ws).toEqual(before);
  });

  it('1 · fails a confirmed fact whose quote is not word for word in its source', async () => {
    const ws = await finished();
    ws.applicant.facts[1].quote = 'the default /dev/shm in the pods was 128 MB';
    expect(checkOf(ws, 'quotes')).toMatchObject({ pass: false, count: 3, failures: ['f2'], text: '2 of 3 confirmed facts quote Ellie’s text word for word' });
  });

  it('2 · fails a statement that cites no fact, and statements citing a fact that is not confirmed', async () => {
    const ws = await finished();
    segment(ws, 'answer-2').factIds = [];
    ws.applicant.facts[2].status = 'rejected';
    expect(checkOf(ws, 'citations')).toMatchObject({ pass: false, count: 3, failures: ['answer-2', 'answer-3', 'letter-2'], text: '0 of 3 drafted statements cite at least one fact, all confirmed' });
  });

  it('3 · fails a statement with a number its cited facts do not state', async () => {
    const ws = await finished();
    segment(ws, 'answer-2').text = 'Pods were killed because /dev/shm was only 32 MB.';
    expect(checkOf(ws, 'numbers')).toMatchObject({ pass: false, count: 3, failures: ['answer-2'], text: '2 of 3 drafted statements state no number their cited facts do not' });
  });

  it('4 · fails an approval of a version that is no longer current', async () => {
    const ws = await finished();
    ws.application.approvals.answer.revision = 1;
    expect(checkOf(ws, 'approvals')).toMatchObject({ pass: false, count: 2, failures: ['answer'], text: '1 of 2 approvals match the current version' });
  });

  it('5 · holds her sentence for her decision in an open repair, and fails if the model would rewrite it', async () => {
    const ws = await finished();
    changeFact(ws, 'f1', 'We used Kubernetes Jobs instead of Slurm because the department wanted containers.');
    startRepair(ws, 'f1');
    expect(ws.application.repair.items.map((i) => [i.segmentId, i.status])).toEqual([['answer-1', 'conflict']]);
    expect(checkOf(ws, 'own')).toMatchObject({ pass: true, count: 1 });
    const proposed = structuredClone(ws);
    proposed.application.repair.items[0].status = 'proposed';
    expect(checkOf(proposed, 'own')).toMatchObject({ pass: false, count: 1, failures: ['answer-1'] });
    segment(ws, 'answer-1').text = 'We used Kubernetes Jobs instead of Slurm.';
    expect(checkOf(ws, 'own')).toMatchObject({ pass: false, count: 1, failures: ['answer-1'] });
  });

  it('6 · fails an export that does not hold exactly the approved versions', async () => {
    const ws = await finished();
    ws.application.exports[0].revisions.answer = 1;
    expect(checkOf(ws, 'export')).toMatchObject({ pass: false, count: 1, failures: ['e1'], text: 'Export e1 does not hold exactly the approved versions' });
    const changed = await finished();
    editSegment(changed, 'letter', 'letter-2', 'I found the /dev/shm problem by reading dmesg.');
    expect(checkOf(changed, 'export')).toMatchObject({ pass: false, failures: ['e1'] });
    expect(checkOf(await draftedWorkspace(), 'export')).toMatchObject({ pass: true, count: 0, text: 'No export yet: open the application, then verify again' });
  });

  it('7 · reads the review from saved records, labels the fixture, and fails model wording with no review on record', async () => {
    const ws = await finished();
    expect(checkOf(ws, 'review')).toMatchObject({ pass: true, count: 3, text: 'Model review on record: 3 cited sentences supported, 1 held back' });
    expect(checkOf(ws, 'review', [{ step: 'draft-answer', provider: 'fixture' }])).toMatchObject({ pass: true, count: 0, text: 'No model review on record: no live model has written document wording' });
    expect(checkOf(ws, 'review', LIVE.filter((r) => r.step !== 'review'))).toMatchObject({
      pass: false, count: 0, failures: ['answer-2', 'answer-3', 'letter-2'], text: 'No model review on record for 3 model-written statements',
    });
  });

  it('passes Ellie’s prepared key-moment workspace, saved by a real Muse Wonder run', () => {
    const saved = JSON.parse(readFileSync(fromRoot('fixtures', 'ellie-prepared-wonder-20261103.json'), 'utf8'));
    const checks = verifyRun(preparedWorkspace(saved), []);
    expect(checks.map((c) => [c.id, c.pass, c.count])).toEqual([
      ['quotes', true, 12], ['citations', true, 17], ['numbers', true, 17], ['approvals', true, 2], ['own', true, 1], ['export', true, 0], ['review', true, 17],
    ]);
    expect(checks.at(-1).text).toBe('Model review on record: 17 cited sentences supported, 0 held back in this visit');
  });
});
