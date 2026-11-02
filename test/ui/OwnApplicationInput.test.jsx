// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OwnApplicationInput } from '../../client/src/components/OwnApplicationInput.jsx';

afterEach(cleanup);
const enter = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
function fill() {
  fireEvent.click(screen.getByText('Try your own fictional example'));
  enter('Fictional first name', 'Priya');
  enter('Company', 'Harbour Labs');
  enter('Role', 'Platform Engineer');
  enter('Fictional CV or project notes', 'We built the service. I wrote the deployment tests.');
  enter('Exact application question', 'What did you build? What did you do yourself?');
  enter('What the question asks for — one point per line', 'What you built\nYour individual contribution');
  fireEvent.click(screen.getByLabelText('Requires my own contribution: Your individual contribution'));
  fireEvent.click(screen.getByLabelText(/I checked these points/));
  fireEvent.click(screen.getByLabelText(/These notes are fictional/));
}

describe('own application intake', () => {
  it('sends explicitly confirmed separate requirements and optional personal flags', async () => {
    const onStart = vi.fn().mockResolvedValue({ workspace: {} });
    render(<OwnApplicationInput liveModel onStart={onStart} />);
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Read my example' }));
    await waitFor(() => expect(onStart).toHaveBeenCalledTimes(1));
    expect(onStart.mock.calls[0][0]).toMatchObject({
      applicant: 'Priya', company: 'Harbour Labs', role: 'Platform Engineer',
      synthetic: true, requirementsConfirmed: true,
      requirements: [{ text: 'What you built', personal: false }, { text: 'Your individual contribution', personal: true }],
    });
  });

  it('preserves all input and confirmations when starting fails', async () => {
    const onStart = vi.fn().mockResolvedValue(null);
    render(<OwnApplicationInput liveModel onStart={onStart} />);
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Read my example' }));
    await screen.findByRole('alert');
    expect(screen.getByLabelText('Fictional first name').value).toBe('Priya');
    expect(screen.getByLabelText('Fictional CV or project notes').value).toContain('deployment tests');
    expect(screen.getByLabelText(/I checked these points/).checked).toBe(true);
    expect(screen.getByRole('button', { name: 'Read my example' }).disabled).toBe(false);
  });

  it('requires fresh checklist confirmation after editing the question or requirements', () => {
    render(<OwnApplicationInput liveModel onStart={vi.fn()} />);
    fill();
    enter('Exact application question', 'A different question?');
    expect(screen.getByLabelText(/I checked these points/).checked).toBe(false);
    expect(screen.getByRole('button', { name: 'Read my example' }).disabled).toBe(true);
  });

  it('does not offer fictional model results for custom input', () => {
    const onStart = vi.fn();
    render(<OwnApplicationInput liveModel={false} onStart={onStart} />);
    fill();
    expect(screen.getByText(/Your own example needs the live model/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Read my example' }).disabled).toBe(true);
    expect(onStart).not.toHaveBeenCalled();
  });
});
