// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChangeQueue } from '../../client/src/components/ChangeQueue.jsx';
import { References } from '../../client/src/components/References.jsx';

afterEach(cleanup);

const waiting = {
  factId: 'f3', status: 'awaiting-proposal',
  items: [
    { id: 'c1', docId: 'answer', segmentId: 'answer-8', before: 'I wrote the Helm change.', after: null, status: 'pending', decision: null },
    { id: 'c2', docId: 'letter', segmentId: 'letter-4', before: 'I wrote the fix, in three days.', after: null, status: 'conflict', decision: null },
  ],
};
const fact = { id: 'f3', statement: 'Sam wrote the Helm change; I tested it.', history: [{ statement: 'I wrote the Helm change.' }] };
const queue = (props = {}) => render(<ChangeQueue repair={waiting} fact={fact} number={3} docTitles={{ answer: 'Project answer', letter: 'Cover letter' }} busy={false} onDecide={vi.fn()} onApply={vi.fn()} onPropose={vi.fn()} onCancel={vi.fn()} {...props} />);

describe('J6: a correction you can trust', () => {
  it('waits honestly for the rewrite: no choices yet, and a way to ask again', () => {
    const onPropose = vi.fn();
    queue({ onPropose });
    expect(screen.getByRole('status').textContent).toBe('Correcting [3] reopens the 2 sentences that cite it. Waiting for the rewrite.');
    for (const name of ['Take the rewrite', 'Keep as is', 'Keep mine', 'Write my own']) expect(screen.queryByRole('button', { name })).toBeNull();
    expect(screen.queryByText('No rewrite proposed: keep it or write your own.')).toBeNull();
    expect(screen.getByText('The rewrite has not arrived yet.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Propose the changes' }));
    expect(onPropose).toHaveBeenCalled();
  });

  it('shows only the progress line while the rewrite is being written', () => {
    queue({ busy: { name: 'repair' } });
    expect(screen.getByText('Rewriting the sentences that cite this fact…')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Propose the changes' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Undo this correction' }).disabled).toBe(true);
  });

  it('lets the applicant undo the correction', () => {
    const onCancel = vi.fn();
    queue({ onCancel });
    fireEvent.click(screen.getByRole('button', { name: 'Undo this correction' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('offers the sample correction on the fact it was written for', () => {
    const sample = { name: 'Ellie', correction: { quote: 'I wrote the Helm change.', text: 'My teammate Sam wrote the Helm change; I tested it on two of the lab nodes.' } };
    const facts = [
      { id: 'f1', statement: 'Redis held the queue.', quote: 'Redis for the queue', sourceId: 's1', status: 'confirmed' },
      { id: 'f2', statement: 'I wrote the Helm change.', quote: 'I wrote the Helm change.', sourceId: 's2', status: 'confirmed' },
    ];
    render(<References facts={facts} citations={{ f2: 1, f1: 2 }} sources={{ s1: 'notes', s2: 'answer' }} activeFactId={null} locked={false} onCorrect={vi.fn()} onHover={vi.fn()} sample={sample} />);
    const [first, second] = screen.getAllByRole('button', { name: 'Correct this fact' });
    fireEvent.click(second);
    expect(screen.queryByRole('button', { name: 'Use Ellie’s sample correction' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(first);
    fireEvent.click(screen.getByRole('button', { name: 'Use Ellie’s sample correction' }));
    expect(screen.getByLabelText('The fact, in your words').value).toBe(sample.correction.text);
  });
});
