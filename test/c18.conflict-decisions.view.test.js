import { describe, expect, it } from 'vitest';
import { decideFact, proposeFacts } from '../server/domain/facts.js';
import { addSource } from '../server/domain/workspace.js';
import { actions } from '../server/flows.js';
import { viewOf } from '../server/view.js';
import { workspaceWithNotes } from './helpers.js';

const notes = 'I restored the booking server myself when it went down on a Saturday night.';
const prior = 'I restored the booking server myself';

function answeredConflict() {
  const { ws, source } = workspaceWithNotes(notes);
  proposeFacts(ws, source.id, [{ statement: 'Restored the booking server.', quote: prior, requirementIds: ['contribution'] }]);
  decideFact(ws, 'f1', 'confirm');
  const answer = addSource(ws, { kind: 'answer', text: 'I followed the helpdesk instructions while they restored it.', now: '2026-10-30T10:00:00.000Z' });
  answer.read = true;
  ws.application.questions.push({
    id: 'q1', kind: 'source-conflict', status: 'answered', text: 'Did you restore the server yourself, or follow the helpdesk?',
    conflictSourceId: 's9', priorSourceId: source.id, quote: 'I followed the helpdesk instructions', priorQuote: prior, sourceId: answer.id,
  });
  return ws;
}

describe('view.conflictDecisions', () => {
  it('lists the waiting fact and is empty once it is settled', () => {
    const ws = answeredConflict();
    const view = viewOf(ws);
    expect(view.conflictDecisions).toEqual([{ questionId: 'q1', factId: 'f1', quote: prior, cited: false }]);
    actions.settleConflict(ws, { questionId: 'q1', decision: 'keep' });
    const view2 = viewOf(ws);
    expect(view2.conflictDecisions).toEqual([]);
  });
});
