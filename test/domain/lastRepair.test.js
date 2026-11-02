import { describe, expect, it } from 'vitest';
import { changeFact } from '../../server/domain/facts.js';
import { applyRepair, decideItem, proposeRewrites, startRepair } from '../../server/domain/repair.js';
import { draftedWorkspace } from '../helpers.js';

describe('the last repair is remembered', () => {
  it('records exactly which sentences it changed, so the marks survive a reload', async () => {
    const ws = await draftedWorkspace();
    changeFact(ws, 'f3', 'I found the /dev/shm problem by reading dmesg; my teammate Sam wrote the Helm change.');
    startRepair(ws, 'f3');
    proposeRewrites(ws, [{ segmentId: 'answer-3', text: 'I found the /dev/shm problem by reading dmesg; Sam wrote the Helm fix.', factIds: ['f3'] }]);
    decideItem(ws, 'c2', 'keep');
    applyRepair(ws);
    expect(ws.application.lastRepair.changedSegments).toEqual([{ docId: 'answer', segmentId: 'answer-3' }]);
  });
});
