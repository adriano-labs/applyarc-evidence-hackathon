// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChangeQueue } from '../../client/src/components/ChangeQueue.jsx';

afterEach(cleanup);

const before = 'I wrote the Helm patch that mounted a memory-backed emptyDir with a size limit per job.';
const after = 'I reproduced the failure, tested Sam’s fix and wrote the incident notes. Sam wrote the Helm patch. The problem was fixed by mounting a memory-backed emptyDir with a size limit per job.';
const item = { id: 'change1', docId: 'answer', segmentId: 'answer1', before, after, status: 'proposed', decision: null };
const view = (overrides = {}, status = 'review') => render(<ChangeQueue
  repair={{ factId: 'f1', status, items: [{ ...item, ...overrides }] }}
  fact={{ id: 'f1', statement: 'Sam wrote the patch. I tested it.' }}
  number={1} docTitles={{ answer: 'Project answer' }}
  onDecide={vi.fn()} onApply={vi.fn()} />);

describe('repair passage readability', () => {
  it('shows complete current/proposed passages without word matching across different actors', () => {
    const { container } = view();
    expect(container.querySelector('.queue-was .queue-line-text').textContent).toBe(before);
    expect(container.querySelector('.queue-now .queue-line-text').textContent).toBe(after);
    expect(container.querySelector('.queue-was .queue-line-label').textContent).toBe('Current wording');
    expect(container.querySelector('.queue-now .queue-line-label').textContent).toBe('Proposed wording');
    expect(container.querySelectorAll('.queue-diff-pair del, .queue-diff-pair ins')).toHaveLength(0);
  });

  it('labels a kept passage as unchanged instead of presenting the discarded rewrite', () => {
    const { container } = view({ decision: 'keep' });
    expect(container.querySelector('.queue-now .queue-line-label').textContent).toBe('Keeping unchanged');
    expect(container.querySelector('.queue-now .queue-line-text').textContent).toBe(before);
    expect(container.querySelector('.queue-now').textContent).not.toContain(after);
  });

  it.each([after, null])('shows saved manual wording even when the proposed rewrite is %s', (proposal) => {
    const written = 'Sam wrote it. I tested the fix & documented <what happened>.';
    const { container } = view({ decision: 'write', written, after: proposal });
    expect(container.querySelector('.queue-now .queue-line-label').textContent).toBe('Your wording');
    expect(container.querySelector('.queue-now .queue-line-text').textContent).toBe(written);
    expect(container.querySelector('.queue-now what')).toBeNull();
  });

  it('does not present a proposal before it has arrived', () => {
    const { container } = view({ after: null, status: 'pending' }, 'awaiting-proposal');
    expect(container.querySelector('.queue-was .queue-line-text').textContent).toBe(before);
    expect(container.querySelector('.queue-now')).toBeNull();
  });
});
