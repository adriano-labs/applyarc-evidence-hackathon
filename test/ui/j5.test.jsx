// @vitest-environment jsdom
// Dead ends a first-time judge could hit: a workspace that will not open,
// and the top-bar receipts pill in Meta mode.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../client/src/App.jsx';
import { buildApp } from '../../server/build.js';

let server;
beforeEach(() => {
  server = buildApp({ dataDir: mkdtempSync(join(tmpdir(), 'ui-')), env: {} });
  Element.prototype.scrollIntoView = () => {};
});
afterEach(cleanup);
const wait = { timeout: 4000 };

describe('J5', () => {
  it('says why the workspace did not open and lets the judge try again', async () => {
    let failures = 1;
    globalThis.fetch = (url, init) => {
      if (String(url) === '/api/state' && failures-- > 0) return Promise.resolve(Response.json({ error: { code: 'not-found', message: 'Sign in to continue.' } }, { status: 404 }));
      return server.request(String(url), init);
    };
    render(<App />);
    expect((await screen.findByRole('alert', {}, wait)).textContent).toContain('Sign in to continue.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Fixture: hand-written outputs, not a model', {}, wait)).toBeTruthy();
    expect(screen.queryByText('Sign in to continue.')).toBeNull();
  });

  it('opens What Meta did from the top-bar pill', async () => {
    const receipt = { step: 'extract', provider: 'meta', isMeta: true, model: 'muse-spark-1.3', effort: 'low', turns: 2, attempts: 2, requestIds: ['r1', 'r2'], toolCalls: [{ name: 'verify_quote', ok: true, note: 'verbatim' }, { name: 'verify_quote', ok: true, note: 'verbatim' }], usage: { input: 900, cached: 300, output: 200, reasoning: 50 }, costUsd: 0.004, firstEventMs: 400, totalMs: 6200, rateLimit: null, at: '2026-10-27T09:00:00.000Z' };
    globalThis.fetch = async (url, init) => {
      if (String(url) === '/api/receipts') return Response.json({ receipts: [receipt] });
      const response = await server.request(String(url), init);
      if (String(url) !== '/api/state') return response;
      const body = await response.json();
      return Response.json({ ...body, mode: { id: 'meta', label: 'Meta Muse Spark 1.3', model: 'muse-spark-1.3', isMeta: true } });
    };
    render(<App />);
    const pill = await screen.findByRole('button', { name: 'What Meta did: 1 step, 2 tool calls, 6.2 s, $0.0040' }, wait);
    const toggle = () => document.querySelector('.receipts-toggle');
    await waitFor(() => expect(toggle()).toBeTruthy(), wait);
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(pill);
    await waitFor(() => expect(toggle().getAttribute('aria-expanded')).toBe('true'), wait);
    expect(document.getElementById('receipts-body')).toBeTruthy();
  });
});
