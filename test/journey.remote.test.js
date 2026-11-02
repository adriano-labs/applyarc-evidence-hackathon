// A journey against the hosted demo keeps one visitor: the first ae_visitor
// cookie is sent back on every later request, so all steps share a workspace.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { remoteRequest, runJourney } from '../scripts/journey.mjs';
import { buildApp } from '../server/build.js';

describe('a remote journey', () => {
  it('keeps the visitor cookie, so every step lands in the same workspace', async () => {
    const app = buildApp({ dataDir: mkdtempSync(join(tmpdir(), 'remote-')), env: { VISITOR_COOKIE: '1', VISITOR_IDS_PER_IP_PER_DAY: '2' } });
    const seen = [];
    const fetchImpl = (url, init) => {
      seen.push(new Headers(init.headers).get('cookie'));
      return app.request(new URL(url).pathname, init);
    };
    const { steps } = await runJourney(remoteRequest('https://demo.example.test', fetchImpl));
    expect(steps).toHaveLength(19);
    expect(seen[0]).toBeNull();
    expect(new Set(seen.slice(1))).toEqual(new Set([seen[1]]));
    expect(seen[1]).toMatch(/^ae_visitor=[0-9a-f-]{36}$/);
  });
});
