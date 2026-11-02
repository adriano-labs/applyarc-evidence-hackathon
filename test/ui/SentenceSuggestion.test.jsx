// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SentenceSuggestion } from '../../client/src/components/SentenceSuggestion.jsx';
import { DocumentView } from '../../client/src/components/DocumentView.jsx';
import { useActions } from '../../client/src/useActions.js';

afterEach(cleanup);
const segment = { id: 's1', kind: 'claim', text: 'I checked the lab records.', factIds: ['f1'], author: 'user' };
const suggestion = { id: 'p1', docId: 'answer', segmentId: 's1', before: segment.text, after: 'I reviewed the lab records.', beforeFactIds: ['f1'], afterFactIds: ['f1'], status: 'proposed', reason: 'Same task, more direct wording.', baseDocRevision: 3 };
const facts = [{ id: 'f1', status: 'confirmed', quote: 'I checked the lab records.' }];
const base = { segment, facts, citations: { f1: 1 }, liveModel: true, onRequest: vi.fn(async () => ({})), onAccept: vi.fn(async () => ({})), onClose: vi.fn(async () => ({})), onPin: vi.fn() };

describe('sentence suggestion review', () => {
  it('requests an optional bounded instruction without changing the original', async () => {
    const onRequest = vi.fn(async () => ({}));
    render(<SentenceSuggestion {...base} onRequest={onRequest} />);
    const input = screen.getByLabelText('What would you like to improve? (optional)');
    expect(document.activeElement).toBe(input);
    expect(input.maxLength).toBe(500);
    fireEvent.change(input, { target: { value: 'Make it more concise.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Get a suggestion' }));
    await waitFor(() => expect(onRequest).toHaveBeenCalledWith('Make it more concise.'));
    expect(base.onAccept).not.toHaveBeenCalled();
    expect(screen.getByText(segment.text)).toBeTruthy();
  });

  it('shows changed words, cited evidence and explicit acceptance', async () => {
    const onAccept = vi.fn(async () => ({}));
    const { container } = render(<SentenceSuggestion {...base} suggestion={suggestion} onAccept={onAccept} />);
    expect(container.querySelector('del').textContent).toBe('checked');
    expect(container.querySelector('ins').textContent).toBe('reviewed');
    expect(screen.getByRole('button', { name: 'Inspect evidence 1' })).toBeTruthy();
    expect(onAccept).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Use suggestion' }));
    await waitFor(() => expect(onAccept).toHaveBeenCalledOnce());
    expect(screen.getByText(/Approval will reopen only if you use/)).toBeTruthy();
  });

  it('refuses unsupported wording without an accept button and keeps the original', () => {
    render(<SentenceSuggestion {...base} suggestion={{ ...suggestion, status: 'refused', after: null, afterFactIds: [], reason: 'Your notes do not say you led the project.' }} />);
    expect(screen.getByText('Your notes do not say you led the project.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Use suggestion' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Keep mine' })).toBeTruthy();
  });

  it('labels fixture mode and makes no fake model request', () => {
    render(<SentenceSuggestion {...base} liveModel={false} />);
    expect(screen.getByText(/Sentence suggestions need a live model/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Get a suggestion' })).toBeNull();
  });

  it('blocks writes while busy and when a saved suggestion is stale', () => {
    const { rerender } = render(<SentenceSuggestion {...base} suggestion={suggestion} busy />);
    expect(screen.getByRole('button', { name: 'Use suggestion' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Keep mine' }).disabled).toBe(true);
    rerender(<SentenceSuggestion {...base} suggestion={suggestion} stale />);
    expect(screen.queryByRole('button', { name: 'Use suggestion' })).toBeNull();
    expect(screen.getByText(/changed since this suggestion/)).toBeTruthy();
  });

  it('retains the request and offers recovery after a failed call', async () => {
    render(<SentenceSuggestion {...base} onRequest={async () => null} />);
    const input = screen.getByLabelText('What would you like to improve? (optional)');
    fireEvent.change(input, { target: { value: 'Make it clearer.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Get a suggestion' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(input.value).toBe('Make it clearer.');
    fireEvent.keyDown(input, { key: 'Escape' });
    await waitFor(() => expect(base.onClose).toHaveBeenCalled());
  });
});

describe('document integration', () => {
  const props = { title: 'Project answer', doc: { id: 'answer', revision: 3, segments: [segment, { id: 'frame', kind: 'frame', text: 'Thank you.', factIds: [] }] }, citations: { f1: 1 }, facts, liveModel: true, onEdit: vi.fn(), onStrengthen: vi.fn(), onAcceptSuggestion: vi.fn(), onDismissSuggestion: vi.fn() };

  it('offers improvement only for a selected claim and protects unsaved edits', () => {
    render(<DocumentView {...props} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit this sentence' })[0]);
    const improve = screen.getByRole('button', { name: 'Improve this sentence' });
    fireEvent.change(screen.getByLabelText('Edit sentence'), { target: { value: 'My unsaved edit.' } });
    expect(improve.disabled).toBe(true);
    expect(screen.getByText(/Save or cancel your edit/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit this sentence' })[1]);
    expect(screen.queryByRole('button', { name: 'Improve this sentence' })).toBeNull();
  });

  it('restores a persisted suggestion after reload, without changing document text or approval', () => {
    const { container } = render(<DocumentView {...props} suggestion={suggestion} approval="approved" />);
    expect(screen.getByRole('button', { name: 'Use suggestion' })).toBeTruthy();
    expect(container.querySelector('.manuscript-body').textContent).toContain(segment.text);
    expect(screen.getByText('Approved · version 3')).toBeTruthy();
  });

  it('keeps a stale suggestion dismissible if its sentence disappeared', () => {
    render(<DocumentView {...props} doc={{ ...props.doc, segments: [] }} suggestion={suggestion} />);
    expect(screen.queryByRole('button', { name: 'Use suggestion' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Keep mine' })).toBeTruthy();
  });

  it('returns keyboard focus to the selected sentence when cancelling', async () => {
    render(<DocumentView {...props} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit this sentence' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Improve this sentence' }));
    expect(document.activeElement).toBe(screen.getByLabelText('What would you like to improve? (optional)'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getAllByRole('button', { name: 'Edit this sentence' })[0]));
  });

  it('wires the exact server commands with no automatic follow-up or acceptance', async () => {
    const ws = { act: vi.fn(async () => ({})), run: vi.fn(async () => ({})) };
    const actions = useActions(ws, {});
    await actions.strengthen('answer', 's1', 'Make it clearer.');
    expect(ws.run).toHaveBeenCalledWith('strengthen', { docId: 'answer', segmentId: 's1', request: 'Make it clearer.' }, expect.any(String));
    expect(ws.act).not.toHaveBeenCalled();
    await actions.acceptSuggestion('p1');
    await actions.dismissSuggestion('p1');
    expect(ws.act.mock.calls).toEqual([['acceptSuggestion', { suggestionId: 'p1' }], ['dismissSuggestion', { suggestionId: 'p1' }]]);
  });
});
