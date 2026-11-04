// @vitest-environment node
// Failure drill: five judges, five cookies, Ana's whole fixture journey at the same time, to the
// export. Each ends with a workspace of their own (saved under their own id), NOT SUBMITTED, with
// nobody else's words, receipts or export in it.
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { apiClient } from '../../scripts/journey.mjs';
import { buildApp } from '../../server/build.js';

function visitor(app) {
  let cookie = null;
  const request = async (method, path, body) => {
    const response = await app.request(path, { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body && JSON.stringify(body) });
    cookie ??= /ae_visitor=[^;,\s]+/.exec(response.headers.get('set-cookie') ?? '')?.[0] ?? null;
    return response;
  };
  return { api: apiClient(request), id: () => cookie?.split('=')[1] };
}

// Her voice note's written form, the facts, the one question, her answer, both drafts, both approvals, the pack.
async function anaJourney(api) {
  await api.get('/api/state');
  const ana = (await api.get('/api/sample')).samples.find((s) => s.id === 'ana');
  let s = await api.act('startSample', { sampleId: 'ana' });
  s = await api.run('read', { sourceId: s.result.id });
  s = await api.act('confirmFacts', { factIds: s.result.accepted });
  s = await api.run('check');
  const question = s.workspace.application.questions.find((q) => q.status === 'open');
  s = await api.act('answer', { questionId: question.id, text: ana.answer });
  s = await api.run('read', { sourceId: s.result.source.id });
  s = await api.act('confirmFacts', { factIds: s.result.accepted });
  s = await api.run('draft');
  for (const d of ['answer', 'letter']) s = await api.act('approve', { docId: d, docRevision: s.workspace.application.documents[d].revision });
  const pack = await api.act('export');
  return { pack: pack.result, workspace: pack.workspace, receipts: (await api.get('/api/receipts')).receipts };
}

describe('parallel visitors', () => {
  it('five visitors run Ana’s fixture journey at once, each to their own NOT SUBMITTED pack', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'parallel-visitors-'));
    const app = buildApp({ dataDir, env: { VISITOR_COOKIE: '1' } });
    const visitors = Array.from({ length: 5 }, () => visitor(app));
    const results = await Promise.all(visitors.map((v) => anaJourney(v.api)));
    const ids = visitors.map((v) => v.id());
    expect(new Set(ids).size).toBe(5);
    for (const [i, { pack, workspace, receipts }] of results.entries()) {
      expect(pack.status).toBe('NOT SUBMITTED');
      expect(pack.documents.every((d) => d.text.length > 0)).toBe(true);
      expect(workspace.applicant.sources.map((s) => s.kind)).toEqual(['notes', 'answer']);
      expect(workspace.application.exports).toHaveLength(1);
      expect(receipts.map((r) => r.flow)).toEqual(results[0].receipts.map((r) => r.flow));
      const file = join(dataDir, 'users', ids[i], 'workspace.json');
      expect(existsSync(file)).toBe(true);
      expect(JSON.parse(readFileSync(file, 'utf8')).revision).toBe(workspace.revision);
    }
  });
});
