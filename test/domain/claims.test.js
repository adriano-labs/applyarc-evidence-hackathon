import { describe, expect, it } from 'vitest';
import { setDraft } from '../../server/domain/documents.js';
import { changeFact } from '../../server/domain/facts.js';
import { proposeRewrites, startRepair } from '../../server/domain/repair.js';
import { draftedWorkspace } from '../helpers.js';

// f1: "we used Kubernetes Jobs with a scheduler extender instead of Slurm" (the team)
// f2: "the default /dev/shm in the pods was 64 MB" (the team)
// f3: "I found the /dev/shm problem by reading dmesg, and I wrote the Helm change that fixed it." (Ellie)
async function problems(text, factIds) {
  const ws = await draftedWorkspace();
  ws.application.documents.answer = null;
  try {
    setDraft(ws, 'answer', [{ kind: 'claim', text, factIds }]);
    return [];
  } catch (error) {
    return error.details?.problems ?? [error.message];
  }
}

describe('a claim says no more than its facts', () => {
  it('refuses a number that none of its cited quotes contains', async () => {
    expect(await problems('We chose Kubernetes Jobs and cut GPU waits by 99%.', ['f1'])).toEqual([[0, 'a claim states a number its facts do not']]);
    expect(await problems('The default /dev/shm was only 64 MB.', ['f2'])).toEqual([]);
  });

  it('lets the exact role title carry its own number', async () => {
    expect(await problems('We chose Kubernetes Jobs, the kind of work the Graduate Cloud Platform Engineer 2027 role does.', ['f1'])).toEqual([]);
  });

  it('refuses "I" when every cited quote is the team speaking', async () => {
    expect(await problems('I chose Kubernetes Jobs over Slurm.', ['f1'])).toEqual([[0, 'a claim says "I" where its facts say "we"']]);
    expect(await problems("I'd chosen Kubernetes Jobs over Slurm.", ['f1'])).toEqual([[0, 'a claim says "I" where its facts say "we"']]);
  });

  it('accepts "I" when at least one cited quote is in the applicant’s own first person', async () => {
    expect(await problems('I wrote the Helm change that fixed the 64 MB /dev/shm limit.', ['f2', 'f3'])).toEqual([]);
  });

  it('does not treat "my", "our" or a lower-case "i" as an upgrade to "I"', async () => {
    expect(await problems('On my final-year project we chose Kubernetes Jobs over Slurm.', ['f1'])).toEqual([]);
    expect(await problems('We chose Kubernetes Jobs, i.e. containers under a quota.', ['f1'])).toEqual([]);
    expect(await problems('We chose Kubernetes Jobs for faster I/O.', ['f1'])).toEqual([]);
  });

  it('reports the number rule first when both fail', async () => {
    expect(await problems('I cut GPU waits by 99%.', ['f1'])).toEqual([[0, 'a claim states a number its facts do not']]);
  });
});

describe('a repair rewrite says no more than its facts', () => {
  it('does not propose a rewrite that adds a number or an "I" its facts do not support', async () => {
    const ws = await draftedWorkspace();
    changeFact(ws, 'f3', 'I found the /dev/shm problem by reading dmesg; my teammate Sam wrote the Helm change.');
    startRepair(ws, 'f3');
    proposeRewrites(ws, [
      { segmentId: 'answer-3', text: 'I traced it in 2 hours; Sam wrote the Helm fix.', factIds: ['f3'] },
      { segmentId: 'letter-2', text: 'I fixed the memory limit that was killing GPU jobs.', factIds: ['f2'] },
    ]);
    const items = Object.fromEntries(ws.application.repair.items.map((i) => [i.segmentId, i]));
    expect(items['answer-3']).toMatchObject({ status: 'needs-review', after: null });
    expect(items['letter-2']).toMatchObject({ status: 'needs-review', after: null });
  });
});
