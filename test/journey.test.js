import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runJourney } from '../scripts/journey.mjs';
import { buildApp } from '../server/build.js';

describe('Ellie’s journey on fixture mode', () => {
  it('goes from notes to a NOT SUBMITTED pack through the API', async () => {
    const app = buildApp({ dataDir: mkdtempSync(join(tmpdir(), 'journey-')), env: {} });
    let manualEdit;
    const request = async (method, path, body) => {
      if (path === '/api/actions/edit') {
        const state = await (await app.request('/api/state')).json();
        const original = state.workspace.application.documents[body.docId].segments.find((s) => s.id === body.segmentId).text;
        manualEdit = { original, text: body.text };
      }
      return app.request(path, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
    };
    const { steps, pack, workspace, receipts } = await runJourney(request);
    expect(manualEdit.text).toBe(`For context: ${manualEdit.original}`);
    expect(steps.length).toBeGreaterThanOrEqual(17);
    expect(pack.documents.map((d) => d.revision)).toEqual([2, 3]);
    expect(pack.documents[1].text).toMatch(/tested the fix my teammate Sam wrote/);
    expect(workspace.application.exports).toHaveLength(1);
    // The trace a live run commits carries what the model did, not just the steps,
    // and the loop's own decisions sit between the receipts in time order.
    expect(receipts.map((r) => (r.kind === 'stage' ? `stage: ${r.label}` : r.step))).toEqual(['extract', 'clarify', 'extract', 'stage: Every requirement is covered: no question needed', 'draft-answer', 'draft-letter', 'repair']);
  });
});
