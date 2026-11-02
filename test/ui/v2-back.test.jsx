// @vitest-environment jsdom
// V2-4b: go back to any finished step. The step bar names the five steps, a finished
// one opens a read-only look back, and the finish lists what was done, one row a step.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../client/src/App.jsx';
import { GuidedBody } from '../../client/src/components/GuidedBody.jsx';
import { GuidedReview } from '../../client/src/components/GuidedReview.jsx';
import { GuidedRun } from '../../client/src/components/GuidedRun.jsx';
import { buildApp } from '../../server/build.js';

afterEach(cleanup);
Element.prototype.scrollIntoView = () => {};

const sample = { name: 'Ellie', possessive: 'her', notes: 'I built a GPU job runner.\n\nFour of us.', correction: { anchor: 'Helm change', text: 'My teammate Sam wrote the Helm change; I tested it.' } };
const seg = (id, text, factIds, kind = 'claim') => ({ id, kind, text, factIds, author: 'draft', startsParagraph: false });
const workspace = (over = {}) => ({
  applicant: {
    sources: [
      { id: 's1', kind: 'notes', text: 'I built a GPU job runner.\n\nFour of us.', read: true },
      { id: 's2', kind: 'answer', text: 'I wrote the scheduler myself.', questionId: 'q1', read: true },
      { id: 's3', kind: 'correction', text: 'My teammate Sam wrote the Helm change; I tested it.', read: true },
    ],
    facts: [
      { id: 'f1', statement: 'Four of us built a GPU job runner.', quote: 'Four of us.', sourceId: 's1', status: 'confirmed', history: [] },
      { id: 'f2', statement: 'Sam wrote the Helm change; Ellie tested it.', quote: 'My teammate Sam wrote the Helm change; I tested it.', sourceId: 's3', status: 'confirmed', history: [{ statement: 'Ellie wrote the Helm change.', quote: 'I wrote the Helm change.', sourceId: 's1', at: '2026-10-27T10:00:00.000Z' }] },
      { id: 'f3', statement: 'Ellie wrote the scheduler herself.', quote: 'I wrote the scheduler myself.', sourceId: 's2', status: 'confirmed', history: [] },
      { id: 'f4', statement: 'A line she turned down.', quote: 'job runner', sourceId: 's1', status: 'rejected', history: [] },
    ],
  },
  application: {
    form: { company: 'Graphcore', documents: [{ id: 'answer', title: 'Project answer', wordLimit: 300 }, { id: 'letter', title: 'Cover letter', wordLimit: 400 }] },
    documents: {
      answer: { id: 'answer', revision: 2, segments: [seg('a1', 'Four of us built it.', ['f1']), seg('a2', 'Sam wrote the Helm change.', ['f2'])] },
      letter: { id: 'letter', revision: 2, segments: [seg('l1', 'Dear team,', [], 'frame'), seg('l2', 'I wrote the scheduler myself.', ['f3'])] },
    },
    questions: [{ id: 'q1', requirementId: 'r1', text: 'Which part of the project did you do yourself?', status: 'answered', sourceId: 's2' }],
    repair: null,
    lastRepair: { factId: 'f2', at: '2026-10-27T10:05:00.000Z', changed: 2, kept: 0, docs: ['answer', 'letter'] },
    approvals: {},
    exports: [],
    ...over,
  },
});
const view = (next, over = {}) => ({ next, citations: { f1: 1, f2: 2, f3: 3 }, approvals: { answer: 'none', letter: 'none' }, stats: { answer: { words: 9, wordLimit: 300, overLimit: false }, letter: { words: 7, wordLimit: 400, overLimit: false } }, ...over });
const h1 = () => screen.getByRole('heading', { level: 1 }).textContent;

function frame(next, props = {}) {
  const onReview = vi.fn();
  render(
    <GuidedRun view={view(next)} workspace={workspace()} story={null} sampleName="Ellie" possessive="her" onPrimary={vi.fn()} onStory={vi.fn()} onExit={vi.fn()} onReview={onReview} {...props}>
      <p>step body</p>
    </GuidedRun>,
  );
  return { onReview, steps: screen.getByRole('list', { name: 'Steps' }) };
}

describe('the step bar', () => {
  it('names the five steps: finished ones open, the current one is marked, later ones are plain text', () => {
    const { onReview, steps } = frame('question');
    expect(within(steps).getAllByRole('listitem')).toHaveLength(5);
    expect(within(steps).getAllByRole('button').map((b) => b.textContent)).toEqual(['Notes', 'Facts']);
    expect(within(steps).getByText('Question').closest('[aria-current="step"]')).toBeTruthy();
    expect(within(steps).getByText('Answer').closest('button')).toBeNull();
    expect(within(steps).getByText('Change').closest('button')).toBeNull();
    expect(screen.getByText('Step 3 of 5')).toBeTruthy();
    fireEvent.click(within(steps).getByRole('button', { name: 'Facts' }));
    expect(onReview).toHaveBeenCalledWith(2);
  });

  it('has a Back button from step 2 on, which opens the step before', () => {
    const { onReview } = frame('question');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onReview).toHaveBeenCalledWith(2);
  });

  it('has nothing to go back to on step 1', () => {
    const { steps } = frame('read');
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    expect(within(steps).queryAllByRole('button')).toHaveLength(0);
  });

  it('on the finish, every step opens, and Back opens the change', () => {
    const { onReview, steps } = frame('export');
    expect(within(steps).getAllByRole('button')).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onReview).toHaveBeenCalledWith(5);
  });
});

describe('looking back', () => {
  it('shows a finished step under its own headline, and returns to the live step', () => {
    const { onReview, steps } = frame('question', { reviewStep: 2 });
    expect(h1()).toBe('The 3 facts Ellie confirmed');
    expect(screen.getByText('Looking back at step 2 of 5')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onReview).toHaveBeenLastCalledWith(1);
    fireEvent.click(screen.getByRole('button', { name: 'Return to step 3' }));
    expect(onReview).toHaveBeenLastCalledWith(null);
    fireEvent.click(within(steps).getByRole('button', { name: 'Question' }));
    expect(onReview).toHaveBeenLastCalledWith(null);
  });

  it('steps forward through finished steps, and hides the live step’s own button meanwhile', () => {
    const { onReview } = frame('approve', { reviewStep: 1 });
    expect(h1()).toBe('Ellie’s notes, as she wrote them');
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Next: change a fact' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Next: Facts' }));
    expect(onReview).toHaveBeenCalledWith(2);
  });

  it('returns from the last look back to the finish', () => {
    const { onReview } = frame('export', { reviewStep: 5 });
    expect(h1()).toBe('The fact she corrected');
    fireEvent.click(screen.getByRole('button', { name: 'Return to the finish' }));
    expect(onReview).toHaveBeenCalledWith(null);
  });

  it('uses his words for Marcus', () => {
    frame('question', { reviewStep: 1, sampleName: 'Marcus', possessive: 'his' });
    expect(h1()).toBe('Marcus’s notes, as he wrote them');
  });
});

describe('what a look back shows, read-only', () => {
  const review = (n, ws = workspace()) => render(<GuidedReview n={n} workspace={ws} view={view('export')} sample={sample} possessive="her" />);

  it('step 1: her notes, paragraph by paragraph', () => {
    review(1);
    expect(screen.getByText('I built a GPU job runner.')).toBeTruthy();
    expect(screen.getByText('Four of us.')).toBeTruthy();
  });

  it('step 2: only the facts she confirmed, each with her exact words, and nothing to click', () => {
    review(2);
    const items = within(screen.getByRole('list', { name: 'Confirmed facts' })).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0].textContent).toContain('Four of us built a GPU job runner.');
    expect(items[0].textContent).toContain('“Four of us.”');
    expect(screen.queryByText('A line she turned down.')).toBeNull();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('step 3: the question the app asked, and her answer', () => {
    review(3);
    expect(screen.getByText('Which part of the project did you do yourself?')).toBeTruthy();
    expect(screen.getByText('I wrote the scheduler myself.')).toBeTruthy();
  });

  it('step 4: her cited answer, with the cover letter one click away', () => {
    review(4);
    expect(screen.getByRole('article', { name: 'Project answer' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show her cover letter' }));
    expect(screen.getByRole('article', { name: 'Cover letter' })).toBeTruthy();
  });

  it('step 5: the fact as it was and as it is, and how little changed', () => {
    review(5);
    expect(screen.getAllByRole('term').map((t) => t.textContent)).toEqual(['Was', 'Now']);
    expect(screen.getByText('Ellie wrote the Helm change.')).toBeTruthy();
    expect(screen.getByText('Sam wrote the Helm change; Ellie tested it.')).toBeTruthy();
    expect(screen.getByText('Only 2 sentences changed. Everything else stayed exactly as it was.')).toBeTruthy();
  });

  it('step 5 says so plainly when no fact was corrected', () => {
    review(5, workspace({ lastRepair: null }));
    expect(screen.getByText('No fact was corrected.')).toBeTruthy();
  });
});

describe('the finish', () => {
  it('lists what was done, one row a step, each with a way back', () => {
    const onReview = vi.fn();
    const onPrimary = vi.fn();
    render(<GuidedBody stepKey="finish" workspace={workspace()} view={view('export', { approvals: { answer: 'approved', letter: 'approved' } })} busy={null} notice={null} modeLabel="Fixture" sample={sample} handlers={{ onReview, onPrimary }} />);
    expect(screen.getAllByRole('term').map((t) => t.textContent)).toEqual(['Notes', 'Facts', 'Question', 'Answer', 'Change']);
    expect(screen.getByText('9 words of rough notes')).toBeTruthy();
    expect(screen.getByText('3 facts confirmed, each tied to her own words')).toBeTruthy();
    expect(screen.getByText('1 question answered in her own words')).toBeTruthy();
    expect(screen.getByText('3 statements in 2 documents, each citing her facts')).toBeTruthy();
    expect(screen.getByText('1 fact corrected; only the 2 sentences that used it were rewritten')).toBeTruthy();
    expect(screen.queryByText(/ · /)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'View facts' }));
    expect(onReview).toHaveBeenCalledWith(2);
    fireEvent.click(screen.getByRole('button', { name: 'View change' }));
    expect(onReview).toHaveBeenCalledWith(5);
    fireEvent.click(screen.getByRole('button', { name: 'See the application' }));
    expect(onPrimary).toHaveBeenCalledWith({ id: 'export', label: 'Preview the export' });
  });
});

describe('step 5 never leaves her stuck', () => {
  it('offers both approvals when no confirmed fact matches what she remembers', () => {
    const onApprove = vi.fn();
    const other = { ...sample, correction: { anchor: 'no such line', text: 'Something else entirely.' } };
    render(<GuidedBody stepKey="change" workspace={workspace({ lastRepair: null })} view={view('approve')} busy={null} notice={null} modeLabel="Fixture" sample={other} handlers={{ onApprove }} />);
    expect(screen.getByText('No confirmed fact mentions this, so nothing needs rewriting.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Approve the project answer, version 2' }));
    expect(onApprove).toHaveBeenCalledWith('answer', 2);
  });
});

describe('looking back in the app', () => {
  it('says who it is for, then opens a finished step from the step bar and returns', async () => {
    const server = buildApp({ dataDir: mkdtempSync(join(tmpdir(), 'back-')), env: {} });
    globalThis.fetch = (url, init) => server.request(String(url), init);
    const wait = { timeout: 4000 };
    render(<App />);
    expect(await screen.findByText('Built for applicants, not employers: it never screens, scores or ranks anyone, and never submits anything.', {}, wait)).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'Try it with Ellie’s notes' }, wait));
    await screen.findByText('Step 2 of 5', {}, wait);
    fireEvent.click(within(screen.getByRole('list', { name: 'Steps' })).getByRole('button', { name: 'Notes' }));
    expect(h1()).toBe('Ellie’s notes, as she wrote them');
    fireEvent.click(screen.getByRole('button', { name: 'Return to step 2' }));
    expect(h1()).toMatch(/^Found \d+ facts in Ellie’s own words$/);
  });
});
