import { describe, expect, it } from 'vitest';
import { coverage, decideFact, linkFacts, proposeFacts } from '../../server/domain/facts.js';
import { prepareOwnApplication } from '../../server/domain/ownForm.js';
import { addSource, createWorkspace } from '../../server/domain/workspace.js';
import { workspaceWithNotes } from '../helpers.js';

function confirmed() {
  const { ws, source } = workspaceWithNotes();
  proposeFacts(ws, source.id, [
    { statement: 'Built a GPU job runner.', quote: 'We built a self-service GPU job runner', requirementIds: [] },
    { statement: 'Redis held the queue.', quote: 'Redis for the queue', requirementIds: ['tech'] },
    { statement: 'Took three days.', quote: 'Took us three days.', requirementIds: [] },
  ]);
  for (const id of ['f1', 'f2']) decideFact(ws, id, 'confirm');
  return ws;
}

describe('linkFacts', () => {
  it('links confirmed facts to requirements they cover', () => {
    const ws = confirmed();
    const result = linkFacts(ws, [{ requirementId: 'goal', factIds: ['f1'] }]);
    expect(result).toEqual({ linked: [{ requirementId: 'goal', factId: 'f1' }], refused: [] });
    expect(coverage(ws).find((r) => r.id === 'goal').covered).toBe(true);
  });

  it('refuses links to unknown requirements and to facts that are not confirmed', () => {
    const ws = confirmed();
    const { linked, refused } = linkFacts(ws, [{ requirementId: 'nonsense', factIds: ['f1'] }, { requirementId: 'problem', factIds: ['f3', 'f9'] }]);
    expect(linked).toEqual([]);
    expect(refused.map((r) => r.reason)).toEqual(['Unknown requirement.', 'Only a confirmed fact can cover a requirement.', 'Only a confirmed fact can cover a requirement.']);
  });

  it('never lets a team fact cover a personal requirement', () => {
    const ws = confirmed();
    linkFacts(ws, [{ requirementId: 'contribution', factIds: ['f1'] }]);
    expect(coverage(ws).find((r) => r.id === 'contribution').covered).toBe(false);
  });

  // 29 Oct held-out run: four letters lost their motivation. "Pellbridge Sports Clinic
  // interests me because…" names the employer first, so the "I did it" check refused it.
  it('lets the applicant\'s own reason cover the letter\'s motivation, whoever the sentence starts with', () => {
    const text = 'Pellbridge Sports Clinic interests me because it treats grassroots players as well as professionals.';
    const { form } = prepareOwnApplication({
      applicant: 'Imran', company: 'Pellbridge Sports Clinic', role: 'Graduate Sports Therapist', notes: text,
      question: 'What did you do on placement?', requirements: [{ text: 'What you did yourself', personal: true }],
      synthetic: true, requirementsConfirmed: true,
    }, { liveModel: true });
    const ws = createWorkspace({ form, now: '2026-10-29T14:00:00.000Z' });
    const source = addSource(ws, { kind: 'notes', text, now: '2026-10-29T14:00:00.000Z' });
    proposeFacts(ws, source.id, [{ statement: text, quote: text, requirementIds: ['own-motivation', 'own-answer-1'] }]);
    decideFact(ws, 'f1', 'confirm');
    const byId = Object.fromEntries(coverage(ws).map((r) => [r.id, r.covered]));
    expect(byId['own-motivation']).toBe(true);
    expect(byId['own-answer-1']).toBe(false);
  });

  it('does the same for the sample form\'s motivation', () => {
    const text = 'Graphcore appeals to me because it builds both the hardware and the cloud platform.';
    const { ws, source } = workspaceWithNotes(text);
    proposeFacts(ws, source.id, [{ statement: text, quote: text, requirementIds: ['motivation'] }]);
    decideFact(ws, 'f1', 'confirm');
    expect(coverage(ws).find((r) => r.id === 'motivation').covered).toBe(true);
  });

  it('ignores a link that already exists', () => {
    const ws = confirmed();
    expect(linkFacts(ws, [{ requirementId: 'tech', factIds: ['f2'] }]).linked).toEqual([]);
    expect(ws.application.coverage.tech).toEqual(['f2']);
  });
});
