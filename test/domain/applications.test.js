import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { startNextApplication } from '../../server/domain/applications.js';
import { buildExport } from '../../server/domain/exportPack.js';
import { approve } from '../../server/domain/review.js';
import { fromRoot } from '../../server/paths.js';
import { draftedWorkspace } from '../helpers.js';

const drivers = JSON.parse(readFileSync(fromRoot('fixtures', 'graphcore-drivers-form-2026-10-26.json'), 'utf8'));

describe('the next application', () => {
  it('waits until the current application has been exported', async () => {
    const ws = await draftedWorkspace();
    expect(() => startNextApplication(ws, drivers)).toThrow(/Export this application first/);
  });

  it('archives the finished application and starts the new form with the same confirmed facts', async () => {
    const ws = await draftedWorkspace();
    approve(ws, 'answer', 1);
    approve(ws, 'letter', 1);
    buildExport(ws);
    const facts = structuredClone(ws.applicant.facts);
    const { application } = startNextApplication(ws, drivers, '2026-10-27T11:00:00.000Z');
    expect(application.form.id).toBe(drivers.id);
    expect(application).toMatchObject({ coverage: {}, questions: [], documents: { answer: null, letter: null }, repair: null, approvals: { answer: null, letter: null }, exports: [] });
    expect(ws.applicant.facts).toEqual(facts);
    expect(ws.archive).toHaveLength(1);
    expect(ws.archive[0]).toMatchObject({ form: { id: 'graphcore-graduate-cloud-platform-engineer-2027' }, archivedAt: '2026-10-27T11:00:00.000Z' });
    expect(ws.archive[0].exports).toHaveLength(1);
  });

  it('refuses to restart the same form', async () => {
    const ws = await draftedWorkspace();
    approve(ws, 'answer', 1);
    approve(ws, 'letter', 1);
    buildExport(ws);
    expect(() => startNextApplication(ws, ws.application.form)).toThrow(/already/);
  });
});
