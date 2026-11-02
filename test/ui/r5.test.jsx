// @vitest-environment jsdom
// Lead the judge into the corrigendum: "Try Ellie’s correction" before approving.
import { readFileSync } from 'node:fs';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { References } from '../../client/src/components/References.jsx';
import { primaryAction, thenLine } from '../../client/src/flow.js';
import { fromRoot } from '../../server/paths.js';

afterEach(cleanup);

const sample = { name: 'Ellie', correction: { quote: 'I wrote the Helm change.', text: 'My teammate Sam wrote the Helm change; I tested it on two of the lab nodes.' } };
const drafted = (over = {}) => ({
  applicant: { sources: [], facts: [{ id: 'f10', status: 'confirmed', quote: 'I wrote the Helm change.' }] },
  application: { form: { documents: [{ id: 'answer', title: 'Project answer' }, { id: 'letter', title: 'Cover letter' }] }, documents: { answer: { id: 'answer', revision: 1, segments: [] }, letter: { id: 'letter', revision: 1, segments: [] } }, repair: null, lastRepair: null, exports: [], ...over },
});
const view = { next: 'approve', approvals: { answer: 'none', letter: 'none' }, stats: { answer: { overLimit: false }, letter: { overLimit: false } } };

describe('R5 the invitation', () => {
  it('makes Ellie’s correction the main step before approving, with approve beside it', () => {
    const action = primaryAction(view, drafted(), 'answer', sample);
    expect(action).toMatchObject({ id: 'try-correction', label: 'Try Ellie’s correction', hint: 'Now: correct one of Ellie’s facts, or approve.', factId: 'f10' });
    expect(action.secondary).toMatchObject({ id: 'approve:answer', label: 'Approve the project answer, version 1' });
    expect(thenLine(view, drafted(), sample)).toBe('Then: only the sentences citing that fact are rewritten.');
  });

  it('goes back to plain approving once a correction has been applied, or without the sample', () => {
    expect(primaryAction(view, drafted({ lastRepair: { factId: 'f10' } }), 'answer', sample)).toMatchObject({ id: 'approve:answer' });
    expect(primaryAction(view, drafted(), 'answer', null)).toMatchObject({ id: 'approve:answer' });
    expect(thenLine(view, drafted({ lastRepair: { factId: 'f10' } }), sample)).toBe('Then: export a pack marked NOT SUBMITTED.');
  });

  it('opens the fact’s correction prefilled, says what will happen, and puts Save in reach', () => {
    const facts = [{ id: 'f9', statement: 'Redis.', quote: 'Redis for the queue', sourceId: 's1', status: 'confirmed' }, { id: 'f10', statement: 'I wrote the Helm change.', quote: 'I wrote the Helm change.', sourceId: 's2', status: 'confirmed' }];
    Element.prototype.scrollIntoView = () => {};
    render(<References facts={facts} citations={{ f9: 9, f10: 10 }} sources={{ s1: 'notes', s2: 'answer' }} activeFactId={null} locked={false} onCorrect={vi.fn()} onHover={vi.fn()} sample={sample} openCorrectionFactId="f10" />);
    expect(screen.getByLabelText('The fact, in your words').value).toBe(sample.correction.text);
    expect(screen.getByText('Ellie’s sample correction is filled in. Save it and only the sentences that cite [10] are rewritten.')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Save the correction' }));
  });

  it('styles the chosen option once, in the shared button styles', () => {
    expect(readFileSync(fromRoot('client', 'src', 'styles', 'buttons.css'), 'utf8')).toMatch(/\.btn\[aria-checked="true"\]/);
  });
});
