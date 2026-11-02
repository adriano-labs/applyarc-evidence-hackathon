// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChangeQueue } from '../../client/src/components/ChangeQueue.jsx';

afterEach(cleanup);

const repair = {
  factId: 'f3', status: 'review',
  items: [
    { id: 'c1', docId: 'answer', segmentId: 'answer-8', before: 'I wrote the Helm change.', after: 'Sam wrote the Helm change.', status: 'proposed', decision: null },
    { id: 'c2', docId: 'letter', segmentId: 'letter-4', before: 'I wrote the fix, in three days.', after: 'I tested the fix Sam wrote.', status: 'conflict', decision: null },
  ],
};
const fact = { id: 'f3', statement: 'Sam wrote the Helm change; I tested it.', history: [{ statement: 'I wrote the Helm change.' }] };
const base = { repair, fact, number: 3, docTitles: { answer: 'Project answer', letter: 'Cover letter' }, busy: false, untouchedCount: 11, onDecide: vi.fn(), onApply: vi.fn() };

describe('ChangeQueue focus cursor', () => {
  it('makes the focused item the cursor so y/n act on it', () => {
    const onDecide = vi.fn();
    const { container } = render(<ChangeQueue {...base} onDecide={onDecide} />);
    const items = container.querySelectorAll('.queue-item');
    fireEvent.focus(items[1]);
    const queue = container.querySelector('.queue');
    fireEvent.keyDown(queue, { key: 'y' });
    expect(onDecide).toHaveBeenLastCalledWith('c2', 'take');
    fireEvent.focus(items[0]);
    fireEvent.keyDown(queue, { key: 'n' });
    expect(onDecide).toHaveBeenLastCalledWith('c1', 'keep');
  });
});
