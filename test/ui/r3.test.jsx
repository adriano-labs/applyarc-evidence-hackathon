// @vitest-environment jsdom
// Where am I (the step guide) and what next (the Now / Then bar).
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../client/src/App.jsx';
import { StepGuide } from '../../client/src/components/StepGuide.jsx';
import { primaryAction, thenLine } from '../../client/src/flow.js';
import { buildApp } from '../../server/build.js';

afterEach(cleanup);

const ws = ({ sources = [{ id: 's1', kind: 'notes', read: true }], facts = [], questions = [], approvals = {}, exports = [], repair = null, documents = { answer: null, letter: null } } = {}) => ({
  applicant: { sources, facts },
  application: { form: { documents: [{ id: 'answer', title: 'Project answer' }, { id: 'letter', title: 'Cover letter' }] }, questions, approvals, exports, repair, documents },
});
const proposed = (n, sourceId = 's1') => Array.from({ length: n }, (_, i) => ({ id: `f${i + 1}`, status: 'proposed', sourceId }));
const steps = (container) => [...container.querySelectorAll('ol[aria-label="Progress"] > li')];
const current = (container) => container.querySelector('[aria-current="step"]');

describe('StepGuide', () => {
  it('shows the six steps with the first one current on a fresh run', () => {
    const { container } = render(<StepGuide view={{ next: 'notes' }} workspace={ws({ sources: [] })} />);
    expect(steps(container).map((li) => li.querySelector('.step-label').textContent)).toEqual(['Notes', 'Facts', 'Question', 'Drafts', 'Approve', 'Export']);
    expect(current(container).querySelector('.step-label').textContent).toBe('Notes');
  });

  it('marks done steps and says what waits on the applicant, once', () => {
    const { container } = render(<StepGuide view={{ next: 'facts' }} workspace={ws({ facts: proposed(11) })} />);
    expect(steps(container)[0].classList.contains('done')).toBe(true);
    expect(current(container).querySelector('.step-label').textContent).toBe('Facts');
    expect(current(container).querySelector('.chip-needs').textContent).toBe('11 to check');
    expect(container.querySelector('.step-phone').textContent).toBe('Step 2 of 6 · Facts · 11 to check');
  });

  it('stays on the question step while the answer is being read and checked', () => {
    const answerWs = ws({ sources: [{ id: 's1', kind: 'notes', read: true }, { id: 's2', kind: 'answer', read: true }], facts: proposed(3, 's2'), questions: [{ id: 'q1', status: 'answered' }] });
    const { container } = render(<StepGuide view={{ next: 'facts' }} workspace={answerWs} />);
    expect(current(container).querySelector('.step-label').textContent).toBe('Question');
    expect(current(container).querySelector('.chip-needs').textContent).toBe('3 from your answer');
  });

  it('counts approvals, relabels the step while changes are open, and ticks the export', () => {
    const approving = render(<StepGuide view={{ next: 'approve' }} workspace={ws({ approvals: { answer: { revision: 1 }, letter: null } })} />);
    expect(current(approving.container).querySelector('.step-detail').textContent).toBe('1 of 2 approved');
    cleanup();
    const repair = { status: 'review', items: [{ id: 'c1', status: 'proposed', decision: null }, { id: 'c2', status: 'conflict', decision: null }] };
    const repairing = render(<StepGuide view={{ next: 'repair' }} workspace={ws({ repair })} />);
    expect(current(repairing.container).querySelector('.step-label').textContent).toBe('Review changes');
    expect(current(repairing.container).querySelector('.chip-needs').textContent).toBe('1 needs you');
    cleanup();
    const exported = render(<StepGuide view={{ next: 'export' }} workspace={ws({ exports: [{ id: 'e1' }] })} />);
    expect(steps(exported.container)[5].classList.contains('done')).toBe(true);
  });
});

describe('the Then line and the approve order', () => {
  it('says what happens after the current step, briefly', () => {
    const lines = ['read', 'facts', 'question', 'draft', 'approve', 'repair'].map((next) => thenLine({ next }, ws()));
    expect(lines).toEqual([
      'Then: you confirm each fact it finds.',
      'Then: the app asks about anything missing.',
      'Then: both documents are written from your facts.',
      'Then: every sentence cites its facts.',
      'Then: export a pack marked NOT SUBMITTED.',
      'Then: approve the new versions.',
    ]);
    expect(thenLine({ next: 'export' }, ws())).toBe('Nothing is submitted: you paste it in yourself.');
    expect(thenLine({ next: 'export' }, ws({ exports: [{ id: 'e1' }] }))).toBe('Your pack is ready. Nothing was submitted.');
    expect(lines.every((l) => l.length <= 60)).toBe(true);
  });

  it('offers the document on screen first, even the cover letter', () => {
    const drafted = ws({ documents: { answer: { id: 'answer', revision: 1, segments: [] }, letter: { id: 'letter', revision: 1, segments: [] } } });
    const view = { next: 'approve', approvals: { answer: 'none', letter: 'none' }, stats: { answer: { overLimit: false }, letter: { overLimit: false } } };
    expect(primaryAction(view, drafted, 'letter')).toMatchObject({ id: 'approve:letter', label: 'Approve the cover letter, version 1' });
  });
});

describe('the Now bar in the app', () => {
  let server;
  beforeEach(() => {
    server = buildApp({ dataDir: mkdtempSync(join(tmpdir(), 'r3-')), env: {} });
    globalThis.fetch = (url, init) => server.request(String(url), init);
    Element.prototype.scrollIntoView = () => {};
  });

  it('names the step and takes the applicant to its panel', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Try it with Ellie’s notes' }, { timeout: 4000 }));
    fireEvent.click(await screen.findByRole('button', { name: 'Open the full workspace' }, { timeout: 4000 }));
    expect(await screen.findByText('Now: confirm or reject each fact.', {}, { timeout: 4000 })).toBeTruthy();
    expect(screen.getByText('Then: the app asks about anything missing.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show me' }));
    await waitFor(() => expect(document.activeElement.classList.contains('facts-review')).toBe(true));
  });
});
