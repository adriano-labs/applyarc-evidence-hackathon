// Evidence Pass shows an employer, sentence by sentence, the applicant's own words
// behind each claim, so the export must say which sentence cites which reference.
import { describe, expect, it } from 'vitest';
import { buildExport } from '../../server/domain/exportPack.js';
import { approve } from '../../server/domain/review.js';
import { draftedWorkspace } from '../helpers.js';

async function approvedPack() {
  const ws = await draftedWorkspace();
  for (const docId of ['answer', 'letter']) approve(ws, docId, ws.application.documents[docId].revision);
  return buildExport(ws);
}

describe('the export pack, sentence by sentence', () => {
  it('names the applicant', async () => {
    expect((await approvedPack()).applicant).toBe('Ellie');
  });

  it('lists each sentence with the numbers of the references it cites, in order', async () => {
    const pack = await approvedPack();
    const sentences = (id) => pack.documents.find((d) => d.id === id).sentences.map(({ text, refs }) => ({ text, refs }));
    expect(sentences('answer')).toEqual([
      { text: 'We chose Kubernetes Jobs over Slurm so every job ran in a container under a course quota.', refs: [1] },
      { text: 'Pods were killed because /dev/shm was only 64 MB.', refs: [2] },
      { text: 'I traced the failures through dmesg and wrote the Helm change that fixed them.', refs: [3] },
    ]);
    expect(sentences('letter')).toEqual([
      { text: 'Dear Graphcore team,', refs: [] },
      { text: 'On my final-year project I found the /dev/shm problem by reading dmesg and wrote the Helm change that fixed it.', refs: [3, 2] },
      { text: 'Yours sincerely, Ellie', refs: [] },
    ]);
    expect(pack.documents.every((d) => d.sentences.every((s) => typeof s.startsParagraph === 'boolean'))).toBe(true);
  });

  it('says where each quoted reference came from', async () => {
    const pack = await approvedPack();
    expect(pack.documents.flatMap((d) => d.references.map((r) => r.from))).toEqual(['notes', 'notes', 'notes', 'notes', 'notes']);
  });
});
