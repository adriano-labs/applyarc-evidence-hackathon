// @vitest-environment jsdom
// V2-2: the guided walk-through. One step on the screen at a time, a plain
// headline, one main button, and a way out to the full workspace.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GuidedRun, guidedStep } from '../../client/src/components/GuidedRun.jsx';

afterEach(cleanup);

const fact = (id, status, sourceId = 's1') => ({ id, status, sourceId, statement: id, quote: id });
const ws = (over = {}) => ({
  applicant: { sources: [{ id: 's1', kind: 'notes', text: 'Notes.', read: true }], facts: [], ...over.applicant },
  application: { form: { company: 'Graphcore', documents: [] }, documents: {}, questions: [], repair: null, ...over.application },
});

describe('guidedStep', () => {
  it('preserves the internal states for four guided stages, optional correction and finish', () => {
    expect(guidedStep({ next: 'read' }, ws(), null)).toEqual({ n: 1, key: 'notes' });
    expect(guidedStep({ next: 'facts' }, ws({ applicant: { facts: [fact('a', 'proposed')] } }), null)).toEqual({ n: 2, key: 'facts' });
    expect(guidedStep({ next: 'question' }, ws(), null)).toEqual({ n: 3, key: 'question' });
    expect(guidedStep({ next: 'draft' }, ws(), null)).toEqual({ n: 3, key: 'draft' });
    expect(guidedStep({ next: 'approve' }, ws(), null)).toEqual({ n: 4, key: 'answer' });
    expect(guidedStep({ next: 'approve' }, ws(), 'change')).toEqual({ n: 5, key: 'change' });
    expect(guidedStep({ next: 'repair' }, ws({ application: { repair: { items: [] } } }), null)).toEqual({ n: 5, key: 'change' });
    expect(guidedStep({ next: 'export' }, ws(), null)).toEqual({ n: 5, key: 'finish' });
    expect(guidedStep({ next: 'export' }, ws(), 'change')).toEqual({ n: 5, key: 'finish' });
  });

  it('keeps facts from her answer inside the question step', () => {
    const answerFacts = ws({ applicant: { sources: [{ id: 's1', kind: 'notes', read: true }, { id: 's2', kind: 'answer', read: true }], facts: [fact('a', 'confirmed'), fact('b', 'proposed', 's2')] } });
    expect(guidedStep({ next: 'facts' }, answerFacts, null)).toEqual({ n: 3, key: 'question' });
  });
});

describe('GuidedRun', () => {
  const props = (over = {}) => ({ view: { next: 'facts' }, workspace: ws({ applicant: { facts: [fact('a', 'proposed'), fact('b', 'proposed'), fact('c', 'proposed')] } }), story: null, sampleName: 'Ellie', isMeta: true, onPrimary: vi.fn(), onStory: vi.fn(), onExit: vi.fn(), children: <p>step body</p>, ...over });

  it('shows where you are, what is happening in plain words, and the step itself', () => {
    render(<GuidedRun {...props()} />);
    expect(screen.getByText('Step 2 of 4')).toBeTruthy();
    expect(within(screen.getByRole('list', { name: 'Steps' })).getByText('Facts').closest('[aria-current="step"]')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Meta found 3 facts in Ellie’s own words');
    expect(screen.getByText('Check each one is right. Only facts you confirm can be used in her answer.')).toBeTruthy();
    expect(screen.getByText('step body')).toBeTruthy();
  });

  it('offers one main button where the step needs one, and a way out to the full workspace', () => {
    const onPrimary = vi.fn();
    const onStory = vi.fn();
    const onExit = vi.fn();
    const { rerender } = render(<GuidedRun {...props({ view: { next: 'draft' }, onPrimary, onStory, onExit })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Write her answer' }));
    expect(onPrimary).toHaveBeenCalledWith({ id: 'draft', label: 'Write both documents' });
    rerender(<GuidedRun {...props({ view: { next: 'approve' }, onPrimary, onStory, onExit })} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Her answer, with evidence beside it');
    // The key moment leads; review and finish stays one click away.
    expect(screen.getByRole('button', { name: 'Next: correct one fact' }).classList.contains('primary')).toBe(true);
    expect(screen.getByRole('button', { name: 'Review and finish' }).classList.contains('primary')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Review and finish' }));
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(onStory).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Next: correct one fact' }));
    expect(onStory).toHaveBeenCalledWith('change');
    fireEvent.click(screen.getByRole('button', { name: 'Open the full workspace' }));
    expect(onExit).toHaveBeenCalled();
  });

  it('credits Meta only when Meta ran: the hand-written examples say "Found"', () => {
    render(<GuidedRun {...props({ isMeta: false })} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Found 3 facts in Ellie’s own words');
  });

  it('says the application is being written after the action starts', () => {
    render(<GuidedRun {...props({ view: { next: 'draft' }, busy: { name: 'draft' } })} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Writing her application');
    expect(screen.queryByText('Ready to write her answer')).toBeNull();
  });

  it('has no main button while the step is the applicant’s to do in the body', () => {
    render(<GuidedRun {...props()} />);
    expect(screen.queryAllByRole('button').map((b) => b.textContent)).toEqual(['Back', 'Open the full workspace', 'Notes']);
  });

  it('sets expectations on the notes step only: Meta on a live run, the fixture named as the fixture', () => {
    const { rerender } = render(<GuidedRun {...props({ view: { next: 'read' } })} />);
    expect(screen.getByText('About five minutes on the live model: Meta’s agents read, ask, write, check and repair, and you decide every step. Watch each step in “What Meta did” below.')).toBeTruthy();
    rerender(<GuidedRun {...props({ view: { next: 'read' }, isMeta: false })} />);
    expect(screen.getByText('Hand-written fixture, not a live model: the same steps run from stored outputs, and you decide every one. Watch each step in “What the model did” below.')).toBeTruthy();
    rerender(<GuidedRun {...props()} />);
    expect(screen.queryByText(/Watch each step/)).toBeNull();
  });

  it('says what the correction will do, naming what drafted the documents from the receipts', () => {
    const draft = { step: 'draft', flow: 'draft', provider: 'meta', isMeta: true, model: 'muse-wonder-1.0', docId: 'answer', costUsd: 0.1, toolCalls: [] };
    const { rerender } = render(<GuidedRun {...props({ view: { next: 'approve' }, story: 'change', receipts: [draft] })} />);
    expect(screen.getByText('Correct one fact. Only the sentences that cite it reopen; Wonder proposes each rewrite and its own review checks them. Nothing else changes, and you decide each one.')).toBeTruthy();
    rerender(<GuidedRun {...props({ view: { next: 'approve' }, story: 'change', receipts: [] })} />);
    expect(screen.getByText(/Meta proposes each rewrite/)).toBeTruthy();
    rerender(<GuidedRun {...props({ view: { next: 'approve' }, story: 'change', isMeta: false, receipts: [{ ...draft, provider: 'fixture', isMeta: false, model: 'fixture' }] })} />);
    expect(screen.getByText('Correct one fact. Only the sentences that cite it reopen; the fixture stands in with hand-written rewrites. Nothing else changes, and you decide each one.')).toBeTruthy();
    expect(screen.queryByText(/its own review/)).toBeNull();
  });
});


describe('four guided stages and the key moment', () => {
  const props = (over = {}) => ({ view: { next: 'read' }, workspace: ws(), story: null, sampleName: 'Ellie', onPrimary: vi.fn(), onStory: vi.fn(), onReview: vi.fn(), onExit: vi.fn(), children: <p>step body</p>, ...over });

  it('numbers only the four core stages and marks the correction as the key moment, not an option', () => {
    render(<GuidedRun {...props()} />);
    expect(screen.getByText('Step 1 of 4')).toBeTruthy();
    const items = within(screen.getByRole('list', { name: 'Steps' })).getAllByRole('listitem');
    expect(items).toHaveLength(5);
    expect(items.slice(0, 4).map((item) => item.querySelector('.guided-step-mark').textContent)).toEqual(['1', '2', '3', '4']);
    expect(items[4].textContent).toMatch(/Correct a fact.*Key moment/);
    expect(items[4].querySelector('.guided-step-tag').textContent).toBe('Key moment');
    expect(items[4].textContent).not.toMatch(/5|Optional/i);
  });

  it('does not promise that the missing detail will take exactly one question', () => {
    render(<GuidedRun {...props({ view: { next: 'question' } })} />);
    expect(screen.getByText('The form asks what she did herself, so the app asks for the missing detail.')).toBeTruthy();
    expect(screen.queryByText(/asks her once/)).toBeNull();
  });

  it('names a live correction as the key moment without presenting it as step five', () => {
    render(<GuidedRun {...props({ view: { next: 'approve' }, story: 'change' })} />);
    expect(screen.getByText('Key moment: correct a fact')).toBeTruthy();
    expect(screen.queryByText(/Step 5 of/)).toBeNull();
    expect(within(screen.getByRole('list', { name: 'Steps' })).getByText('Correct a fact').closest('[aria-current="step"]')).toBeTruthy();
  });

  it.each([null, { factId: 'f1', changed: 1 }])('keeps correction history available at the finish, but marks it complete only with a saved repair: %j', (lastRepair) => {
    const onReview = vi.fn();
    render(<GuidedRun {...props({ view: { next: 'export' }, workspace: ws({ application: { lastRepair } }), onReview })} />);
    expect(screen.getByText('Ready to export')).toBeTruthy();
    expect(screen.queryByText('All 5 steps done')).toBeNull();
    const change = within(screen.getByRole('list', { name: 'Steps' })).getByRole('button', { name: /Correct a fact.*Key moment/ });
    expect(change.classList.contains('done')).toBe(Boolean(lastRepair));
    fireEvent.click(change);
    expect(onReview).toHaveBeenCalledWith(5);
  });

  it('returns to the correction from the document look-back without changing approval', () => {
    const onReview = vi.fn(), onPrimary = vi.fn();
    render(<GuidedRun {...props({ view: { next: 'approve' }, story: 'change', reviewStep: 4, onReview, onPrimary })} />);
    expect(screen.getByText('Looking back at step 4 of 4')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Return to correction' }));
    expect(onReview).toHaveBeenCalledWith(null);
    expect(onPrimary).not.toHaveBeenCalled();
  });

  it('returns to the live correction when its nav item is chosen during look-back', () => {
    const onReview = vi.fn();
    render(<GuidedRun {...props({ view: { next: 'approve' }, story: 'change', reviewStep: 2, onReview })} />);
    fireEvent.click(within(screen.getByRole('list', { name: 'Steps' })).getByRole('button', { name: /Correct a fact.*Key moment/ }));
    expect(onReview).toHaveBeenCalledWith(null);
  });

  it('names the key moment when paging forward through finished history', () => {
    const onReview = vi.fn();
    render(<GuidedRun {...props({ view: { next: 'export' }, reviewStep: 4, onReview })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next: Correct a fact' }));
    expect(onReview).toHaveBeenCalledWith(5);
  });

  it('labels the look back at the correction and preserves returning to finish', () => {
    const onReview = vi.fn();
    render(<GuidedRun {...props({ view: { next: 'export' }, reviewStep: 5, onReview })} />);
    expect(screen.getByText('Looking back: the correction')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Return to the finish' }));
    expect(onReview).toHaveBeenCalledWith(null);
  });
});
