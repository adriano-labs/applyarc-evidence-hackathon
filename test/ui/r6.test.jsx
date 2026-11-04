// @vitest-environment jsdom
// R6: a document you can read and check at a glance.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DocumentView } from '../../client/src/components/DocumentView.jsx';

afterEach(cleanup);

const claim = (id, factIds, author = 'draft') => ({ id, kind: 'claim', text: `Claim ${id}.`, factIds, startsParagraph: false, author });
const frame = (id) => ({ id, kind: 'frame', text: `Frame ${id}.`, factIds: [], startsParagraph: true, author: 'draft' });
const doc = { id: 'letter', revision: 1, segments: [frame('l1'), claim('l2', ['f1']), claim('l3', ['f2']), claim('l4', ['f3'], 'user'), claim('l5', ['f2', 'f3']), frame('l6')] };
const fixture = { id: 'fixture', label: 'Fixture', model: 'hand-written', isMeta: false };
const base = {
  title: 'Cover letter', doc, citations: { f1: 1, f2: 2, f3: 3 }, approval: 'none',
  stats: { words: 206, wordLimit: 400, overLimit: false }, limitSource: 'form', locked: false,
  activeFactId: null, changedSegmentIds: [], onCite: vi.fn(), onEdit: vi.fn(async () => {}),
  receipts: [], mode: fixture, onReceipts: vi.fn(), onPin: vi.fn(), hintSeen: false,
};
const view = (props = {}) => render(<DocumentView {...base} {...props} />);
const stamp = () => document.querySelector('.manuscript-stamp');

describe('R6 the manuscript head', () => {
  it('says what the citations establish, counting the applicant’s own sentences and the frame lines apart', () => {
    view();
    expect(document.querySelector('.manuscript-evidence').textContent).toBe('3 statements, each citing a fact you confirmed · 1 sentence in your own words · 2 greeting or sign-off lines');
    cleanup();
    view({ doc: { ...doc, segments: [claim('a1', ['f1'])] } });
    expect(document.querySelector('.manuscript-evidence').textContent).toBe('1 statement, citing a fact you confirmed');
  });

  it('keeps the version and word count on one line with a stamp that opens the receipts', () => {
    const onReceipts = vi.fn();
    view({ onReceipts });
    expect(screen.getByText('Version 1 · 206 of 400 words')).toBeTruthy();
    expect(stamp().textContent).toBe('Fixture, not a model ›');
    expect(stamp().getAttribute('aria-label')).toBe('Hand-written fixture, not a model · What the model did');
    fireEvent.click(stamp());
    expect(onReceipts).toHaveBeenCalled();
  });

  it('names the model that drafted the document, and never says Meta for another firm’s model', () => {
    const meta = { id: 'meta', label: 'Meta Muse Spark 1.3', model: 'muse-spark-1.3', isMeta: true };
    view({ mode: meta, receipts: [{ flow: 'read', model: 'other' }, { flow: 'draft', model: 'muse-spark-1.3' }] });
    expect(stamp().textContent).toBe('Muse Spark · Activity ›');
    expect(stamp().getAttribute('aria-label')).toBe('Drafted by muse-spark-1.3 · What Meta did');
    cleanup();
    view({ mode: meta, receipts: [{ flow: 'draft', model: 'meta-models/muse-spark-open-1026' }] });
    expect(stamp().textContent).toBe('Muse Spark Open · Activity ›');
    expect(stamp().getAttribute('aria-label')).toBe('Drafted by meta-models/muse-spark-open-1026 · What Meta did');
    cleanup();
    view({ mode: { id: 'other', label: 'Another model', model: 'other-model', isMeta: false } });
    expect(stamp().textContent).toBe('other-model (not Meta) ›');
    expect(stamp().getAttribute('aria-label')).toBe('Drafted by other-model (not Meta) · What the model did');
  });

  it('teaches the citations once, until they have been used', () => {
    const { rerender } = view();
    expect(screen.getByText('Point at a number to see the words it came from; click it to keep it lit. Click a sentence to edit it.')).toBeTruthy();
    rerender(<DocumentView {...base} hintSeen />);
    expect(screen.queryByText(/Point at a number/)).toBeNull();
  });
});

describe('R6 citations you can pin', () => {
  it('pins a fact when its number is clicked', () => {
    const onPin = vi.fn();
    view({ onPin });
    fireEvent.click(screen.getAllByRole('button', { name: 'Evidence 2' })[0]);
    expect(onPin.mock.calls[0][0]).toBe('f2'); // the second argument is the sentence's segment id
  });

  it('lights every sentence that cites the shown fact', () => {
    const { container } = view({ activeFactId: 'f3' });
    const lit = [...container.querySelectorAll('[data-cites-active="true"]')].map((el) => el.dataset.segment);
    expect(lit).toEqual(['l4', 'l5']);
  });

  it('has no approve button of its own', () => {
    view();
    expect(screen.queryByRole('button', { name: /^Approve/ })).toBeNull();
  });
});

describe('R6 the pin is wired', () => {
  it('hands the pin and the hint state to the App', async () => {
    const { renderHook } = await import('@testing-library/react');
    const { useAppState } = await import('../../client/src/useAppState.js');
    const { result } = renderHook(() => useAppState({ data: null, setNotice: () => {}, reset: async () => {} }));
    for (const name of ['setPinnedFactId', 'setHintSeen']) expect(typeof result.current[name]).toBe('function');
    expect(result.current.pinnedFactId).toBeNull();
    expect(result.current.hintSeen).toBe(false);
  });
});
