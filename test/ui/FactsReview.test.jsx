// @vitest-environment jsdom
// One fact at a time, its quote lit in the notes, the rest waiting below.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FactsReview } from '../../client/src/components/FactsReview.jsx';

afterEach(cleanup);

const fact = (id, statement, quote, sourceId = 's1', requirementIds = []) => ({ id, statement, quote, sourceId, status: 'proposed', requirementIds });
const facts = [
  fact('f1', 'Redis held the queue.', 'Redis for the queue', 's1', ['tech']),
  fact('f2', 'The team lost two days.', 'we wasted two days before looking', 's2'),
  fact('f3', 'Four of us built it.', 'four of us'),
];
const base = { facts, total: 5, sources: { s1: 'notes', s2: 'answer' }, requirementNames: { tech: 'Technologies' }, company: 'Graphcore', onDecide: vi.fn(), onHover: vi.fn(), onConfirmRest: vi.fn(), busy: false };
const view = (props = {}) => render(<FactsReview {...base} {...props} />);
const card = (container) => container.querySelector('.fact-card');

describe('FactsReview', () => {
  it('asks about one fact at a time, with where it is in the list', () => {
    const { container } = view();
    expect(screen.getByRole('heading', { name: 'Is this right?' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Fact 3 of 5');
    expect(container.querySelectorAll('.fact-card')).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /^(Yes, confirm|Not right)$/ })).toHaveLength(2);
  });

  it('shows the current fact with its exact quote, its source and what it supports, buttons first', () => {
    const { container } = view();
    const c = card(container);
    expect(within(c).getByText('Redis held the queue.')).toBeTruthy();
    expect(within(c).getByText('Redis for the queue').tagName).toBe('MARK');
    expect(within(c).getByText('From your notes')).toBeTruthy();
    expect(within(c).getByText('Technologies')).toBeTruthy();
    const order = [...c.querySelectorAll('button, .fact-statement')].map((el) => el.textContent);
    expect(order.slice(0, 3)).toEqual(['Yes, confirm', 'Not right', 'Redis held the queue.']);
    expect(within(c).getByText('Enter: yes · Backspace: not right')).toBeTruthy();
  });

  it('lists what comes next by statement only', () => {
    const { container } = view();
    expect(screen.getByRole('heading', { name: 'Next' })).toBeTruthy();
    const next = [...container.querySelectorAll('.facts-next li')].map((li) => li.textContent);
    expect(next).toEqual(['The team lost two days.', 'Four of us built it.']);
    expect(container.querySelector('.facts-next button')).toBeNull();
    expect(screen.getByText('After these, the app checks your facts against what Graphcore asks for, and asks you about anything missing.')).toBeTruthy();
  });

  it('confirms or rejects the current fact with buttons, Enter and Backspace', () => {
    const onDecide = vi.fn();
    const { container } = view({ onDecide });
    fireEvent.click(screen.getByRole('button', { name: 'Not right' }));
    expect(onDecide).toHaveBeenLastCalledWith('f1', 'reject');
    const section = container.querySelector('.facts-review');
    fireEvent.keyDown(section, { key: 'Enter' });
    expect(onDecide).toHaveBeenLastCalledWith('f1', 'confirm');
  });

  it('lights the current fact’s quote in the notes, and a hovered one while hovered', () => {
    const onHover = vi.fn();
    const { container, rerender } = view({ onHover });
    expect(onHover).toHaveBeenLastCalledWith('f1');
    rerender(<FactsReview {...base} onHover={onHover} facts={facts.slice(1)} />);
    expect(onHover).toHaveBeenLastCalledWith('f2');
    fireEvent.mouseEnter(card(container));
    expect(onHover).toHaveBeenLastCalledWith('f2');
    fireEvent.mouseLeave(card(container));
    expect(onHover).toHaveBeenLastCalledWith('f2');
  });

  it('offers to confirm the rest once the first fact has been decided', () => {
    const onConfirmRest = vi.fn();
    const fresh = view({ total: 3, onConfirmRest });
    expect(screen.queryByRole('button', { name: /Confirm the remaining/ })).toBeNull();
    fresh.unmount();
    view({ total: 4, onConfirmRest });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm the remaining 3' }));
    expect(onConfirmRest).toHaveBeenCalledWith(['f1', 'f2', 'f3']);
  });

  it('disables the buttons while a step runs', () => {
    view({ busy: true });
    expect(screen.getByRole('button', { name: 'Yes, confirm' }).disabled).toBe(true);
  });
});
