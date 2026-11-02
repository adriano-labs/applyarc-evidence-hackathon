// @vitest-environment jsdom
// R8: tabs that say each document's state, and an example page before anything is written.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DocSpecimen } from '../../client/src/components/DocSpecimen.jsx';
import { DocumentPane } from '../../client/src/components/DocumentPane.jsx';
import { tabStates } from '../../client/src/tabs.js';

afterEach(cleanup);

const formDocs = [{ id: 'answer', title: 'Project answer', wordLimit: 300, limitSource: 'form' }, { id: 'letter', title: 'Cover letter', wordLimit: 400, limitSource: 'guide' }];
const ws = (over = {}) => ({
  applicant: { sources: [], facts: [], ...over.applicant },
  application: { form: { company: 'Graphcore', documents: formDocs }, documents: {}, questions: [], repair: null, ...over.application },
});
const fact = (id, status) => ({ id, status, statement: id, quote: id, sourceId: 's1' });
const doc = (revision) => ({ id: 'answer', revision, segments: [] });
const stats = (words, wordLimit = 300) => ({ words, wordLimit, overLimit: words > wordLimit });

describe('R8 tab states', () => {
  it('starts with "Start here" and "Not written yet"', () => {
    const s = tabStates({ next: 'notes', approvals: {}, stats: {} }, ws(), null);
    expect(s.notes).toEqual({ text: 'Start here', short: 'Start', tone: null });
    expect(s.answer).toEqual({ text: 'Not written yet', short: 'Not yet', tone: null });
    expect(s.letter.text).toBe('Not written yet');
  });

  it('follows the notes: reading, facts to check, facts confirmed', () => {
    const view = { next: 'facts', approvals: {}, stats: {} };
    expect(tabStates(view, ws(), { name: 'read' }).notes.text).toBe('Reading…');
    const checking = ws({ applicant: { facts: [fact('a', 'proposed'), fact('b', 'proposed'), fact('c', 'confirmed')] } });
    expect(tabStates(view, checking, null).notes).toEqual({ text: '2 to check', short: '2 to check', tone: 'needs' });
    const done = ws({ applicant: { facts: [fact('a', 'confirmed'), fact('b', 'rejected')] } });
    expect(tabStates(view, done, null).notes).toEqual({ text: '1 fact confirmed', short: '1 fact', tone: null });
  });

  it('follows each document: written, approved, changed, change proposed, over the limit', () => {
    const at = (approval, words, over = {}) => tabStates({ next: 'approve', approvals: { answer: approval }, stats: { answer: stats(words) } }, ws({ application: { documents: { answer: doc(2) }, ...over } }), null).answer;
    expect(at('none', 206)).toEqual({ text: 'Version 2 · 206 of 300 words', short: '206/300', tone: null });
    expect(at('approved', 206)).toEqual({ text: 'Approved · version 2', short: 'v2', tone: 'approved' });
    expect(at('stale', 206)).toEqual({ text: 'Changed: review version 2', short: 'Review v2', tone: 'needs' });
    expect(at('none', 312)).toEqual({ text: '312 of 300 words: over', short: '312/300', tone: 'needs' });
    expect(at('approved', 206, { repair: { items: [{ docId: 'answer' }] } })).toEqual({ text: 'Change proposed', short: 'Change', tone: 'needs' });
  });
});

describe('R8 the tabs', () => {
  it('show the name and the state on two lines, with the shortcut announced but no key drawn', () => {
    const { container } = render(<DocumentPane tab="notes" workspace={ws()} view={{ next: 'notes', approvals: {}, stats: {} }} sample={null} onTab={vi.fn()} />);
    expect(container.querySelector('kbd')).toBeNull();
    const answer = screen.getByRole('tab', { name: /Project answer/ });
    expect(answer.getAttribute('aria-keyshortcuts')).toBe('2');
    expect(answer.getAttribute('title')).toBe('Press 2');
    expect(answer.querySelector('.tab-name').textContent).toBe('Project answer');
    expect(answer.querySelector('.tab-short').textContent).toBe('Answer');
    expect(answer.querySelector('.tab-state').textContent).toBe('Not written yet');
    expect(screen.getByRole('tab', { name: /Your notes/ }).querySelector('.tab-state').textContent).toBe('Start here');
  });
});

describe('R8 the example page', () => {
  it('shows what a cited sentence will look like, and the way to the current step', () => {
    const onGo = vi.fn();
    const { container } = render(<DocSpecimen docId="answer" title="Project answer" company="Graphcore" wordLimit={300} limitSource="form" step={1} onGo={onGo} />);
    expect(screen.getByRole('heading', { name: 'Project answer' })).toBeTruthy();
    expect(screen.getByText('Not written yet · up to 300 words')).toBeTruthy();
    expect(screen.getByText('This becomes your answer to Graphcore’s question. Each factual claim will cite a fact you confirmed, like this:')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Example' })).toBeTruthy();
    expect(container.querySelector('.specimen-sentence').textContent).toBe('Our team built a self-service GPU job runner for the department’s teaching cluster.1');
    expect(container.querySelector('.specimen-quote mark').textContent).toBe("We built a self-service GPU job runner for the department's machine learning teaching cluster.");
    expect(screen.getByText('Illustrative notes — not your submitted evidence')).toBeTruthy();
    expect(screen.getByText('You are on step 1 of 6. Writing starts at step 4.')).toBeTruthy();
    expect(container.querySelectorAll('button')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Go to step 1: Notes' }));
    expect(onGo).toHaveBeenCalled();
  });

  it('says the letter’s length is a guide, and offers no button once writing is next', () => {
    const { container } = render(<DocSpecimen docId="letter" title="Cover letter" company="Graphcore" wordLimit={400} limitSource="guide" step={4} onGo={null} />);
    expect(screen.getByText('Not written yet · about 400 words (a guide; the form sets no limit)')).toBeTruthy();
    expect(screen.getByText('This becomes your cover letter. Each factual claim will cite a fact you confirmed, like this:')).toBeTruthy();
    expect(screen.getByText('Step 4 of 6: the button below writes both documents.')).toBeTruthy();
    expect(container.querySelector('button')).toBeNull();
  });
});
