// @vitest-environment jsdom
// R10: on a phone, tapping a citation opens a small sheet with the fact and the applicant's own words.
import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CitePeek } from '../../client/src/components/CitePeek.jsx';
import { References } from '../../client/src/components/References.jsx';
import { useAppState } from '../../client/src/useAppState.js';

afterEach(cleanup);

const fact = { id: 'f3', statement: 'Jobs were queued on Kubernetes across six lab workstations.', quote: 'the runner queued them on Kubernetes (k3s on six old lab workstations with GPUs)', sourceId: 's1', status: 'confirmed' };

describe('R10 the citation peek', () => {
  it('shows the number, the fact, the quote marked and its source, with a way to correct it or close', () => {
    const onCorrect = vi.fn();
    const onClose = vi.fn();
    const { container } = render(<CitePeek fact={fact} n={3} sourceLabel="From your notes" onCorrect={onCorrect} onClose={onClose} />);
    const sheet = screen.getByRole('dialog', { name: 'Evidence 3' });
    expect(sheet.querySelector('.peek-n').textContent).toBe('3');
    expect(sheet.querySelector('.peek-statement').textContent).toBe(fact.statement);
    expect(container.querySelector('.peek-quote mark').textContent).toBe(fact.quote);
    expect(screen.getByText('From your notes')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Correct this fact' }));
    expect(onCorrect).toHaveBeenCalledWith('f3');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<CitePeek fact={fact} n={3} sourceLabel="From your notes" onCorrect={vi.fn()} onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Evidence 3' }), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('is in the app state', () => {
    const { result } = renderHook(() => useAppState({ data: null, setNotice: () => {}, reset: async () => {} }));
    expect(result.current.peekFactId).toBeNull();
    expect(typeof result.current.setPeekFactId).toBe('function');
  });
});

describe('R10 opening a correction from the peek', () => {
  it('opens any fact’s correction with its own wording; only the sample’s fact is prefilled with the sample', () => {
    const sample = { name: 'Ellie', correction: { quote: 'I wrote the Helm change.', text: 'My teammate Sam wrote the Helm change.' } };
    Element.prototype.scrollIntoView = () => {};
    const onCorrect = vi.fn();
    render(<References facts={[fact]} citations={{ f3: 3 }} sources={{ s1: 'notes' }} activeFactId={null} locked={false} onCorrect={onCorrect} onHover={vi.fn()} sample={sample} openCorrectionFactId="f3" />);
    const textarea = screen.getByLabelText('The fact, in your words');
    expect(textarea.value).toBe(fact.statement);
    expect(document.activeElement).toBe(textarea);
    expect(onCorrect).not.toHaveBeenCalled();
    expect(screen.getByText('Saving it finds every sentence that cites this fact and proposes a fix for you to review.')).toBeTruthy();
  });
});
