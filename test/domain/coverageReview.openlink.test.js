// The open-link path (4 November, 353d729): after Ana's correction the repair runs, then the
// form check runs on the model. A model that links the corrected fact back to evenings and
// weekends must not turn the point green: the fact no longer mentions weekends.
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { actions, agentActions } from '../../server/flows.js';
import { coverage } from '../../server/domain/facts.js';
import { nextStep } from '../../server/domain/progress.js';
import { decideItem, proposeRewrites } from '../../server/domain/repair.js';
import { preparedWorkspace } from '../../server/domain/prepared.js';

const saved = JSON.parse(fs.readFileSync(new URL('../../fixtures/ana-prepared-wonder-20261103.json', import.meta.url)));
const rota = (ws) => coverage(ws).find((r) => r.id === 'rota');

describe('Ana’s corrected fact after the form check', () => {
  it('stays Needs review when the model links the corrected fact back to evenings and weekends', async () => {
    const ws = preparedWorkspace(saved);
    actions.changeFact(ws, { factId: 'f9', text: 'Fiz dois anos de noites, e no último ano passei para os dias.', meaning: 'I did two years of nights, and in the last year I moved to days.', actor: 'self' });
    expect(ws.application.repair.items).toHaveLength(2);
    proposeRewrites(ws, ws.application.repair.items.map((i) => ({ segmentId: i.segmentId, text: 'I worked nights for two years, then moved to days in my last year.', factIds: ['f9'] })));
    for (const item of ws.application.repair.items) decideItem(ws, item.id, 'take');
    actions.applyChanges(ws);
    expect(nextStep(ws)).toBe('check');
    const agent = { clarify: async () => ({ coverage: [{ requirementId: 'rota', factIds: ['f9'] }], questions: [] }) };
    const result = await agentActions.check(ws, {}, agent, () => {});
    expect(result.linked).toEqual([]);
    expect(rota(ws)).toMatchObject({ covered: false, needsReview: true });
    expect(coverage(ws).filter((r) => r.covered)).toHaveLength(coverage(ws).length - 1);
  });
});
