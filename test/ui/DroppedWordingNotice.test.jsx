// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { StatusLine } from '../../client/src/components/TopBar.jsx';
import { useActions } from '../../client/src/useActions.js';
import { leftOutNotice } from '../../client/src/flow.js';

afterEach(cleanup);
const details = [
  { docId: 'answer', text: 'I wrote the stock check.', reason: 'The cited notes do not establish who wrote that check.' },
  { docId: 'letter', text: '<img src=x onerror=alert(1)>', reason: 'This wording cannot be established from the cited quote.' },
];

it('carries the exact response-only dropped text and reasons into the notice without another action', async () => {
  const result = { result: { dropped: details, drafted: ['answer', 'letter'] } };
  const run = vi.fn(async () => result); const act = vi.fn(); const setNotice = vi.fn();
  const handlers = useActions({ run, act, setNotice }, {});
  expect(await handlers.primary({ id: 'draft' })).toBe(result);
  expect(setNotice).toHaveBeenCalledWith({ kind: 'info', message: leftOutNotice(details), details });
  expect(run).toHaveBeenCalledOnce();
  expect(act).not.toHaveBeenCalled();
});

it('lets the applicant inspect the exact omitted wording and fallible model reason, as text only', () => {
  const dismiss = vi.fn();
  const { container } = render(<StatusLine notice={{ kind: 'info', message: leftOutNotice(details), details }} onDismiss={dismiss} />);
  const summary = screen.getByText('Why was wording left out?');
  const disclosure = summary.closest('details');
  expect(disclosure).toBeTruthy();
  expect(disclosure.open).toBe(false);
  fireEvent.click(summary);
  expect(screen.getByText('Project answer', { exact: true })).toBeTruthy();
  expect(screen.getByText('Cover letter', { exact: true })).toBeTruthy();
  for (const item of details) {
    expect(screen.getByText(item.text, { exact: true })).toBeTruthy();
    expect(screen.getByText(item.reason, { exact: true })).toBeTruthy();
  }
  expect(screen.getByText(/review.*(?:wrong|fallible)|(?:wrong|fallible).*review/i)).toBeTruthy();
  expect(container.querySelector('img')).toBeNull();
  expect(container.querySelector('textarea')).toBeNull();
  expect(screen.queryByRole('button', { name: /insert|apply|restore/i })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
  expect(dismiss).toHaveBeenCalledOnce();
});

it('keeps ordinary notices, persistent errors and retry behavior unchanged', () => {
  const retry = vi.fn(); const dismiss = vi.fn();
  const { rerender } = render(<StatusLine notice={{ kind: 'info', message: 'Saved.' }} onDismiss={dismiss} />);
  expect(screen.getByRole('status').textContent).toContain('Saved.');
  expect(screen.queryByText('Why was wording left out?')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
  expect(dismiss).toHaveBeenCalledOnce();
  rerender(<StatusLine notice={{ kind: 'error', message: 'Connection lost.', persistent: true, retry }} onDismiss={dismiss} />);
  expect(screen.getByRole('alert').textContent).toContain('Connection lost.');
  expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(retry).toHaveBeenCalledOnce();
  expect(screen.queryByText('Why was wording left out?')).toBeNull();
});

it('does not show an empty explanation when nothing was dropped', async () => {
  const setNotice = vi.fn();
  await useActions({ run: vi.fn(async () => ({ result: { dropped: [] } })), setNotice }, {}).primary({ id: 'draft' });
  expect(setNotice).not.toHaveBeenCalled();
  render(<StatusLine notice={{ kind: 'info', message: 'Saved.', details: [] }} onDismiss={vi.fn()} />);
  expect(screen.queryByText('Why was wording left out?')).toBeNull();
});

it('does not render malformed explanation data as markup or crash an ordinary notice', () => {
  render(<StatusLine notice={{ kind: 'info', message: 'Saved.', details: [null, { docId: 'answer', text: {}, reason: 'No text' }, { docId: 'unknown', text: 'Wrong document', reason: 'No label' }] }} onDismiss={vi.fn()} />);
  expect(screen.getByRole('status').textContent).toContain('Saved.');
  expect(screen.queryByText('Why was wording left out?')).toBeNull();
});
