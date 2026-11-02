// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextApplication } from '../../client/src/components/NextApplication.jsx';

afterEach(cleanup);

const forms = [
  { id: 'a', company: 'Graphcore', role: 'Graduate Cloud Platform Engineer 2027', current: true },
  { id: 'b', company: 'Graphcore', role: 'Graduate Software Engineer, Drivers and Utilities 2027', current: false },
];

describe('NextApplication', () => {
  it('offers every other form and says what carries over', () => {
    render(<NextApplication forms={forms} busy={false} onChoose={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Start your next application' })).toBeTruthy();
    expect(screen.getByText('Your confirmed facts come with you. The app asks only what the new form needs.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Graduate Cloud Platform Engineer 2027/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Graduate Software Engineer, Drivers and Utilities 2027 · Graphcore' })).toBeTruthy();
  });

  it('starts the chosen form, or cancels', () => {
    const onChoose = vi.fn();
    const onCancel = vi.fn();
    render(<NextApplication forms={forms} busy={false} onChoose={onChoose} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /Drivers and Utilities/ }));
    expect(onChoose).toHaveBeenCalledWith('b');
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('says so when there is no other form', () => {
    render(<NextApplication forms={[forms[0]]} busy={false} onChoose={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('There are no other forms to start yet.')).toBeTruthy();
  });
});
