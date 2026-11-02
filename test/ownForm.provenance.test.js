import { expect, it } from 'vitest';
import { draftedWorkspace } from './helpers.js';
import { approve } from '../server/domain/review.js';
import { buildExport } from '../server/domain/exportPack.js';
import { packMarkdown } from '../client/src/flow.js';

it('exports pasted provenance without claiming to have checked the employer form', async () => {
  const ws = await draftedWorkspace();
  Object.assign(ws.application.form, { snapshot: { source: 'applicant-pasted', fetchedAt: null, recordedAt: '2026-10-28T12:00:00Z' }, portalStatus: 'unknown' });
  ws.application.form.documents[1].required = false;
  approve(ws, 'answer', ws.application.documents.answer.revision);
  approve(ws, 'letter', ws.application.documents.letter.revision);
  const pack = buildExport(ws);
  expect(pack.status).toBe('NOT SUBMITTED');
  expect(pack.application).toMatchObject({ source: 'applicant-pasted', snapshotFetchedAt: null, portalStatus: 'unknown' });
  expect(pack.notice).toMatch(/not been checked/);
  expect(pack.documents.find((d) => d.id === 'letter').required).toBe(false);
  const markdown = packMarkdown(pack);
  expect(markdown).toContain('Pasted and confirmed by the applicant');
  expect(markdown).not.toContain('(snapshot of');
});
