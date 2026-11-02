// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PhoneBar } from '../../client/src/components/PhoneBar.jsx';

afterEach(cleanup);

describe('PhoneBar', () => {
  it('switches between the writing and the evidence: the form brief sits at the top of the writing', () => {
    const onPane = vi.fn();
    render(<PhoneBar pane="doc" onPane={onPane} needsYou={1} />);
    expect(screen.getByRole('navigation', { name: 'Sections' })).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Writing' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /Evidence/ }));
    expect(onPane).toHaveBeenCalledWith('rail');
    expect(screen.queryByRole('button', { name: 'Form' })).toBeNull();
  });

  it('shows how many things in the evidence need the applicant', () => {
    render(<PhoneBar pane="doc" onPane={vi.fn()} needsYou={2} />);
    expect(screen.getByRole('button', { name: 'Evidence, 2 need you' })).toBeTruthy();
  });
});
