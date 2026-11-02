// A requirement this document answers is unanswered when confirmed facts cover it
// but no claim in the document cites one of them. Held-out set 2 (29 Oct): an
// answer left out the applicant's own part although a confirmed fact said it.
import { describe, expect, it } from 'vitest';
import { unansweredRequirements } from '../../server/domain/completeness.js';
import { documentStats } from '../../server/domain/documents.js';
import { draftedWorkspace } from '../helpers.js';

const withoutFact = (ws, factId) => {
  ws.application.documents.answer.segments = ws.application.documents.answer.segments.filter((s) => !s.factIds.includes(factId));
  return ws;
};

describe('unanswered requirements', () => {
  it('lists a covered requirement that no sentence of the document cites', async () => {
    const ws = withoutFact(await draftedWorkspace(), 'f3');
    expect(unansweredRequirements(ws, 'answer').map((r) => r.id)).toEqual(['contribution']);
  });

  it('lists nothing when every covered requirement is cited, and never a requirement no fact covers', async () => {
    const ws = await draftedWorkspace();
    expect(unansweredRequirements(ws, 'answer')).toEqual([]);
    expect(unansweredRequirements(ws, 'letter')).toEqual([]);
  });

  it('checks a candidate draft before it is saved', async () => {
    const ws = await draftedWorkspace();
    const candidate = [{ kind: 'claim', text: 'We chose Kubernetes Jobs over Slurm.', factIds: ['f1'] }, { kind: 'frame', text: 'Dear team,', factIds: [] }];
    expect(unansweredRequirements(ws, 'answer', candidate).map((r) => r.id)).toEqual(['problem', 'contribution']);
  });

  it('is part of the document stats, so a document is never shown as complete without it', async () => {
    const ws = withoutFact(await draftedWorkspace(), 'f3');
    const contribution = unansweredRequirements(ws, 'answer')[0];
    expect(documentStats(ws, 'answer').unanswered).toEqual([{ id: 'contribution', text: contribution.text }]);
    expect(documentStats(ws, 'letter').unanswered).toEqual([]);
  });
});
