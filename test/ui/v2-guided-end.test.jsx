// @vitest-environment jsdom
// V2-4: the end of the guided walk-through. Her cited answer, a fact that
// changes, only the sentences that used it rewritten, and a finish line.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GuidedBody } from '../../client/src/components/GuidedBody.jsx';

afterEach(cleanup);
Element.prototype.scrollIntoView = () => {};

const sample = { name: 'Ellie', notes: 'Notes.', correction: { quote: 'I wrote the Helm change.', text: 'My teammate Sam wrote the Helm change; I tested it.' } };
const seg = (id, text, factIds, kind = 'claim') => ({ id, kind, text, factIds, author: 'draft', startsParagraph: false });
const workspace = (over = {}) => ({
  applicant: {
    sources: [{ id: 's1', kind: 'notes', text: 'Notes.', read: true }],
    facts: [
      { id: 'f1', statement: 'Four of us built a GPU job runner.', quote: 'four of us', sourceId: 's1', status: 'confirmed' },
      { id: 'f2', statement: 'I wrote the Helm change.', quote: 'I wrote the Helm change.', sourceId: 's1', status: 'confirmed' },
    ],
  },
  application: {
    form: { company: 'Graphcore', documents: [{ id: 'answer', title: 'Project answer', wordLimit: 300 }, { id: 'letter', title: 'Cover letter', wordLimit: 400 }] },
    documents: {
      answer: { id: 'answer', revision: 1, segments: [seg('a1', 'Four of us built it.', ['f1']), seg('a2', 'I wrote the Helm change.', ['f2'])] },
      letter: { id: 'letter', revision: 1, segments: [seg('l1', 'Dear team,', [], 'frame'), seg('l2', 'I wrote the Helm change.', ['f2'])] },
    },
    questions: [], repair: null, lastRepair: null, approvals: {}, exports: [],
    ...over,
  },
});
const view = (next = 'approve', over = {}) => ({ next, citations: { f1: 1, f2: 2 }, approvals: { answer: 'none', letter: 'none' }, stats: { answer: { words: 9, wordLimit: 300, overLimit: false }, letter: { words: 7, wordLimit: 400, overLimit: false } }, ...over });
const handlers = () => ({ onCorrectFact: vi.fn(), onDecideChange: vi.fn(), onApplyChanges: vi.fn(), onApprove: vi.fn(), onPrimary: vi.fn(), onEdit: vi.fn(), onCite: vi.fn(), onCancelRepair: vi.fn(), onProposeRepair: vi.fn() });
const body = (props) => render(<GuidedBody busy={null} notice={null} modeLabel="Fixture" sample={sample} {...props} />);

describe('step 4: her cited answer', () => {
  it('shows the project answer, opens a number’s evidence in place, and can switch to the cover letter', () => {
    body({ stepKey: 'answer', workspace: workspace(), view: view(), handlers: handlers() });
    expect(screen.getByRole('article', { name: 'Project answer' })).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Evidence 2' })[0]);
    expect(screen.getByRole('dialog', { name: 'Evidence 2' }).textContent).toContain('I wrote the Helm change.');
    fireEvent.click(screen.getByRole('button', { name: 'Show her cover letter' }));
    expect(screen.getByRole('article', { name: 'Cover letter' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show her answer' })).toBeTruthy();
  });
});

describe('step 5: a fact changes', () => {
  it('starts from what she remembers, and corrects the fact in one click', () => {
    const h = handlers();
    body({ stepKey: 'change', workspace: workspace(), view: view(), handlers: h });
    expect(screen.getAllByRole('term').map((t) => t.textContent)).toEqual(['Ellie remembers', 'Fact [2] says']);
    expect(screen.getByText('“My teammate Sam wrote the Helm change; I tested it.”')).toBeTruthy();
    expect(screen.getByText('I wrote the Helm change.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Correct this fact' }));
    expect(h.onCorrectFact).toHaveBeenCalledWith('f2', sample.correction.text);
  });

  it('shows what changed while the rewrite is reviewed', () => {
    const repair = { factId: 'f2', status: 'review', items: [{ id: 'c1', docId: 'answer', segmentId: 'a2', before: 'I wrote the Helm change.', after: 'Sam wrote the Helm change; I tested it.', status: 'proposed', decision: null }] };
    body({ stepKey: 'change', workspace: workspace({ repair }), view: view('repair'), handlers: handlers() });
    expect(screen.getByRole('heading', { name: 'What changed' })).toBeTruthy();
  });

  it('after the change, says how little moved and asks for both approvals', () => {
    const h = handlers();
    const after = workspace({ lastRepair: { factId: 'f2', at: '2026-10-27T10:00:00.000Z', changed: 2, kept: 0, docs: ['answer', 'letter'] } });
    after.application.documents.answer.revision = 2;
    after.application.documents.letter.revision = 2;
    body({ stepKey: 'change', workspace: after, view: view('approve'), handlers: h });
    expect(screen.getByText('Only 2 sentences changed. Everything else stayed exactly as it was.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Approve the project answer, version 2' }));
    expect(h.onApprove).toHaveBeenCalledWith('answer', 2);
    fireEvent.click(screen.getByRole('button', { name: 'Approve the cover letter, version 2' }));
    expect(h.onApprove).toHaveBeenCalledWith('letter', 2);
  });
});

describe('the finish', () => {
  it('sums up what she has, in plain words, and opens the application', () => {
    const h = handlers();
    const done = workspace({ lastRepair: { factId: 'f2', changed: 2, kept: 0, docs: ['answer', 'letter'] } });
    body({ stepKey: 'finish', workspace: done, view: view('export', { approvals: { answer: 'approved', letter: 'approved' } }), handlers: h });
    expect(screen.getAllByRole('term').map((t) => t.textContent)).toEqual(['Notes', 'Facts', 'Question', 'Answer', 'Change']);
    fireEvent.click(screen.getByRole('button', { name: 'See the application' }));
    expect(h.onPrimary).toHaveBeenCalledWith({ id: 'export', label: 'Preview the export' });
  });

  it('says what just happened from saved state and the receipts, naming the fixture as the fixture', () => {
    const done = workspace({ lastRepair: { factId: 'f2', changed: 2, kept: 0, docs: ['answer', 'letter'], reopened: 2, untouched: 2 } });
    done.application.documents.answer.revision = 2;
    done.application.documents.letter.revision = 2;
    const receipt = (step, at) => ({ step, flow: 'draft', provider: 'fixture', model: 'fixture', costUsd: 0, toolCalls: [], at });
    const receipts = [receipt('extract', '2026-10-27T10:00:00.000Z'), receipt('draft-answer', '2026-10-27T10:01:00.000Z')];
    body({ stepKey: 'finish', workspace: done, view: view('export', { approvals: { answer: 'approved', letter: 'approved' } }), handlers: handlers(), receipts });
    const lines = within(screen.getByRole('region', { name: 'What just happened' })).getAllByRole('listitem').map((li) => li.textContent);
    expect(lines).toEqual([
      '2 facts confirmed.',
      'You approved version 2 of both documents.',
      '1 fact corrected: it reopened 2 sentences and left 2 untouched.',
      'The fixture (hand-written, not a model): 2 steps, 0 tool calls, $0.00.',
      'Nothing has been sent.',
    ]);
    expect(screen.queryByText(/model time/)).toBeNull();
  });
});

// UX review of 24f96a5 (29 Oct): in the walk-through the evidence opens beside the
// sentence, not below the whole document; the guided answer is read-only (editing
// lives in the full workspace); the change step offers no "Show in" button, since
// no document is on screen there.
describe('the guided answer, with the evidence beside the sentence', () => {
  const twoParagraphs = () => {
    const w = workspace();
    w.application.documents.answer.segments = [
      { ...seg('a1', 'Four of us built it.', ['f1']), startsParagraph: true },
      { ...seg('a2', 'I wrote the Helm change.', ['f2']), startsParagraph: true },
    ];
    return w;
  };
  const paragraphWith = (text) => [...document.querySelectorAll('p.para')].find((p) => p.textContent.includes(text));

  it('opens a number\u2019s evidence right after that sentence\u2019s paragraph', () => {
    body({ stepKey: 'answer', workspace: twoParagraphs(), view: view(), handlers: handlers() });
    fireEvent.click(screen.getAllByRole('button', { name: 'Evidence 1' })[0]);
    const first = paragraphWith('Four of us built it.');
    expect(first.nextElementSibling.contains(screen.getByRole('dialog', { name: 'Evidence 1' }))).toBe(true);
  });

  it('previews the evidence while a number has focus, and hides it again on blur', () => {
    body({ stepKey: 'answer', workspace: twoParagraphs(), view: view(), handlers: handlers() });
    const number = screen.getAllByRole('button', { name: 'Evidence 2' })[0];
    fireEvent.focus(number);
    expect(paragraphWith('I wrote the Helm change.').nextElementSibling.contains(screen.getByRole('dialog', { name: 'Evidence 2' }))).toBe(true);
    fireEvent.blur(number);
    expect(screen.queryByRole('dialog', { name: 'Evidence 2' })).toBeNull();
  });

  it('is read-only: a sentence opens no editor and offers no edit button', () => {
    body({ stepKey: 'answer', workspace: twoParagraphs(), view: view(), handlers: handlers() });
    fireEvent.click(paragraphWith('Four of us built it.').querySelector('.sentence-text'));
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryAllByRole('button', { name: 'Edit this sentence' })).toHaveLength(0);
  });
});

describe('the guided change step', () => {
  it('offers no "Show in" button, since no document is on screen', () => {
    const repair = { factId: 'f2', status: 'review', items: [{ id: 'c1', docId: 'answer', segmentId: 'a2', before: 'I wrote the Helm change.', after: 'Sam wrote the Helm change; I tested it.', status: 'proposed', decision: null }] };
    body({ stepKey: 'change', workspace: workspace({ repair }), view: view('repair'), handlers: { ...handlers(), onShow: vi.fn() } });
    expect(screen.queryByRole('button', { name: /^Show in the/ })).toBeNull();
  });
});
