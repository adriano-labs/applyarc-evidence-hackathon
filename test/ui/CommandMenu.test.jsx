// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CommandMenu } from '../../client/src/components/CommandMenu.jsx';

afterEach(cleanup);

const commands = [
  { id: 'answer', label: 'Open the project answer', hint: '1', run: vi.fn() },
  { id: 'letter', label: 'Open the cover letter', hint: '2', run: vi.fn() },
  { id: 'draft', label: 'Write both documents', run: vi.fn(), disabled: true },
  { id: 'export', label: 'Preview the export', run: vi.fn() },
];

describe('CommandMenu', () => {
  it('is a labelled dialog with a search box and the commands', () => {
    render(<CommandMenu commands={commands} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Commands' })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('combobox', { name: 'Type a command' }));
    expect(screen.getAllByRole('option')).toHaveLength(4);
  });

  it('filters as you type and runs the highlighted command with Enter', () => {
    const onClose = vi.fn();
    render(<CommandMenu commands={commands} onClose={onClose} />);
    const box = screen.getByRole('combobox', { name: 'Type a command' });
    fireEvent.change(box, { target: { value: 'letter' } });
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Open the cover letter2']);
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(commands[1].run).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('moves with the arrow keys and skips nothing but runs no disabled command', () => {
    render(<CommandMenu commands={commands} onClose={vi.fn()} />);
    const box = screen.getByRole('combobox', { name: 'Type a command' });
    fireEvent.keyDown(box, { key: 'ArrowDown' });
    fireEvent.keyDown(box, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[2].getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(commands[2].run).not.toHaveBeenCalled();
  });

  it('says when nothing matches and closes with Escape', () => {
    const onClose = vi.fn();
    render(<CommandMenu commands={commands} onClose={onClose} />);
    const box = screen.getByRole('combobox', { name: 'Type a command' });
    fireEvent.change(box, { target: { value: 'zzz' } });
    expect(screen.getByText('No command matches “zzz”.')).toBeTruthy();
    fireEvent.keyDown(box, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
