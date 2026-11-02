// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FactsReview } from '../../client/src/components/FactsReview.jsx';

afterEach(cleanup);

const fact = (id) => ({ id, statement: 's', quote: 'q', sourceId: 's1', status: 'proposed', requirementIds: [] });
const base = { facts: [fact('f1')], total: 1, sources: { s1: 'notes' }, requirementNames: {}, company: 'Acme', onDecide: vi.fn(), onHover: vi.fn(), onConfirmRest: vi.fn(), busy: false };

describe('FactsReview clears active fact', () => {
  it('clears the active fact when no proposed facts remain', () => {
    const onHover = vi.fn();
    const { rerender } = render(<FactsReview {...base} onHover={onHover} facts={[fact('f1')]} />);
    expect(onHover).toHaveBeenCalledWith('f1');
    rerender(<FactsReview {...base} onHover={onHover} facts={[]} />);
    expect(onHover).toHaveBeenCalledWith(null);
  });
});
