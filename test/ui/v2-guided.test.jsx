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
  it('walks the five steps from the workspace state', () => {
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
    expect(screen.getByText('Step 2 of 5')).toBeTruthy();
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
    fireEvent.click(screen.getByRole('button', { name: 'Next: change a fact' }));
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
});
