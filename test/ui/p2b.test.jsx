// @vitest-environment jsdom
// Review round P2b: the manuscript and the shared styles.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fromRoot } from '../../server/paths.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DocumentView } from '../../client/src/components/DocumentView.jsx';

afterEach(cleanup);

const doc = { id: 'answer', revision: 1, segments: [
  { id: 'answer-1', kind: 'claim', text: 'Four of us built a GPU job runner.', factIds: ['f1', 'f2'], startsParagraph: true, author: 'draft' },
  { id: 'answer-2', kind: 'claim', text: 'I wrote the Helm change.', factIds: ['f3'], startsParagraph: false, author: 'draft' },
] };
const base = { title: 'Project answer', doc, citations: { f1: 1, f2: 2, f3: 3 }, approval: 'none', stats: { words: 12, wordLimit: 300, overLimit: false }, limitSource: 'form', locked: false, activeFactId: null, changedSegmentIds: [], pendingSegmentIds: [], onCite: vi.fn(), onEdit: vi.fn(async () => {}), onApprove: vi.fn() };

describe('P2b', () => {
  it('opens the editor when the sentence itself is clicked', () => {
    const { container } = render(<DocumentView {...base} />);
    // The last word sits in .cite-anchor with its citations, so click the sentence's text element itself.
    fireEvent.click(container.querySelector('[data-segment="answer-2"] .sentence-text'));
    expect(screen.getByLabelText('Edit sentence').value).toBe('I wrote the Helm change.');
  });

  it('keeps the last word and its citations together so a number never wraps alone', () => {
    const { container } = render(<DocumentView {...base} />);
    const anchor = container.querySelector('[data-segment="answer-1"] .cite-anchor');
    expect(anchor.textContent).toBe('runner.12');
  });

  it('marks sentences with a change waiting for review', () => {
    const { container } = render(<DocumentView {...base} pendingSegmentIds={['answer-2']} locked />);
    expect(container.querySelector('[data-segment="answer-2"]').className).toContain('pending');
    expect(screen.getByText('change proposed')).toBeTruthy();
  });

  it('styles buttons in one shared sheet, not in each component', () => {
    const dir = fromRoot('client', 'src', 'components');
    const offenders = readdirSync(dir).filter((f) => f.endsWith('.css')).filter((f) => /(^|[\s,}])\.btn\b/m.test(readFileSync(join(dir, f), 'utf8')));
    expect(offenders).toEqual([]);
    const shared = readFileSync(fromRoot('client', 'src', 'styles', 'buttons.css'), 'utf8');
    for (const selector of ['.btn', '.btn.primary', '.btn.small', '.btn.big', '.btn.link', '[aria-pressed="true"]', ':disabled']) expect(shared).toContain(selector);
    expect(readFileSync(fromRoot('client', 'src', 'main.jsx'), 'utf8')).toContain("import './styles/buttons.css';");
  });
});

describe('P2b review fixes', () => {
  it('does not open the editor when a citation number is clicked', () => {
    render(<DocumentView {...base} />);
    fireEvent.click(screen.getByRole('button', { name: 'Evidence 3' }));
    expect(screen.queryByLabelText('Edit sentence')).toBeNull();
  });

  it('renders a one-word claim once', () => {
    const one = { ...doc, segments: [{ id: 'answer-9', kind: 'claim', text: 'Yes.', factIds: ['f1'], startsParagraph: true, author: 'draft' }] };
    const { container } = render(<DocumentView {...base} doc={one} locked />);
    expect(container.querySelector('.para').textContent).toBe('Yes.1');
  });
});
