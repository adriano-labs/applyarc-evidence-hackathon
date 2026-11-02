import { readFileSync } from 'node:fs';
import { addSource, createWorkspace } from '../server/domain/workspace.js';
import { fromRoot } from '../server/paths.js';

export const form = JSON.parse(readFileSync(fromRoot('fixtures', 'graphcore-form-2026-10-26.json'), 'utf8'));
export const notes = readFileSync(fromRoot('fixtures', 'ellie-notes.md'), 'utf8');

export function workspaceWithNotes(text = notes) {
  const ws = createWorkspace({ form: structuredClone(form), now: '2026-10-27T09:00:00.000Z' });
  const source = addSource(ws, { kind: 'notes', text, now: '2026-10-27T09:00:00.000Z' });
  return { ws, source };
}

// A workspace with three confirmed facts and both documents drafted:
// f1 the decision, f2 the problem, f3 the applicant's own contribution.
export async function draftedWorkspace() {
  const { proposeFacts, decideFact } = await import('../server/domain/facts.js');
  const { setDraft } = await import('../server/domain/documents.js');
  const { ws, source } = workspaceWithNotes(
    notes + '\n\nMy part: I found the /dev/shm problem by reading dmesg, and I wrote the Helm change that fixed it.',
  );
  source.read = true;
  proposeFacts(ws, source.id, [
    { statement: 'Chose Kubernetes Jobs over Slurm for containers and quotas.', quote: 'we used Kubernetes Jobs with a scheduler extender instead of Slurm', requirementIds: ['decision'] },
    { statement: 'Pods were OOMKilled because /dev/shm was 64 MB.', quote: 'the default /dev/shm in the pods was 64 MB', requirementIds: ['problem'] },
    { statement: 'Ellie found the problem and wrote the fix.', quote: 'I found the /dev/shm problem by reading dmesg, and I wrote the Helm change that fixed it.', requirementIds: ['contribution', 'evidence'] },
  ]);
  for (const id of ['f1', 'f2', 'f3']) decideFact(ws, id, 'confirm');
  setDraft(ws, 'answer', [
    { kind: 'claim', text: 'We chose Kubernetes Jobs over Slurm so every job ran in a container under a course quota.', factIds: ['f1'] },
    { kind: 'claim', text: 'Pods were killed because /dev/shm was only 64 MB.', factIds: ['f2'] },
    { kind: 'claim', text: 'I traced the failures through dmesg and wrote the Helm change that fixed them.', factIds: ['f3'] },
  ]);
  setDraft(ws, 'letter', [
    { kind: 'frame', text: 'Dear Graphcore team,' },
    { kind: 'claim', text: 'On my final-year project I found the /dev/shm problem by reading dmesg and wrote the Helm change that fixed it.', factIds: ['f3', 'f2'], startsParagraph: true },
    { kind: 'frame', text: 'Yours sincerely, Ellie', startsParagraph: true },
  ]);
  return ws;
}
