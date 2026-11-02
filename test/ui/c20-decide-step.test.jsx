// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { primaryAction } from '../../client/src/flow.js';
import { StepGuide } from '../../client/src/components/StepGuide.jsx';
import { GuidedBody } from '../../client/src/components/GuidedBody.jsx';
import { GuidedRun, guidedStep } from '../../client/src/components/GuidedRun.jsx';

afterEach(cleanup);

describe('c20 decide step', () => {
  it('primaryAction for decide returns the hint with id null', () => {
    expect(primaryAction({ next: 'decide' }, {})).toEqual({ id: null, hint: 'Now: decide on the earlier fact your answer was about.', show: 'decide' });
  });

  it('StepGuide with decide makes the Question step current', () => {
    const ws = { applicant: { sources: [], facts: [] }, application: { form: { documents: [] }, questions: [], repair: null } };
    const { container } = render(<StepGuide view={{ next: 'decide' }} workspace={ws} />);
    expect(container.querySelector('[aria-current="step"]')?.textContent || '').toMatch(/Question/i);
  });

  it('the walk-through opens the decide step inside step 3', () => {
    const ws = { applicant: { sources: [], facts: [] }, application: { questions: [], repair: null, documents: {} } };
    expect(guidedStep({ next: 'decide' }, ws)).toEqual({ n: 3, key: 'decide' });
  });

  it('the walk-through heads the decide step with its own question', () => {
    const ws = { applicant: { sources: [], facts: [] }, application: { questions: [], repair: null, documents: {}, form: { documents: [] } } };
    render(<GuidedRun view={{ next: 'decide', conflictDecisions: [] }} workspace={ws} story={null} sampleName="Ellie" possessive="her" />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Is this earlier fact still right?');
  });

  it('GuidedBody decide shows quote and settle calls spy', () => {
    const onSettleConflict = vi.fn();
    const decisions = [{ questionId: 'q1', factId: 'f1', quote: 'I restored the booking server myself' }];
    const view = { next: 'decide', conflictDecisions: decisions };
    const workspace = { applicant: { facts: [] }, application: { repair: null, documents: {}, form: { documents: [] } } };
    const handlers = { onSettleConflict };
    render(<GuidedBody stepKey="decide" workspace={workspace} view={view} busy={null} handlers={handlers} sample={{ name: 'Ellie' }} possessive="her" />);
    expect(screen.getByText('“I restored the booking server myself”')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(onSettleConflict).toHaveBeenCalledWith('q1', 'f1', 'keep');
  });
});
