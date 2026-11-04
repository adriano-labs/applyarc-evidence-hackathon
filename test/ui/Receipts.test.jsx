// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReceiptsDrawer } from '../../client/src/components/ReceiptsDrawer.jsx';

afterEach(cleanup);

const receipts = [
  { step: 'extract', flow: 'read', provider: 'meta', isMeta: true, model: 'muse-spark-1.3', effort: 'low', turns: 2, attempts: 2, requestIds: ['req-1', 'req-2'], toolCalls: [{ name: 'verify_quote', ok: true, note: 'verbatim' }, { name: 'form_requirements', ok: true, note: 'read' }], usage: { input: 3000, cached: 1200, output: 600, reasoning: 200 }, costUsd: 0.0049, firstEventMs: 640, totalMs: 4100, at: '2026-10-27T09:00:00Z' },
  { step: 'draft', flow: 'draft', provider: 'meta', isMeta: true, model: 'muse-spark-1.3', effort: 'medium', turns: 1, attempts: 3, requestIds: ['req-3'], toolCalls: [], usage: { input: 5000, cached: 0, output: 900, reasoning: 0 }, costUsd: null, firstEventMs: null, totalMs: 2100, error: 'cut', at: '2026-10-27T09:01:00Z' },
];
const base = { receipts, modeLabel: 'Meta Muse Spark 1.3', onDownload: vi.fn() };
const open = (props = {}) => {
  const result = render(<ReceiptsDrawer {...base} {...props} />);
  fireEvent.click(screen.getByRole('button', { name: /What (Meta|the model) did/ }));
  return result;
};
const text = (el) => el.textContent.replace(/\s+/g, ' ');

describe('ReceiptsDrawer', () => {
  it('sums every model step in one quiet line when closed', () => {
    render(<ReceiptsDrawer {...base} />);
    const toggle = screen.getByRole('button', { name: /What Meta did/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.textContent).toContain('muse-spark-1.3 · 2 runs · 2 steps · 2 tool calls · 6.2 s total model time · $0.0049 + 1 not settled');
  });

  it('opens into numbered runs of sentences, one row per recorded step, tagged by who did it', () => {
    const { container } = open();
    const runs = container.querySelectorAll('.trail-run');
    expect(runs).toHaveLength(2);
    expect(text(runs[0].querySelector('.trail-run-head'))).toBe('1 Read your words 4.1 s · $0.0049');
    expect(text(runs[1].querySelector('.trail-run-head'))).toBe('2 Did not finish 2.1 s · cost not settled');
    const steps = container.querySelectorAll('.receipt');
    expect(steps).toHaveLength(2);
    expect(steps[0].querySelector('.trail-tag').textContent).toBe('Spark');
    expect(steps[0].querySelector('.trail-sentence').textContent).toBe('Read your words');
    const codeRows = [...runs[0].querySelectorAll('.trail-row.code')].map((row) => [row.querySelector('.trail-tag').textContent, text(row.querySelector('.trail-row-body'))]);
    expect(codeRows).toEqual([['Checked by code', 'Checked 1 quote against your words: 1 word for word'], ['Checked by code', 'Read the form']]);
    expect(steps[1].querySelector('.trail-sentence').textContent).toBe('Drafted a document');
    expect(steps[1].classList.contains('failed')).toBe(true);
    expect(steps[1].textContent).toContain('Stopped: the stream was cut. Kept charged in the spend cap.');
    expect(screen.getByText('Spark proposes. The app checks quotes, word counts and the form by code. You decide which facts, changes and versions are kept. Nothing is submitted.')).toBeTruthy();
    expect(screen.getByText('A word-for-word match proves the quote, not the claim.')).toBeTruthy();
  });

  it('keeps every technical fact one disclosure away, closed by default', () => {
    const { container } = open();
    const [first, second] = container.querySelectorAll('.receipt');
    const details = first.querySelector('details');
    expect(details.open).toBe(false);
    expect(details.querySelector('summary').textContent).toBe('Details');
    expect(first.textContent).toContain('muse-spark-1.3 · effort low');
    expect(first.textContent).toContain('3,000 in (1,200 cached) · 600 out · 200 reasoning');
    expect(first.textContent).toContain('first event 640 ms · done 4.1 s · $0.0049');
    expect(first.textContent).toContain('tool calls: verify_quote: verbatim ×1 · form_requirements: read ×1');
    expect(first.querySelector('.trail-ids code').textContent).toBe('req-1, req-2');
    expect(second.textContent).toContain('done 2.1 s · not reported · 2 retries');
    expect(container.querySelector('.receipts-body').textContent).not.toMatch(/undefined|NaN/);
  });

  it('offers the full trace as a download', () => {
    const onDownload = vi.fn();
    open({ onDownload });
    fireEvent.click(screen.getByRole('button', { name: 'Download the trace (JSON) to verify this run' }));
    expect(onDownload).toHaveBeenCalled();
  });

  it('calls the drawer by the mode when the model is not Meta', () => {
    render(<ReceiptsDrawer {...base} receipts={[]} modeLabel="Fixture" />);
    expect(screen.getByRole('button', { name: /What the model did/ }).textContent).toContain('No model calls yet');
  });

  it('tags fixture rows as the fixture and never as a Meta model', () => {
    const fixture = [
      { step: 'extract', flow: 'read', provider: 'fixture', model: 'fixture', costUsd: 0, toolCalls: [], at: '2026-10-27T09:00:00Z' },
      { step: 'draft-answer', flow: 'draft', provider: 'fixture', model: 'fixture', costUsd: 0, toolCalls: [], at: '2026-10-27T09:01:00Z' },
      { step: 'draft-letter', flow: 'draft', provider: 'fixture', model: 'fixture', costUsd: 0, toolCalls: [], at: '2026-10-27T09:01:01Z' },
    ];
    const { container } = open({ receipts: fixture, modeLabel: 'Fixture' });
    expect([...container.querySelectorAll('.receipt .trail-tag')].map((t) => t.textContent)).toEqual(['Fixture', 'Fixture', 'Fixture']);
    expect([...container.querySelectorAll('.trail-sentence')].map((t) => t.textContent)).toEqual(['Read your words', 'Drafted “Project answer”', 'Drafted “Cover letter”']);
    expect(text(container.querySelector('.trail-run-head'))).toBe('1 Read your words $0.00');
    expect(screen.getByRole('button', { name: /What the model did/ }).textContent).toContain('fixture · 2 runs · 3 steps · 0 tool calls · $0.00');
    expect(container.textContent).not.toMatch(/Wonder|Spark|Meta|total model time/);
    expect(screen.getByText(/^The fixture proposes\./)).toBeTruthy();
  });

  it('closes each run with the applicant’s decisions, read from saved state and never inferred', () => {
    const workspace = {
      applicant: {
        sources: [{ id: 's1', kind: 'notes' }, { id: 's2', kind: 'answer' }],
        facts: [{ id: 'f1', sourceId: 's1', status: 'confirmed' }, { id: 'f2', sourceId: 's1', status: 'confirmed' }, { id: 'f3', sourceId: 's1', status: 'rejected' }, { id: 'f4', sourceId: 's2', status: 'confirmed' }],
      },
      application: {
        form: { documents: [{ id: 'answer', title: 'Project answer' }, { id: 'letter', title: 'Cover letter' }] },
        documents: { answer: { revision: 2 }, letter: { revision: 2 } },
        questions: [{ id: 'q1', status: 'answered' }],
        lastRepair: { changed: 2, at: '2026-11-03T10:06:00Z' },
      },
    };
    const view = { approvals: { answer: 'approved', letter: 'approved' } };
    const meta = (step, flow, at) => ({ step, flow, provider: 'meta', isMeta: true, model: 'muse-wonder-1.0', costUsd: 0.01, totalMs: 1000, toolCalls: [], at });
    const trail = [meta('extract', 'read', '2026-11-03T10:00:00Z'), meta('clarify', 'check', '2026-11-03T10:01:00Z'), meta('extract', 'read', '2026-11-03T10:02:00Z'),
      { ...meta('draft', 'draft', '2026-11-03T10:03:00Z'), docId: 'answer' }, { kind: 'stage', flow: 'draft', label: 'The evidence check refused 1 sentence; asking for a fix', at: '2026-11-03T10:03:30Z' }, meta('revise', 'draft', '2026-11-03T10:04:00Z'),
      meta('repair', 'repair', '2026-11-03T10:05:00Z')];
    const { container } = open({ receipts: trail, modeLabel: 'Meta Muse Wonder 1.0', workspace, view });
    const runs = [...container.querySelectorAll('.trail-run')].map((run) => [
      text(run.querySelector('.trail-run-title')),
      [...run.querySelectorAll('.trail-row')].map((row) => `${row.querySelector('.trail-tag').textContent}: ${text(row.querySelector('.trail-sentence') ?? row.querySelector('.trail-row-body'))}`),
    ]);
    expect(runs).toEqual([
      ['Read your notes', ['Wonder: Read your words', 'You: You confirmed 2 facts']],
      ['Checked the form', ['Wonder: Compared your facts with what the form asks for', 'You: You answered the question']],
      ['Read your answer', ['Wonder: Read your words', 'You: You confirmed 1 fact']],
      ['Wrote both documents', ['Wonder: Drafted “Project answer”', 'The app: The evidence check refused 1 sentence; asking for a fix', 'Wonder: Rewrote only the sentences the check refused']],
      ['Proposed changes after your correction', ['Wonder: Proposed new wording for the sentences that cite the corrected fact', 'You: You applied 2 changes', 'You: You approved version 2 of both documents']],
    ]);
    expect(screen.getByRole('button', { name: /What Meta did/ }).textContent).toContain('muse-wonder-1.0 · 5 runs · 6 steps · 0 tool calls');
  });

  it('shows no decision rows when the state does not exist', () => {
    const { container } = open({ workspace: { applicant: { sources: [], facts: [] }, application: { questions: [], documents: {}, form: { documents: [] } } }, view: { approvals: {} } });
    expect(container.querySelectorAll('.trail-row.you')).toHaveLength(0);
  });

  it('names the open-weight edition from the mode and the receipts, never from styling', () => {
    const openWeight = [{ step: 'extract', flow: 'read', provider: 'compatible', isMeta: true, model: 'meta-models/muse-spark-open-1026', host: 'modal', effort: null, turns: 1, attempts: 1, requestIds: ['chat-1'], toolCalls: [], usage: { input: 10, cached: 0, output: 5, reasoning: 0 }, costUsd: 0.001, firstEventMs: 100, totalMs: 900, at: '2026-11-03T10:00:00Z' }];
    const { container } = open({ receipts: openWeight, modeLabel: 'Meta Muse Spark Open on Modal', mode: { id: 'compatible', label: 'Meta Muse Spark Open on Modal', model: 'meta-models/muse-spark-open-1026', isMeta: true } });
    expect(screen.getByRole('button', { name: /What Meta did/ }).querySelector('.trail-badge').textContent).toBe('Meta open weight');
    expect(screen.getByText('Open-weight edition: meta-models/muse-spark-open-1026, served on modal. Download the trace to verify.')).toBeTruthy();
    expect(text(container.querySelector('.trail-run-title'))).toBe('Read your words modal');
    expect(container.querySelector('.receipt .trail-tag').textContent).toBe('Spark Open');
    expect(container.querySelector('.receipt').textContent).toContain('meta-models/muse-spark-open-1026 · modal');
    expect(container.querySelector('.receipt').textContent).not.toContain('effort');
    cleanup();
    open();
    expect(screen.queryByText(/open weight/i)).toBeNull();
  });

  it('shows the running step as the next run, from the stream alone', () => {
    const busy = { name: 'read', label: 'Reading your words', stage: 'Reading your words', toolCounts: { verify_quote: 7, verbatim: 7 }, retry: { attempt: 2, of: 3 } };
    const { container } = open({ busy });
    const running = container.querySelector('.trail-run.running');
    expect(text(running.querySelector('.trail-run-head'))).toBe('3 Reading your words');
    expect(running.textContent).toContain('Checked 7 quotes word for word so far');
    expect(running.textContent).toContain('tried again, 2 of 3');
    expect(container.querySelectorAll('.receipt')).toHaveLength(2);
    cleanup();
    open({ busy: { name: 'recover', label: 'Checking your saved step' } });
    expect(document.querySelector('.trail-run.running')).toBeNull();
  });
});
