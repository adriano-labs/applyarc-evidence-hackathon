// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
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
const view = (props = {}) => render(<ChangeQueue {...base} {...props} />);

describe('ChangeQueue', () => {
  it('summarises the queue and shows the fact before and after', () => {
    const { container } = view();
    expect(screen.getByRole('heading', { name: 'What changed' })).toBeTruthy();
    expect(container.querySelector('.queue-summary').textContent).toBe('Correcting [3] reopened the 2 sentences that cite it: 1 in the project answer, 1 in the cover letter. The other 11 sentences are untouched.');
    expect(container.querySelector('.queue-head .chip-needs').textContent).toBe('1 needs you');
    expect(screen.getByRole('heading', { name: 'What changed' })).toBeTruthy();
    expect(container.querySelector('.queue-fact del').textContent).toBe('I wrote the Helm change.');
    expect(container.querySelector('.queue-fact ins').textContent).toBe('Sam wrote the Helm change; I tested it.');
  });

  it('counts the reopened sentences per document from the real items', () => {
    const three = { ...repair, items: [repair.items[0], { ...repair.items[0], id: 'c3', segmentId: 'answer-9' }, repair.items[1]] };
    const { container, rerender } = view({ repair: three, untouchedCount: 1 });
    expect(container.querySelector('.queue-summary').textContent).toBe('Correcting [3] reopened the 3 sentences that cite it: 2 in the project answer, 1 in the cover letter. The other 1 sentence is untouched.');
    rerender(<ChangeQueue {...base} repair={{ ...repair, items: [repair.items[1]] }} untouchedCount={undefined} />);
    expect(container.querySelector('.queue-summary').textContent).toBe('Correcting [3] reopened the 1 sentence that cites it: 1 in the cover letter.');
  });

  it('shows each change as complete current and proposed wording, with its document', () => {
    const { container } = view();
    const first = container.querySelectorAll('.queue-item')[0];
    expect(first.querySelector('.queue-item-head .doc-name').textContent).toBe('Project answer · cites [3]');
    expect(first.querySelector('.queue-was .queue-line-text').textContent).toBe('I wrote the Helm change.');
    expect(first.querySelector('.queue-now .queue-line-text').textContent).toBe('Sam wrote the Helm change.');
    expect([...first.querySelectorAll('[role="radio"]')].every((b) => b.classList.contains('btn'))).toBe(true);
  });

  it('explains a conflict on the applicant’s own words', () => {
    view();
    expect(screen.getByText((_, el) => el?.className === 'queue-note' && el.textContent.startsWith('You edited this sentence.'))).toBeTruthy();
    expect(screen.getAllByText('Needs you').length).toBeGreaterThan(0);
  });

  it('keeps Apply disabled until every “needs you” item is decided', () => {
    const onApply = vi.fn();
    const { rerender, container } = view({ onApply });
    const apply = screen.getByRole('button', { name: 'Apply 2 changes' });
    expect(apply.disabled).toBe(true);
    expect(screen.getByText('Decide 1 more first.')).toBeTruthy();
    const decided = { ...repair, items: [repair.items[0], { ...repair.items[1], decision: 'keep' }] };
    rerender(<ChangeQueue {...base} repair={decided} onApply={onApply} />);
    fireEvent.click(screen.getByRole('button', { name: 'Apply 2 changes' }));
    expect(onApply).toHaveBeenCalled();
    expect(container.querySelector('.queue-head .chip-needs')).toBeNull();
  });

  it('takes or keeps a change', () => {
    const onDecide = vi.fn();
    view({ onDecide });
    fireEvent.click(screen.getAllByRole('radio', { name: 'Take the rewrite' })[1]);
    expect(onDecide).toHaveBeenLastCalledWith('c2', 'take');
    fireEvent.click(screen.getByRole('radio', { name: 'Keep mine' }));
    expect(onDecide).toHaveBeenLastCalledWith('c2', 'keep');
    fireEvent.click(screen.getByRole('radio', { name: 'Keep as is' }));
    expect(onDecide).toHaveBeenLastCalledWith('c1', 'keep');
  });

  it('shows which choice is active', () => {
    const decided = { ...repair, items: [repair.items[0], { ...repair.items[1], decision: 'keep' }] };
    view({ repair: decided });
    expect(screen.getByRole('radio', { name: 'Keep mine' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getAllByRole('radio', { name: 'Take the rewrite' })[0].getAttribute('aria-checked')).toBe('true');
  });

  it('lets the applicant write their own wording', () => {
    const onDecide = vi.fn();
    view({ onDecide });
    fireEvent.click(screen.getAllByRole('radio', { name: 'Write my own' })[1]);
    fireEvent.change(screen.getByLabelText('Your wording'), { target: { value: 'I diagnosed it; Sam fixed it.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use my wording' }));
    expect(onDecide).toHaveBeenLastCalledWith('c2', 'write', 'I diagnosed it; Sam fixed it.');
  });

  it.each(['button', 'keyboard'])('preserves wording after a failed %s save and closes only after a successful retry', async (path) => {
    let finishSave;
    const onDecide = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => { finishSave = resolve; }))
      .mockResolvedValueOnce({ workspace: {} });
    view({ onDecide });
    fireEvent.click(screen.getAllByRole('radio', { name: 'Write my own' })[1]);
    const wording = 'I diagnosed it; Sam fixed it.';
    fireEvent.change(screen.getByLabelText('Your wording'), { target: { value: wording } });
    const submit = () => {
      const button = screen.getByRole('button', { name: 'Use my wording' });
      if (path === 'keyboard') fireEvent.submit(button.closest('form'));
      else fireEvent.click(button);
    };
    submit();
    expect(screen.getByLabelText('Your wording').value).toBe(wording);
    await act(async () => { finishSave(null); });
    expect(screen.getByLabelText('Your wording').value).toBe(wording);
    await act(async () => { submit(); });
    expect(onDecide).toHaveBeenNthCalledWith(1, 'c2', 'write', wording);
    expect(onDecide).toHaveBeenNthCalledWith(2, 'c2', 'write', wording);
    expect(screen.queryByLabelText('Your wording')).toBeNull();
  });

  it('shows saved manual wording in the comparison before applying it', () => {
    const written = { ...repair, items: [{ ...repair.items[0], status: 'needs-review', after: null, decision: 'write', written: 'I tested the change Sam wrote.' }] };
    const { container } = view({ repair: written });
    expect(container.querySelector('.queue-now').textContent).toContain('I tested the change Sam wrote.');
    fireEvent.click(screen.getByRole('radio', { name: 'Write my own' }));
    expect(screen.getByLabelText('Your wording').value).toBe('I tested the change Sam wrote.');
  });

  it('says when no rewrite was proposed', () => {
    const noRewrite = { ...repair, items: [{ ...repair.items[0], after: null, status: 'needs-review' }] };
    view({ repair: noRewrite });
    expect(screen.getByText('No rewrite proposed. Keep it only if you can stand behind it, or write your own.')).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'Take the rewrite' })).toBeNull();
  });

  it('decides with the keyboard: J/K to move, Y to take, N to keep', () => {
    const onDecide = vi.fn();
    const { container } = view({ onDecide });
    const queue = container.querySelector('.queue');
    fireEvent.keyDown(queue, { key: 'j' });
    fireEvent.keyDown(queue, { key: 'y' });
    expect(onDecide).toHaveBeenLastCalledWith('c2', 'take');
    fireEvent.keyDown(queue, { key: 'k' });
    fireEvent.keyDown(queue, { key: 'n' });
    expect(onDecide).toHaveBeenLastCalledWith('c1', 'keep');
  });

  it('shows progress while the rewrites are being proposed, unless the page already shows the stage', () => {
    view({ busy: { name: 'repair' }, repair: { ...repair, status: 'awaiting-proposal' } });
    expect(screen.getByText('Rewriting the sentences that cite this fact…')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Apply 2 changes' }).disabled).toBe(true);
    cleanup();
    view({ busy: { name: 'repair' }, repair: { ...repair, status: 'awaiting-proposal' }, statusShown: true });
    expect(screen.queryByText('Rewriting the sentences that cite this fact…')).toBeNull();
    expect(screen.getByRole('button', { name: 'Apply 2 changes' }).disabled).toBe(true);
  });

  it('says who proposed the wording and that the same model reviewed it, from the receipts alone', () => {
    const meta = (step) => ({ step, flow: 'repair', provider: 'meta', isMeta: true, model: 'muse-wonder-1.0', costUsd: 0.01, toolCalls: [] });
    const { rerender } = view({ receipts: [meta('repair'), meta('review')] });
    expect(screen.getByText('Proposed by Muse Wonder, then reviewed by the same model against the facts each sentence cites')).toBeTruthy();
    rerender(<ChangeQueue {...base} receipts={[meta('repair')]} />);
    expect(screen.getByText('Proposed by Muse Wonder')).toBeTruthy();
    rerender(<ChangeQueue {...base} receipts={[{ step: 'repair', flow: 'repair', provider: 'fixture', model: 'fixture', costUsd: 0, toolCalls: [] }]} />);
    expect(screen.queryByText(/Proposed by/)).toBeNull();
    rerender(<ChangeQueue {...base} receipts={[meta('repair'), meta('review')]} repair={{ ...repair, status: 'awaiting-proposal' }} />);
    expect(screen.queryByText(/Proposed by/)).toBeNull();
  });
});

// UX review of 24f96a5 (29 Oct): the conflict note names the clash and what keeping costs.
describe('ChangeQueue conflict note', () => {
  it('says what the fact now says and that keeping yours drops its citation', () => {
    const { container } = view();
    expect([...container.querySelectorAll('.queue-note')].map((n) => n.textContent)).toContain('You edited this sentence. Fact [3] now says: \u201cSam wrote the Helm change; I tested it.\u201d Keeping yours removes its citation to [3].');
  });
});
