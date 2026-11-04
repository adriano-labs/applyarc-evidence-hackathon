// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChangeQueue } from '../../client/src/components/ChangeQueue.jsx';
import { GuidedBody } from '../../client/src/components/GuidedBody.jsx';
import { GuidedReview } from '../../client/src/components/GuidedReview.jsx';
import { GuidedRun } from '../../client/src/components/GuidedRun.jsx';
import { Rail } from '../../client/src/components/Rail.jsx';

afterEach(cleanup);
Element.prototype.scrollIntoView = () => {};
const fact = { id: 'f1', statement: 'I tested the deployment; Sam wrote it.', status: 'confirmed', quote: 'I tested the deployment; Sam wrote it.', sourceId: 's1', history: [{ statement: 'I wrote the deployment.' }] };
const items = ['answer', 'letter'].map((docId, i) => ({ id: `c${i}`, docId, segmentId: `${docId}-1`, before: 'I wrote the deployment.', after: 'I tested the deployment.', status: 'proposed', decision: null }));
const repair = { factId: 'f1', status: 'review', items };
const docTitles = { answer: 'Project answer', letter: 'Cover letter' };
const makeWorkspace = (application = {}) => ({
  applicant: { sources: [{ id: 's1', kind: 'notes', text: fact.quote, read: true }], facts: [fact] },
  application: {
    form: { company: 'Sample', documents: Object.entries(docTitles).map(([id, title]) => ({ id, title, wordLimit: 300 })) },
    documents: Object.keys(docTitles).reduce((docs, id, i) => ({ ...docs, [id]: { id, revision: i + 2, segments: [{ id: `${id}-1`, kind: 'claim', author: 'repair', text: `${id === 'answer' ? 'I tested the deployment.' : 'My contribution was testing the deployment.'}`, factIds: ['f1'] }] } }), {}),
    repair, lastRepair: null, approvals: {}, questions: [], exports: [], ...application,
  },
});
const view = { next: 'approve', citations: { f1: 1 }, approvals: { answer: 'none', letter: 'none' }, stats: { answer: { words: 5, wordLimit: 300 }, letter: { words: 7, wordLimit: 300 } } };
const handlers = () => ({ onDecideChange: vi.fn(), onApplyChanges: vi.fn(), onCancelRepair: vi.fn(), onProposeRepair: vi.fn(), onApprove: vi.fn(), onReview: vi.fn() });
const queue = (props = {}) => <ChangeQueue repair={repair} fact={fact} number={1} docTitles={docTitles} {...props} />;

describe('repair controls while work is in flight', () => {
  it.each([{ busy: { name: 'recover' } }, { pending: true }])('does not turn an unfinished proposal into review choices or offer another rewrite: %j', (lock) => {
    const onPropose = vi.fn();
    render(queue({ ...lock, repair: { ...repair, status: 'pending' }, onPropose }));
    expect(screen.queryByRole('button', { name: 'Propose the changes' })).toBeNull();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(document.querySelector('.queue-now')).toBeNull();
    expect(screen.getByRole('region', { name: 'What changed' }).textContent).not.toMatch(/Waiting for the rewrite/);
    expect(onPropose).not.toHaveBeenCalled();
  });

  it.each(['guided', 'workspace'])('%s passes recovery through and does not offer a second rewrite', (surface) => {
    const workspace = makeWorkspace({ repair: { ...repair, status: 'pending' } });
    const h = handlers();
    const props = { workspace, view, busy: { name: 'recover', label: 'Finishing your saved step' } };
    render(surface === 'guided' ? <GuidedBody {...props} stepKey="change" handlers={h} /> : <Rail {...props} {...h} receipts={[]} />);
    expect(screen.getByRole('button', { name: 'Undo this correction' }).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Propose the changes' })).toBeNull();
    const panel = screen.getByRole('region', { name: 'What changed' });
    expect(panel.textContent).toMatch(/checking (?:your )?saved changes/i);
    expect(panel.textContent).not.toMatch(/Rewriting the sentences|Waiting for the rewrite/);
    fireEvent.click(screen.getByRole('button', { name: 'Undo this correction' }));
    expect(h.onCancelRepair).not.toHaveBeenCalled();
  });

  it.each(['guided', 'workspace'])('%s locks ordinary saves, not just model calls', (surface) => {
    const h = handlers();
    const props = { workspace: makeWorkspace(), view, busy: null, pending: true };
    render(surface === 'guided' ? <GuidedBody {...props} stepKey="change" handlers={h} /> : <Rail {...props} {...h} receipts={[]} />);
    expect(screen.getByRole('button', { name: 'Undo this correction' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Apply 2 changes' }).disabled).toBe(true);
    for (const radio of screen.getAllByRole('radio')) expect(radio.disabled).toBe(true);
    expect(screen.getByRole('region', { name: 'What changed' }).textContent).toMatch(/saving/i);
    fireEvent.keyDown(screen.getByRole('region', { name: 'What changed' }), { key: 'y' });
    expect(h.onDecideChange).not.toHaveBeenCalled();
  });

  it.each([{ name: 'recover' }, { name: 'repair' }, { name: 'check' }])('locks writes for $name but retains context and keyboard navigation', (busy) => {
    const onDecide = vi.fn();
    const onShow = vi.fn();
    render(queue({ busy, onDecide, onShow }));
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio.disabled).toBe(true);
      fireEvent.click(radio);
    }
    const panel = screen.getByRole('region', { name: 'What changed' });
    fireEvent.keyDown(panel, { key: 'j' });
    expect(screen.getAllByRole('listitem')[1].dataset.focused).toBe('true');
    fireEvent.keyDown(panel, { key: 'y' });
    fireEvent.keyDown(panel, { key: 'n' });
    expect(onDecide).not.toHaveBeenCalled();
    const show = screen.getByRole('button', { name: 'Show in the cover letter' });
    expect(show.disabled).toBe(false);
    fireEvent.click(show);
    expect(onShow).toHaveBeenCalledWith('letter', 'letter-1');
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('retains an open wording draft during a save, blocks submission, and resumes afterwards', () => {
    const onDecide = vi.fn();
    const ui = render(queue({ onDecide }));
    fireEvent.click(screen.getAllByRole('radio', { name: 'Write my own' })[0]);
    fireEvent.change(screen.getByRole('textbox', { name: 'Your wording' }), { target: { value: 'My own accurate wording.' } });
    ui.rerender(queue({ pending: true, onDecide }));
    const text = screen.getByRole('textbox', { name: 'Your wording' });
    expect(text.value).toBe('My own accurate wording.');
    expect(text.disabled || text.readOnly).toBe(true);
    expect(screen.getByRole('button', { name: 'Use my wording' }).disabled).toBe(true);
    fireEvent.submit(text.closest('form'));
    expect(onDecide).not.toHaveBeenCalled();
    ui.rerender(queue({ onDecide }));
    fireEvent.submit(screen.getByRole('textbox', { name: 'Your wording' }).closest('form'));
    expect(onDecide).toHaveBeenCalledWith('c0', 'write', 'My own accurate wording.');
  });

  it.each([{ busy: { name: 'recover' } }, { pending: true }])('locks repaired-version approvals while a write is unsettled: %j', (lock) => {
    const h = handlers();
    render(<GuidedBody stepKey="change" workspace={makeWorkspace({ repair: null, lastRepair: { changed: 2 } })} view={view} handlers={h} {...lock} />);
    for (const button of screen.getAllByRole('button', { name: /^Approve the/ })) {
      expect(button.disabled).toBe(true);
      fireEvent.click(button);
    }
    expect(h.onApprove).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Review updated documents' }).disabled).toBe(false);
  });
});

describe('review repaired documents before approval', () => {
  it('opens both current documents using the existing viewer, returns without mutation, then approves exact versions', () => {
    const workspace = makeWorkspace({ repair: null, lastRepair: { changed: 2, docs: ['answer', 'letter'] } });
    const original = JSON.stringify(workspace);
    const onApprove = vi.fn();
    function Walkthrough() {
      const [reviewStep, onReview] = useState(null);
      return <GuidedRun workspace={workspace} view={view} story="change" sampleName="Ellie" reviewStep={reviewStep} onReview={onReview}>
        {reviewStep ? <GuidedReview n={reviewStep} workspace={workspace} view={view} /> : <GuidedBody stepKey="change" workspace={workspace} view={view} handlers={{ onReview, onApprove }} />}
      </GuidedRun>;
    }
    render(<Walkthrough />);
    const review = screen.getByRole('button', { name: 'Review updated documents' });
    const approval = screen.getByRole('button', { name: 'Approve the project answer, version 2' });
    expect(review.compareDocumentPosition(approval) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(review);
    // The existing citation anchor splits the sentence across text nodes.
    expect(screen.getByRole('article', { name: 'Project answer' }).querySelector('[data-segment="answer-1"] .sentence-text').textContent).toContain('I tested the deployment.');
    fireEvent.click(screen.getByRole('button', { name: 'Show her cover letter' }));
    expect(screen.getByRole('article', { name: 'Cover letter' }).querySelector('[data-segment="letter-1"] .sentence-text').textContent).toContain('My contribution was testing the deployment.');
    expect(onApprove).not.toHaveBeenCalled();
    expect(JSON.stringify(workspace)).toBe(original);
    fireEvent.click(screen.getByRole('button', { name: 'Return to correction' }));
    fireEvent.click(screen.getByRole('button', { name: 'Approve the project answer, version 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Approve the cover letter, version 3' }));
    expect(onApprove.mock.calls).toEqual([['answer', 2], ['letter', 3]]);
  });
});
