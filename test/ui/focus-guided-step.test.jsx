// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GuidedRun } from '../../client/src/components/GuidedRun.jsx';

afterEach(cleanup);

const fact = (id, status, sourceId = 's1') => ({ id, status, sourceId, statement: id, quote: id });
const ws = (over = {}) => ({
  applicant: { sources: [{ id: 's1', kind: 'notes', text: 'Notes.', read: true }], facts: [], ...over.applicant },
  application: { form: { company: 'Graphcore', documents: [] }, documents: {}, questions: [], repair: null, ...over.application },
});

describe('GuidedRun focus on step change', () => {
  it('moves focus to the step heading when the step changes, not on first render', () => {
    const props = (over = {}) => ({ view: { next: 'facts' }, workspace: ws({ applicant: { facts: [fact('a', 'proposed')] } }), story: null, sampleName: 'Ellie', isMeta: true, onPrimary: vi.fn(), onStory: vi.fn(), onExit: vi.fn(), children: <p>step body</p>, ...over });
    const { rerender } = render(<GuidedRun {...props()} />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.tabIndex).toBe(-1);
    const activeBefore = document.activeElement;
    rerender(<GuidedRun {...props({ view: { next: 'question' } })} />);
    expect(document.activeElement).toBe(heading);
  });
});
