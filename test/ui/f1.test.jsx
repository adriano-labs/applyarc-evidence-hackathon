// @vitest-environment jsdom
// Finish review F1: a readable change preview and one clear choice per change.
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChangeQueue } from '../../client/src/components/ChangeQueue.jsx';

afterEach(cleanup);

const fact = { id: 'f3', statement: 'New.', history: [{ statement: 'Old.' }] };
const queue = (items) => render(<ChangeQueue repair={{ factId: 'f3', status: 'review', items }} fact={fact} number={3} docTitles={{ answer: 'Project answer', letter: 'Cover letter' }} busy={false} onDecide={vi.fn()} onApply={vi.fn()} />);

describe('F1', () => {
  it('shows each change as two complete passages with explicit labels', () => {
    const before = 'When jobs started dying in week 9, I traced the failures through dmesg and wrote the Helm change that fixed them.';
    const after = 'When jobs started dying in week 9, I diagnosed it, then tested the fix my teammate Sam wrote.';
    const { container } = queue([{ id: 'c1', docId: 'letter', segmentId: 'l4', before, after, status: 'proposed', decision: null }]);
    expect(container.querySelector('.queue-was .queue-line-label').textContent).toBe('Current wording');
    expect(container.querySelector('.queue-was .queue-line-text').textContent).toBe(before);
    expect(container.querySelector('.queue-now .queue-line-label').textContent).toBe('Proposed wording');
    expect(container.querySelector('.queue-now .queue-line-text').textContent).toBe(after);
    expect(container.querySelector('.queue-was ins')).toBeNull();
    expect(container.querySelector('.queue-now del')).toBeNull();
  });

  it('keeps ownership clear without matching fragments across passages', () => {
    const { container } = queue([{ id: 'c1', docId: 'answer', segmentId: 'a8', before: 'I wrote the Helm change.', after: 'Sam wrote the Helm change.', status: 'proposed', decision: null }]);
    expect(container.querySelector('.queue-was .queue-line-text').textContent).toBe('I wrote the Helm change.');
    expect(container.querySelector('.queue-now .queue-line-text').textContent).toBe('Sam wrote the Helm change.');
    expect(container.querySelectorAll('.queue-diff-pair del, .queue-diff-pair ins')).toHaveLength(0);
  });

  it('offers take, keep and write as one radio group, with the proposed rewrite chosen by default', () => {
    queue([{ id: 'c1', docId: 'answer', segmentId: 'a8', before: 'I wrote it.', after: 'Sam wrote it.', status: 'proposed', decision: null }]);
    const group = screen.getByRole('radiogroup', { name: 'Choice for this change' });
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((r) => r.textContent)).toEqual(['Take the rewrite', 'Keep as is', 'Write my own']);
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);
    expect(screen.getByRole('button', { name: 'Apply 1 change' })).toBeTruthy();
  });
});
