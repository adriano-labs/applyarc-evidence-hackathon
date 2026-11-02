// @vitest-environment jsdom
// The employer's form as a brief: one line until asked for, then the whole
// question and what it asks for, each requirement linked to its references.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FormPanel } from '../../client/src/components/FormPanel.jsx';

afterEach(cleanup);

const formDoc = {
  id: 'answer', title: 'Project answer', wordLimit: 300, limitSource: 'form',
  question: 'Tell us about a technical system or project you built.\n\nIn your response, briefly explain:\n- What you were trying to achieve.',
};
const coverage = [
  { id: 'goal', text: 'What you were trying to achieve', personal: false, factIds: ['f1', 'f2'], covered: true },
  { id: 'contribution', text: 'Your individual contribution, if you worked as part of a team', personal: true, factIds: [], covered: false },
  { id: 'decision', text: 'One technical decision you made and why', personal: false, factIds: [], covered: false },
  { id: 'problem', text: 'One problem you encountered', personal: false, factIds: [], covered: false },
];
const base = {
  company: 'Graphcore', formDoc, coverage, questions: [{ id: 'q2', requirementId: 'decision', status: 'skipped' }],
  citations: { f1: 1, f2: 4 }, activeFactId: null, onCite: vi.fn(),
  portalTasks: Array.from({ length: 12 }, (_, i) => `Task ${i + 1}`),
  snapshot: { fetchedAt: '2026-10-26T22:41:53Z', url: 'https://job-boards.greenhouse.io/graphcore/jobs/8894977002' },
};
const view = (props = {}) => render(<FormPanel {...base} {...props} />);
const toggle = () => screen.getByRole('button', { name: /the question$/ });

describe('FormPanel, the brief', () => {
  it('sums the form up in one line, collapsed at first', () => {
    const { container } = view();
    expect(container.querySelector('.brief-summary').textContent).toBe('Graphcore · project answer, up to 300 words · 1 of 4 covered');
    expect(toggle().textContent).toBe('Show the question');
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('.form-panel').getAttribute('data-open')).toBe('false');
  });

  it('says what is being asked while a question is open', () => {
    const { container } = view({ questions: [{ id: 'q1', requirementId: 'contribution', status: 'open' }] });
    expect(container.querySelector('.brief-summary').textContent).toBe('Graphcore · project answer, up to 300 words · Asking you: your individual contribution, if you worked as part of a team');
  });

  it('calls a guide limit a guide', () => {
    const { container } = view({ formDoc: { ...formDoc, id: 'letter', title: 'Cover letter', wordLimit: 400, limitSource: 'guide' }, coverage: coverage.slice(0, 1) });
    expect(container.querySelector('.brief-summary').textContent).toBe('Graphcore · cover letter, about 400 words (a guide) · 1 of 1 covered');
  });

  it('opens in place to the whole question and what it asks for', () => {
    const { container } = view();
    fireEvent.click(toggle());
    expect(toggle().textContent).toBe('Hide the question');
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('.form-panel').getAttribute('data-open')).toBe('true');
    expect(screen.getByRole('heading', { name: 'What Graphcore asks' })).toBeTruthy();
    expect(container.querySelector('.form-question').textContent).toBe(formDoc.question);
    expect(screen.getByRole('heading', { name: 'What it asks for' })).toBeTruthy();
  });

  it('says a requirement’s state only when it needs saying, never by colour alone', () => {
    const { container } = view();
    const rows = [...container.querySelectorAll('.req')];
    expect(rows.map((r) => r.getAttribute('data-state'))).toEqual(['covered', 'missing', 'skipped', 'missing']);
    expect(rows[0].querySelector('.req-state')).toBeNull();
    expect(rows[1].querySelector('.visually-hidden').textContent).toBe('not covered yet');
    expect(rows[2].querySelector('.req-state').textContent).toBe('Left out');
    const asked = view({ questions: [{ id: 'q1', requirementId: 'contribution', status: 'open' }] });
    expect(asked.container.querySelector('.req[data-state="asked"] .req-state').textContent).toBe('Asked you');
  });

  it('links a covered requirement to its references, both ways', () => {
    const onCite = vi.fn();
    view({ onCite });
    const four = screen.getByRole('button', { name: 'Evidence 4' });
    fireEvent.mouseEnter(four);
    expect(onCite).toHaveBeenLastCalledWith('f2');
    fireEvent.mouseLeave(four);
    expect(onCite).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole('button', { name: 'Evidence 1' })).toBeTruthy();
  });

  it('leaves the word count and the portal checklist to the document and the export', () => {
    const { container } = view();
    expect(screen.queryByRole('meter')).toBeNull();
    expect(container.querySelector('.portal-tasks')).toBeNull();
    expect(container.querySelector('.brief-portal').textContent).toBe('12 things to do on the employer’s site are listed in your export.');
    expect(screen.queryByText(/Graduate Cloud Platform Engineer/)).toBeNull();
  });

  it('names the dated public source of the form', () => {
    view();
    const link = screen.getByRole('link', { name: 'Graphcore form, snapshot of 26 Oct 2026' });
    expect(link.getAttribute('href')).toBe(base.snapshot.url);
  });
});
