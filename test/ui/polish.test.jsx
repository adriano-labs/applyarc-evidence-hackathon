// @vitest-environment jsdom
// Review findings from the first UI round, each pinned by a test.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FactsReview } from '../../client/src/components/FactsReview.jsx';
import { QuestionCard } from '../../client/src/components/QuestionCard.jsx';
import { References } from '../../client/src/components/References.jsx';

afterEach(cleanup);

describe('review fixes', () => {
  it('FactsReview: Enter on a focused button makes one decision, not two', () => {
    const onDecide = vi.fn();
    const facts = [
      { id: 'f1', statement: 'One.', quote: 'one', sourceId: 's1', status: 'proposed', requirementIds: [] },
      { id: 'f2', statement: 'Two.', quote: 'two', sourceId: 's1', status: 'proposed', requirementIds: [] },
    ];
    render(<FactsReview facts={facts} total={2} sources={{ s1: 'notes' }} requirementNames={{}} onDecide={onDecide} onHover={vi.fn()} onConfirmRest={vi.fn()} busy={false} />);
    const notRight = screen.getByRole('button', { name: 'Not right' });
    fireEvent.keyDown(notRight, { key: 'Enter' });
    expect(onDecide).not.toHaveBeenCalled();
  });

  it('References: the correction form closes once it is saved', async () => {
    const onCorrect = vi.fn().mockResolvedValue({ workspace: {} });
    const facts = [{ id: 'f1', statement: 'I wrote it.', quote: 'I wrote it.', sourceId: 's1', status: 'confirmed' }];
    render(<References facts={facts} citations={{ f1: 1 }} sources={{ s1: 'notes' }} activeFactId={null} locked={false} onCorrect={onCorrect} onHover={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Correct this fact' }));
    fireEvent.change(screen.getByLabelText('The fact, in your words'), { target: { value: 'Sam wrote it.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save the correction' }));
    expect(onCorrect).toHaveBeenCalledWith('f1', 'Sam wrote it.');
    await waitFor(() => expect(screen.queryByLabelText('The fact, in your words')).toBeNull());
  });

  it('QuestionCard: the keyboard shortcut does nothing while a step runs', () => {
    const onAnswer = vi.fn();
    render(<QuestionCard question={{ id: 'q1', requirementId: 'r', text: 'What?', why: 'Why.' }} requirementText="R" onAnswer={onAnswer} onSkip={vi.fn()} busy sample={null} />);
    const box = screen.getByLabelText('Your answer');
    fireEvent.change(box, { target: { value: 'An answer.' } });
    fireEvent.keyDown(box, { key: 'Enter', ctrlKey: true });
    expect(onAnswer).not.toHaveBeenCalled();
  });
});
