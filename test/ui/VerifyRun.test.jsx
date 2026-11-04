// @vitest-environment jsdom
// Verify this run inside the trail: each check with its count, the ids where one fails, the
// fixture labelled, and the line that says what the checks cannot prove.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReceiptsDrawer } from '../../client/src/components/ReceiptsDrawer.jsx';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const checks = [
  { id: 'quotes', pass: true, count: 12, failures: [], text: '12 of 12 confirmed facts quote Ellie’s text word for word' },
  { id: 'numbers', pass: false, count: 17, failures: ['answer-2', 'answer-3', 'letter-5'], text: '13 of 17 drafted statements state no number their cited facts do not' },
  { id: 'export', pass: true, count: 0, failures: [], text: 'No export yet' },
];
const workspace = { revision: 7, applicant: { name: 'Ellie' } };
const FOOT = 'These checks prove the record matches Ellie’s own words and approvals. They do not prove the account is true.';

function openTrail(props) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ revision: 7, checks }), { headers: { 'content-type': 'application/json' } })));
  const view = render(<ReceiptsDrawer receipts={[]} modeLabel="Fixture" mode={{ id: 'fixture' }} workspace={workspace} onDownload={vi.fn()} {...props} />);
  fireEvent.click(screen.getByRole('button', { name: /What the model did/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Verify this run' }));
  return view;
}

describe('Verify this run', () => {
  it('lists each check with its count, the first failing ids, the fixture label and what it cannot prove', async () => {
    const { container } = openTrail();
    expect(await screen.findByText(FOOT)).toBeTruthy();
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/verify');
    expect(screen.getByText('Checked by code, with no model call · Fixture: hand-written outputs, not a model')).toBeTruthy();
    const rows = [...container.querySelectorAll('.verify-list li')].map((li) => [li.className, li.textContent]);
    expect(rows).toEqual([
      ['pass', 'Holds: 12 of 12 confirmed facts quote Ellie’s text word for word'],
      ['fail', 'Does not hold: 13 of 17 drafted statements state no number their cited facts do not · answer-2, answer-3, letter-5'],
      ['none', 'Nothing to check: No export yet'],
    ]);
    expect(screen.getByRole('button', { name: 'Download the trace (JSON) to verify this run' })).toBeTruthy();
  });

  it('hides the results once the workspace changes, until verified again', async () => {
    const { rerender } = openTrail();
    await screen.findByText(FOOT);
    rerender(<ReceiptsDrawer receipts={[]} modeLabel="Fixture" mode={{ id: 'fixture' }} workspace={{ ...workspace, revision: 8 }} onDownload={vi.fn()} />);
    expect(screen.queryByText(FOOT)).toBeNull();
  });
});
