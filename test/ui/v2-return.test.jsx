// @vitest-environment jsdom
// V2-7a: the walk-through is never lost. A reload of the tab keeps it, the full workspace
// has a way back into it, and a remembered walk-through never shows over an empty workspace.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../client/src/App.jsx';
import { buildApp } from '../../server/build.js';

beforeEach(() => {
  sessionStorage.clear();
  const server = buildApp({ dataDir: mkdtempSync(join(tmpdir(), 'return-')), env: {} });
  globalThis.fetch = (url, init) => server.request(String(url), init);
  Element.prototype.scrollIntoView = () => {};
});
afterEach(cleanup);

const wait = { timeout: 4000 };
const button = (name) => screen.findByRole('button', { name }, wait);

describe('the walk-through is never lost', () => {
  it('comes back after a reload of the tab', async () => {
    render(<App />);
    fireEvent.click(await button('Try it with Ellie’s notes'));
    await screen.findByText('Step 2 of 5', {}, wait);
    cleanup();
    render(<App />);
    expect(await screen.findByText('Step 2 of 5', {}, wait)).toBeTruthy();
  });

  it('can be reopened from the full workspace', async () => {
    render(<App />);
    fireEvent.click(await button('Try it with Ellie’s notes'));
    await screen.findByText('Step 2 of 5', {}, wait);
    fireEvent.click(await button('Open the full workspace'));
    await waitFor(() => expect(screen.getByRole('tablist')).toBeTruthy(), wait);
    fireEvent.click(await button('Back to the guided walk-through'));
    expect(await screen.findByText('Step 2 of 5', {}, wait)).toBeTruthy();
  });

  it('never shows over a workspace without the sample’s notes', async () => {
    sessionStorage.setItem('ae-guided', '1');
    render(<App />);
    expect(await button('Try it with Ellie’s notes')).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Steps' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Back to the guided walk-through' })).toBeNull();
  });
});
