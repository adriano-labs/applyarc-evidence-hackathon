// @vitest-environment jsdom
// The walk-through never says something the workspace has not done: while the app checks
// what the form needs it does not claim a gap yet, and reading her answer stays on step 3.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GuidedRun, guidedStep } from '../../client/src/components/GuidedRun.jsx';

afterEach(cleanup);

const ws = (sources = []) => ({ applicant: { sources, facts: [] }, application: { questions: [] } });
const notes = { id: 's1', kind: 'notes', text: 'Notes.', read: true };

describe('the step while the app works', () => {
  it('stays on step 3 while it reads her answer, instead of going back to the notes', () => {
    expect(guidedStep({ next: 'read' }, ws([notes, { id: 's2', kind: 'answer', text: 'I built it.', read: false }]), null)).toEqual({ n: 3, key: 'question' });
    expect(guidedStep({ next: 'read' }, ws([{ ...notes, read: false }]), null)).toEqual({ n: 1, key: 'notes' });
  });

  it('says it is checking, not that something is missing, until a question exists', () => {
    expect(guidedStep({ next: 'check' }, ws([notes]), null)).toEqual({ n: 3, key: 'check' });
    render(<GuidedRun view={{ next: 'check' }} workspace={ws([notes])} story={null} sampleName="Marcus" possessive="his" onPrimary={vi.fn()} onStory={vi.fn()} onExit={vi.fn()} onReview={vi.fn()}><p>body</p></GuidedRun>);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Checking what the form still needs');
    expect(screen.getByText('The app compares his facts with what the form asks for, and asks only if something is missing.')).toBeTruthy();
    expect(screen.getByText('Step 3 of 4')).toBeTruthy();
  });

  it('puts its main button away while the step runs, so a second click cannot start it again', () => {
    const { rerender } = render(<GuidedRun view={{ next: 'draft' }} workspace={ws([notes])} story={null} sampleName="Ellie" possessive="her" busy={{ name: 'draft' }} onPrimary={vi.fn()} onStory={vi.fn()} onExit={vi.fn()} onReview={vi.fn()}><p>body</p></GuidedRun>);
    expect(screen.queryByRole('button', { name: 'Write her answer' })).toBeNull();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Writing her application');
    rerender(<GuidedRun view={{ next: 'draft' }} workspace={ws([notes])} story={null} sampleName="Ellie" possessive="her" busy={null} onPrimary={vi.fn()} onStory={vi.fn()} onExit={vi.fn()} onReview={vi.fn()}><p>body</p></GuidedRun>);
    expect(screen.getByRole('button', { name: 'Write her answer' }).disabled).toBe(false);
  });
});
