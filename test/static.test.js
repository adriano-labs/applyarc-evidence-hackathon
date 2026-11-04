// The built client: a hashed asset is kept for a year, the page is checked on
// every load, and a missing asset is a 404, never the page (a browser holding an
// old page would otherwise run HTML as its script and show a blank screen).
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../server/build.js';
import { serveClient } from '../server/http/static.js';

function appWithClient() {
  const dist = mkdtempSync(join(tmpdir(), 'dist-'));
  mkdirSync(join(dist, 'assets'));
  writeFileSync(join(dist, 'index.html'), '<!doctype html><script type="module" src="/assets/index-abc123.js"></script>');
  writeFileSync(join(dist, 'assets', 'index-abc123.js'), 'console.log("app");');
  return serveClient(buildApp({ dataDir: mkdtempSync(join(tmpdir(), 'static-')), env: {} }), dist);
}

describe('the built client', () => {
  it('lets a browser keep a hashed asset for a year', async () => {
    const res = await appWithClient().request('/assets/index-abc123.js');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/javascript/);
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
  });

  it('answers a missing asset with 404, not the page', async () => {
    const res = await appWithClient().request('/assets/index-OLDHASH.js');
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type') ?? '').not.toMatch(/html/);
    expect(res.headers.get('cache-control')).toBeNull();
  });

  it('has the browser check the page on every load, at the root and as the app’s fallback', async () => {
    const app = appWithClient();
    for (const path of ['/', '/index.html', '/any/screen']) {
      const res = await app.request(path);
      expect(res.status, path).toBe(200);
      expect(res.headers.get('content-type'), path).toMatch(/^text\/html/);
      expect(res.headers.get('cache-control'), path).toBe('no-cache');
      expect(res.headers.get('content-security-policy'), path).toContain("script-src 'self'");
      expect(await res.text(), path).toContain('/assets/index-abc123.js');
    }
  });

  it('leaves the API as it was', async () => {
    const res = await appWithClient().request('/api/state');
    expect(res.headers.get('content-type')).toMatch(/^application\/json/);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});
