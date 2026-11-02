// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../client/src/App.jsx';
import { ConflictDecisions } from '../../client/src/components/ConflictDecisions.jsx';
import { buildApp } from '../../server/build.js';
import { decideFact, proposeFacts } from '../../server/domain/facts.js';
import { addSource } from '../../server/domain/workspace.js';
import { writeJsonAtomic } from '../../server/store/jsonFile.js';
import { workspaceWithNotes } from '../helpers.js';

afterEach(cleanup);
const decisions = [{ questionId: 'q1', factId: 'f1', quote: 'I restored the booking server myself' }];

describe('the earlier fact an answered conflict was about', () => {
  it('shows the fact and offers correct, keep and remove', () => {
    const onSettle = vi.fn();
    const onCorrect = vi.fn();
    render(<ConflictDecisions decisions={decisions} onSettle={onSettle} onCorrect={onCorrect} />);
    expect(screen.getByText('“I restored the booking server myself”')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Correct this fact' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove it' }));
    expect(onCorrect).toHaveBeenCalledWith('f1', 'q1');
    expect(onSettle.mock.calls).toEqual([['q1', 'f1', 'keep'], ['q1', 'f1', 'remove']]);
  });

  it('offers no Remove for a fact the drafts cite', () => {
    render(<ConflictDecisions decisions={[{ ...decisions[0], cited: true }]} onSettle={() => {}} onCorrect={() => {}} />);
    expect(screen.getByRole('button', { name: 'Keep it' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remove it' })).toBeNull();
  });

  it('shows nothing when no earlier fact is waiting', () => {
    const { container } = render(<ConflictDecisions decisions={[]} onSettle={() => {}} onCorrect={() => {}} />);
    expect(container.textContent).toBe('');
  });
});

// Seen at 375 px: the decision sat in the Evidence pane while the phone badge
// counted only open questions, so nothing on the Writing side said it waited.
describe('on a phone, the Evidence badge counts the waiting decision', () => {
  it('names it in the Evidence button', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'conflict-badge-'));
    const { ws, source } = workspaceWithNotes('I restored the booking server myself when it went down.');
    source.read = true;
    proposeFacts(ws, source.id, [{ statement: 'Restored the booking server.', quote: 'I restored the booking server myself', requirementIds: ['contribution'] }]);
    decideFact(ws, 'f1', 'confirm');
    const answer = addSource(ws, { kind: 'answer', text: 'I followed the helpdesk instructions.', now: '2026-10-30T10:00:00.000Z' });
    answer.read = true;
    ws.application.questions.push({ id: 'q1', kind: 'source-conflict', status: 'answered', text: 'Did you restore it yourself?',
      priorSourceId: source.id, priorQuote: 'I restored the booking server myself', sourceId: answer.id });
    writeJsonAtomic(join(dataDir, 'users', 'local', 'workspace.json'), ws);
    const server = buildApp({ dataDir, env: {} });
    globalThis.fetch = (url, init) => server.request(String(url), init);
    Element.prototype.scrollIntoView = () => {};
    render(<App />);
    expect(await screen.findByRole('button', { name: 'Evidence, 1 need you' })).toBeTruthy();
  });
});
