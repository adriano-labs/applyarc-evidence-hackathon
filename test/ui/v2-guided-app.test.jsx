// @vitest-environment jsdom
// V2-3: Ellie's sample opens the guided walk-through. Steps 1 to 3 on the real
// server (fixture mode), then the way out to the full workspace.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../client/src/App.jsx';
import { buildApp } from '../../server/build.js';

let server;
beforeEach(() => {
  server = buildApp({ dataDir: mkdtempSync(join(tmpdir(), 'guided-')), env: {} });
  globalThis.fetch = (url, init) => server.request(String(url), init);
  Element.prototype.scrollIntoView = () => {};
});
afterEach(cleanup);

const wait = { timeout: 4000 };
const button = (name) => screen.findByRole('button', { name }, wait);
const h1 = () => screen.getByRole('heading', { level: 1 }).textContent;

async function confirmTheFacts() {
  fireEvent.click(await button('Yes, confirm'));
  const rest = await screen.findByRole('button', { name: /^Confirm the remaining \d+$/ }, wait).catch(() => null);
  if (rest) fireEvent.click(rest);
}

describe('the guided walk-through', () => {
  it('keeps a failed model step visible and lets the person dismiss it', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (url, init) => String(url).includes('/api/run/read')
      ? Promise.reject(new Error('Offline for the recovery check')) : originalFetch(url, init);
    render(<App />);
    fireEvent.click(await button('Try it with Ellie’s notes'));
    await screen.findByRole('alert', {}, wait);
    fireEvent.click(await button('Dismiss'));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(screen.getByText('Step 1 of 5')).toBeTruthy();
  });

  it('takes Ellie’s sample one step at a time, then hands over the workspace', async () => {
    render(<App />);
    fireEvent.click(await button('Try it with Ellie’s notes'));

    await screen.findByText('Step 2 of 5', {}, wait);
    expect(h1()).toMatch(/^Found \d+ facts in Ellie’s own words$/);
    expect(screen.queryByRole('tablist')).toBeNull();
    await confirmTheFacts();

    await screen.findByText('One thing her notes don’t say', {}, wait);
    expect(screen.getByText('Step 3 of 5')).toBeTruthy();
    fireEvent.click(await button('Use Ellie’s sample answer'));
    fireEvent.click(await button('Answer'));
    await confirmTheFacts();

    await screen.findByText('Ready to write her answer', {}, wait);
    expect(screen.getByText(/^\d+ confirmed facts are ready\.$/)).toBeTruthy();
    fireEvent.click(await button('Write her answer'));
    await screen.findByText('Step 4 of 5', {}, wait);
    expect(h1()).toBe('Her answer, with evidence beside it');

    fireEvent.click(await button('Open the full workspace'));
    await waitFor(() => expect(screen.getByRole('tablist')).toBeTruthy(), wait);
    expect(screen.queryByText('Step 4 of 5')).toBeNull();
  });
});
