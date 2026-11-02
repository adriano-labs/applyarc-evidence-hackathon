import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runJourney } from '../scripts/journey.mjs';
import { createApp } from '../server/app.js';
import { createFixtureAgent } from '../server/agent/fixture.js';

function incompleteRepair(missingDocs) {
  const data = JSON.parse(readFileSync(new URL('../fixtures/ellie-fixture.json', import.meta.url)));
  const form = JSON.parse(readFileSync(new URL('../fixtures/graphcore-form-2026-10-26.json', import.meta.url)));
  const notes = readFileSync(new URL('../fixtures/ellie-notes.md', import.meta.url), 'utf8');
  for (const doc of missingDocs) delete data.repairs.helm[doc];
  const app = createApp({
    dataDir: mkdtempSync(join(tmpdir(), 'journey-repair-')), form,
    agent: createFixtureAgent({ data, sampleNotes: notes }),
    sample: { notes, answer: data.answer, correction: data.correction },
  });
  const calls = [];
  const request = (method, path, body) => {
    calls.push({ path, body });
    return app.request(path, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
  };
  return { request, calls };
}

describe('technical journey repair completion', () => {
  it.each([
    { missingDocs: ['answer', 'letter'] },
    { missingDocs: ['answer'] },
    { missingDocs: ['letter'] },
  ])('stops before decisions or export when $missingDocs has no accepted repair', async ({ missingDocs }) => {
    const { request, calls } = incompleteRepair(missingDocs);
    const error = await runJourney(request, () => {}, { strict: false }).catch((failure) => failure);
    expect(error.code).toBe('repair-incomplete');
    expect(error.incompleteItems.map((item) => item.docId)).toEqual(missingDocs);
    expect(calls.filter(({ path }) => /^\/api\/actions\/(decideChange|applyChanges|approve|export)$/.test(path))).toEqual([]);
    const state = await (await request('GET', '/api/state')).json();
    expect(state.workspace.application.repair.items.filter((item) => !item.after).map((item) => item.docId)).toEqual(missingDocs);
    expect(state.workspace.application.exports).toEqual([]);
  });
});
