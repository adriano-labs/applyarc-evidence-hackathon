// @vitest-environment jsdom
// The whole journey through the real UI against the real server, in-process,
// on fixture mode: what a judge would click, start to finish.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../client/src/App.jsx';
import { buildApp } from '../../server/build.js';

let server;
beforeEach(() => {
  server = buildApp({ dataDir: mkdtempSync(join(tmpdir(), 'ui-')), env: {} });
  globalThis.fetch = (url, init) => server.request(String(url), init);
  Element.prototype.scrollIntoView = () => {};
});
afterEach(cleanup);

const button = (name) => screen.findByRole('button', { name });
const wait = { timeout: 4000 };

// One fact at a time: confirm the current one, then wait for the next (or the end).
async function confirmAllFacts() {
  await screen.findByRole('heading', { name: 'Is this right?' }, wait);
  for (let guard = 0; guard < 30; guard += 1) {
    const yes = screen.queryByRole('button', { name: 'Yes, confirm' });
    if (!yes) return;
    const before = document.querySelector('.facts-review [role="status"]')?.textContent;
    fireEvent.click(yes);
    await waitFor(() => expect(document.querySelector('.facts-review [role="status"]')?.textContent).not.toBe(before), wait);
  }
}

describe('App', () => {
  it('runs Ellie’s whole application from notes to a NOT SUBMITTED pack', async () => {
    render(<App />);
    expect(await screen.findByText('Fixture: hand-written outputs, not a model', {}, wait)).toBeTruthy();

    // One click: Ellie's notes go in and are read. This journey uses the full workspace.
    fireEvent.click(await button('Try it with Ellie’s notes'));
    fireEvent.click(await button('Open the full workspace'));
    await confirmAllFacts();

    expect(await screen.findByRole('heading', { name: 'One question' }, wait)).toBeTruthy();
    fireEvent.click(await button('Use Ellie’s sample answer'));
    fireEvent.click(await button('Answer'));
    await confirmAllFacts();

    fireEvent.click(await screen.findByRole('button', { name: 'Write both documents' }, wait));
    // The form panel has a "Project answer" heading too, so look for the manuscript itself.
    const manuscript = await screen.findByRole('article', { name: 'Project answer' }, wait);
    expect(within(manuscript).getAllByRole('button', { name: /^Evidence \d+$/ }).length).toBeGreaterThan(5);

    fireEvent.click(screen.getByRole('tab', { name: /Cover letter/ }));
    await screen.findByRole('article', { name: 'Cover letter' }, wait);

    const helm = screen.getAllByText('I wrote the Helm change that mounts a memory-backed emptyDir for each job.')[0].closest('li');
    fireEvent.click(within(helm).getByRole('button', { name: 'Correct this fact' }));
    fireEvent.change(within(helm).getByLabelText('The fact, in your words'), { target: { value: 'My teammate Sam wrote the Helm change; I tested it on two of the lab nodes.' } });
    fireEvent.click(within(helm).getByRole('button', { name: 'Save the correction' }));

    expect(await screen.findByRole('heading', { name: 'What changed' }, wait)).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/^Correcting \[\d+\] reopened the 2 sentences that cite it: 1 in the project answer, 1 in the cover letter\./), wait);
    fireEvent.click(await button('Apply 2 changes'));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'What changed' })).toBeNull(), wait);
    expect(screen.getAllByText('corrected').length).toBeGreaterThan(0);

    // The project answer is on screen after drafting: the main button approves its exact version.
    fireEvent.click(await screen.findByRole('button', { name: /^Approve the project answer, version \d+$/ }, wait));
    fireEvent.click(await screen.findByRole('button', { name: /Review and approve the cover letter/ }, wait));
    fireEvent.click(await screen.findByRole('button', { name: /^Approve the cover letter, version \d+$/ }, wait));

    fireEvent.click(await screen.findByRole('button', { name: 'Preview the export' }, wait));
    const dialog = await screen.findByRole('dialog', { name: 'Your application pack' }, wait);
    expect(within(dialog).getByText('NOT SUBMITTED')).toBeTruthy();
    expect(within(dialog).getByText(/tested the fix my teammate Sam wrote/)).toBeTruthy();
    expect(within(dialog).getByText('Demo: fictional applicant.')).toBeTruthy();
  }, 20000);

  it('opens the command menu with Ctrl K', async () => {
    render(<App />);
    await screen.findByText('Fixture: hand-written outputs, not a model', {}, wait);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(await screen.findByRole('dialog', { name: 'Commands' })).toBeTruthy();
  });
});

describe('App, second application', () => {
  it('starts the next form after export and asks only what is new', async () => {
    const request = (method, path, body) => server.request(path, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
    const { runJourney } = await import('../../scripts/journey.mjs');
    await runJourney(request);
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Start your next application' }, wait));
    fireEvent.click(await screen.findByRole('button', { name: /Drivers and Utilities/ }, wait));
    expect(await screen.findByText('If you started the GPU job runner again, what would you do differently, and why?', {}, wait)).toBeTruthy();
    expect(screen.getAllByRole('heading', { name: 'One question' })).toHaveLength(1);
    expect(await screen.findByText(/1 earlier application/, {}, wait)).toBeTruthy();
  }, 20000);
});
