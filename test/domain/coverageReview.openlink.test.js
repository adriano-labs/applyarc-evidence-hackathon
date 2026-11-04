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

  // Spark Open, 4 Nov (final-check-6f8c212/open/rota-dump.json): after Ana's note, the model linked
  // f1 ("3 years in a care home in Leeds") to evenings and weekends, and the point turned green.
  const corrected = () => {
    const ws = preparedWorkspace(saved);
    actions.changeFact(ws, { factId: 'f9', text: 'Correção: os turnos da noite foram dois anos, não três; no último ano passei a fazer dias.', meaning: 'Night shifts were two years, not three; in the last year I switched to days.', actor: 'self' });
    proposeRewrites(ws, ws.application.repair.items.map((i) => ({ segmentId: i.segmentId, text: 'I worked nights for two years, then moved to days in my last year.', factIds: ['f9'] })));
    for (const item of ws.application.repair.items) decideItem(ws, item.id, 'take');
    actions.applyChanges(ws);
    return ws;
  };

  it('refuses the model re-linking another fact (f1) to the reopened point', async () => {
    const ws = corrected();
    const agent = { clarify: async () => ({ coverage: [{ requirementId: 'rota', factIds: ['f1'] }], questions: [] }) };
    const result = await agentActions.check(ws, {}, agent, () => {});
    expect(result.linked).toEqual([]);
    expect(ws.application.coverage.rota).not.toContain('f1');
    expect(rota(ws)).toMatchObject({ covered: false, needsReview: true });
  });

  it('still lets the same model link f1 to a point that was not reopened', async () => {
    const ws = corrected();
    const other = coverage(ws).find((r) => r.id !== 'rota' && r.docId === 'answer' && !(ws.application.coverage[r.id] ?? []).includes('f1') && !r.direct);
    const agent = { clarify: async () => ({ coverage: [{ requirementId: other.id, factIds: ['f1'] }], questions: [] }) };
    const result = await agentActions.check(ws, {}, agent, () => {});
    expect(result.linked).toEqual([{ requirementId: other.id, factId: 'f1' }]);
  });
});
