// @vitest-environment jsdom
// V2-7b: a fresh workspace opens on the welcome alone: what the app does, the samples and
// a box for your own notes, without the workspace's steps, tabs and evidence rail around it.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../client/src/App.jsx';
import { buildApp } from '../../server/build.js';

beforeEach(() => {
  sessionStorage.clear();
  const server = buildApp({ dataDir: mkdtempSync(join(tmpdir(), 'welcome-')), env: {} });
  globalThis.fetch = (url, init) => server.request(String(url), init);
  Element.prototype.scrollIntoView = () => {};
});
afterEach(cleanup);

const wait = { timeout: 4000 };

describe('the welcome', () => {
  it('shows only what the app does, the samples and a box for your own notes', async () => {
    render(<App />);
    expect(await screen.findByRole('button', { name: 'Try it with Ellie’s notes' }, wait)).toBeTruthy();
    expect(screen.getByRole('list', { name: 'How it works' })).toBeTruthy();
    expect(screen.getByLabelText('Fictional CV or project notes')).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Steps' })).toBeNull();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByText('Your evidence')).toBeNull();
  });

  it('keeps What Meta did one click away, on the welcome and in the walk-through', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Try it with Ellie’s notes' }, wait));
    await screen.findByText('Step 2 of 5', {}, wait);
    expect(document.querySelector('.guided-receipts .receipts-toggle')).toBeTruthy();
  });

  it('keeps own input on the welcome while the live model is unavailable', async () => {
    render(<App />);
    fireEvent.click(await screen.findByText('Try your own fictional example'));
    fireEvent.change(await screen.findByLabelText('Fictional CV or project notes', {}, wait), { target: { value: 'I ran a fictional weekend rota.' } });
    expect(screen.getByRole('button', { name: 'Read my example' }).disabled).toBe(true);
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.getByText(/Your own example needs the live model/)).toBeTruthy();
  });
});
