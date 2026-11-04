// @vitest-environment jsdom
// Start at the key moment: Ellie's sample as a real Muse Wonder run saved it. The card offers it on
// the live model only, the walk-through lands on the correction, her note goes in with one click, the
// live model's offer leads to the repair, and every label says what was prepared and what ran now.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../client/src/App.jsx';
import { GuidedBody } from '../../client/src/components/GuidedBody.jsx';
import { GuidedRun, guidedStep } from '../../client/src/components/GuidedRun.jsx';
import { ReceiptsDrawer } from '../../client/src/components/ReceiptsDrawer.jsx';
import { SampleCards } from '../../client/src/components/SampleCards.jsx';
import { happenedLines } from '../../client/src/lib/finish.js';
import { createApp } from '../../server/app.js';
import { preparedWorkspace } from '../../server/domain/prepared.js';
import { fromRoot } from '../../server/paths.js';

const saved = JSON.parse(readFileSync(fromRoot('fixtures', 'ellie-prepared-wonder-20261103.json'), 'utf8'));
const NOTE = saved.prepared.note;
const EARLIER = 'I wrote the helm patch that fixed it.';
const PREPARED = 'prepared from a real Muse Wonder run on 3 Nov';
const loaded = () => preparedWorkspace(saved, '2026-11-03T18:00:00.000Z');
const withNote = () => {
  const ws = loaded();
  ws.applicant.sources.push({ id: 's3', kind: 'notes', text: NOTE, at: '2026-11-03T18:01:00.000Z', read: true, withheld: true });
  return ws;
};
const sample = { id: 'ellie', name: 'Ellie', possessive: 'her', field: 'Graduate engineer', liveOnly: false, formId: saved.application.form.id, form: saved.application.form, notes: saved.applicant.sources[0].text, correction: { anchor: 'Helm change', text: 'My teammate Sam wrote the Helm change; I tested it.' }, prepared: saved.prepared };
const view = (next, over = {}) => ({ next, citations: { f12: 11 }, approvals: { answer: 'approved', letter: 'approved' }, stats: {}, ...over });
const approved = { approvals: { answer: 'approved', letter: 'approved' } };
const receipt = (step, flow) => ({ step, flow, provider: 'meta', isMeta: true, model: 'muse-wonder-1.0', costUsd: 0.01, totalMs: 1000, toolCalls: [], at: '2026-11-03T18:02:00.000Z' });

afterEach(() => { cleanup(); vi.unstubAllGlobals(); sessionStorage.clear(); });
Element.prototype.scrollIntoView = () => {};

describe('the sample card', () => {
  it('offers the key moment on the live model, saying what was prepared and what runs live', () => {
    const onStartPrepared = vi.fn();
    render(<SampleCards samples={[sample]} liveModel onStart={vi.fn()} onStartPrepared={onStartPrepared} />);
    expect(screen.getByText(`Her facts are confirmed and both documents approved, ${PREPARED}. You make the one correction; the repair runs live.`)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Start at the key moment' }));
    expect(onStartPrepared).toHaveBeenCalledWith('ellie');
    expect(screen.getByRole('button', { name: 'Try it with Ellie’s notes' })).toBeTruthy();
  });

  it('hides it on the fixture', () => {
    render(<SampleCards samples={[sample]} liveModel={false} onStart={vi.fn()} onStartPrepared={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Start at the key moment' })).toBeNull();
    expect(screen.queryByText(/prepared from a real/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Try it with Ellie’s notes' })).toBeTruthy();
  });
});

describe('where the walk-through lands', () => {
  it('opens a prepared workspace at the key moment and stays there until the note is through', () => {
    expect(guidedStep({ next: 'export' }, loaded(), null)).toEqual({ n: 5, key: 'change' });
    expect(guidedStep({ next: 'approve' }, loaded(), null)).toEqual({ n: 5, key: 'change' });
    expect(guidedStep({ next: 'read' }, withNote(), null)).toEqual({ n: 5, key: 'change' });
    expect(guidedStep({ next: 'question' }, withNote(), null)).toEqual({ n: 5, key: 'change' });
    expect(guidedStep({ next: 'approve' }, withNote(), null)).toEqual({ n: 5, key: 'change' });
    expect(guidedStep({ next: 'export' }, withNote(), null)).toEqual({ n: 5, key: 'finish' });
  });

  it('says what was prepared and what runs live, with the four finished stages to look back at', () => {
    render(<GuidedRun view={view('export')} workspace={loaded()} story={null} sampleName="Ellie" possessive="her" isMeta onPrimary={vi.fn()} onStory={vi.fn()} onExit={vi.fn()} onReview={vi.fn()}><p>body</p></GuidedRun>);
    expect(screen.getByText('Key moment: correct a fact')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Facts change. Watch what happens.');
    expect(screen.getByText('Add Ellie’s note. Meta reads it against her confirmed facts, flags the contradiction itself and offers the correction. Only the sentences that cite that fact reopen, and you decide each rewrite.')).toBeTruthy();
    expect(screen.getByText(`Her facts and both drafts were ${PREPARED}, before this visit. The correction and the repair run live now.`)).toBeTruthy();
    expect(within(screen.getByRole('list', { name: 'Steps' })).getAllByRole('button').map((b) => b.textContent)).toEqual(['Notes', 'Facts', 'Question', 'Answer']);
  });
});

describe('the key moment step', () => {
  const body = (workspace, v, handlers) => render(<GuidedBody stepKey="change" workspace={workspace} view={v} busy={null} notice={null} modeLabel="Meta Muse Wonder 1.0" sample={sample} handlers={handlers} />);

  it('offers Ellie’s note, prefilled, and adds it with one click', () => {
    const onAddNotes = vi.fn();
    body(loaded(), view('export'), { onAddNotes });
    expect(screen.getByLabelText('Ellie’s note').value).toBe(NOTE);
    fireEvent.click(screen.getByRole('button', { name: 'Add Ellie’s note' }));
    expect(onAddNotes).toHaveBeenCalledWith(NOTE);
    expect(screen.queryByRole('button', { name: 'Correct this fact' })).toBeNull();
  });

  it('then shows the live model’s offer, with Use this correction', () => {
    const ws = withNote();
    ws.application.questions.push({ id: 'q2', kind: 'source-conflict', status: 'open', conflictSourceId: 's3', priorSourceId: 's2', quote: NOTE, priorQuote: EARLIER, text: 'Who wrote the Helm patch?' });
    const offer = { questionId: 'q2', sourceId: 's3', factId: 'f12', before: EARLIER, text: NOTE };
    const onResolveSourceConflict = vi.fn(async () => ({}));
    body(ws, view('question', { approvals: { answer: 'none', letter: 'none' }, sourceCorrections: [offer] }), { onResolveSourceConflict });
    expect(screen.getByLabelText('Your correction').value).toBe(NOTE);
    fireEvent.click(screen.getByRole('button', { name: 'Use this correction' }));
    expect(onResolveSourceConflict).toHaveBeenCalledWith({ questionId: 'q2', sourceId: 's3', factId: 'f12', text: NOTE });
  });

  it('asks for both approvals again when the note was kept out', () => {
    const onApprove = vi.fn();
    body(withNote(), view('approve', { approvals: { answer: 'none', letter: 'none' } }), { onApprove });
    expect(screen.getByText('Nothing was corrected, so both documents stay as they were.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Approve the project answer, version 2' }));
    expect(onApprove).toHaveBeenCalledWith('answer', 2);
  });
});

describe('what the finish and the trail say', () => {
  it('says where the facts and drafts came from, and counts only this visit’s receipts', () => {
    const ws = withNote();
    ws.application.lastRepair = { factId: 'f12', changed: 2, kept: 0, reopened: 2, untouched: 20, at: '2026-11-03T18:03:00.000Z' };
    ws.application.documents.answer.revision = 3;
    ws.application.documents.letter.revision = 2;
    expect(happenedLines(ws, approved, [receipt('extract', 'read'), receipt('repair', 'repair')])).toEqual([
      '12 facts confirmed.',
      `Those facts and both drafts were ${PREPARED}, before this visit; the correction and the repair ran live now.`,
      'You approved version 3 of “Project answer” and version 2 of “Cover letter”.',
      '1 fact corrected: it reopened 2 sentences and left 20 untouched.',
      'Meta: 2 model steps, 0 tool calls, 2.0 s total model time, $0.020 estimated.',
      'Nothing has been sent.',
    ]);
    expect(happenedLines(loaded(), approved, [])).toContain(`Those facts and both drafts were ${PREPARED}, before this visit.`);
  });

  it('labels the trail header', () => {
    render(<ReceiptsDrawer receipts={[]} modeLabel="Meta Muse Wonder 1.0" workspace={loaded()} view={approved} />);
    const toggle = screen.getByRole('button', { name: /What Meta did/ });
    expect(toggle.textContent).toContain('No model calls yet');
    expect(toggle.textContent).toContain(`Facts and drafts: ${PREPARED}, before this visit and not counted here · Correction and repair: live in this visit`);
  });
});

// A stand-in for the live model, as in the server test: never a real call.
function liveAgent() {
  const receipt = (step, emit) => emit({ type: 'receipt', receipt: { step, provider: 'meta', isMeta: true, model: 'muse-wonder-1.0', costUsd: 0.01, totalMs: 1000, toolCalls: [] } });
  return {
    provider: { id: 'meta', label: 'Meta Muse Wonder 1.0', model: 'muse-wonder-1.0', isMeta: true },
    extract: async ({ source, emit }) => { receipt('extract', emit); return { facts: [], conflicts: [{ quote: source.text, priorSourceId: 's2', priorQuote: EARLIER, question: 'Who wrote the Helm patch?' }] }; },
    repair: async ({ fact, items, emit }) => { receipt('repair', emit); return { rewrites: items.map((i) => ({ segmentId: i.segmentId, text: fact.quote, factIds: [fact.id] })) }; },
    review: async ({ claims }) => ({ decisions: claims.map((c) => ({ id: c.id, verdict: 'supported', reason: 'Faithful to the correction.' })) }),
  };
}

describe('the key moment in the app', () => {
  const wait = { timeout: 8000 };
  const button = (name) => screen.findByRole('button', { name }, wait);

  it('goes from the card to the finish: note in, the offer, the live repair, both approvals', async () => {
    const server = createApp({ dataDir: mkdtempSync(join(tmpdir(), 'key-moment-ui-')), form: saved.application.form, agent: liveAgent(), sample: { name: 'Ellie', notes: sample.notes, samples: [sample] }, samples: [sample], prepared: saved });
    vi.stubGlobal('fetch', (url, init) => server.request(String(url), init));
    render(<App />);
    fireEvent.click(await button('Start at the key moment'));
    await screen.findByText('Key moment: correct a fact', {}, wait);
    expect(screen.getByText(`Her facts and both drafts were ${PREPARED}, before this visit. The correction and the repair run live now.`)).toBeTruthy();
    expect(screen.getByLabelText('Ellie’s note').value).toBe(NOTE);

    fireEvent.click(screen.getByRole('button', { name: 'Add Ellie’s note' }));
    fireEvent.click(await button('Use this correction'));
    await screen.findByRole('heading', { name: 'What changed' }, wait);
    await waitFor(() => expect(screen.getAllByRole('radio', { name: 'Take the rewrite' })).toHaveLength(2), wait);
    expect(screen.getByText('Key moment: correct a fact')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Apply 2 changes' }));
    await screen.findByText('Only 2 sentences changed. Everything else stayed exactly as it was.', {}, wait);

    fireEvent.click(await button('Approve the project answer, version 3'));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Approve the project answer, version 3' })).toBeNull(), wait);
    fireEvent.click(await button('Approve the cover letter, version 2'));
    const happened = await screen.findByRole('region', { name: 'What just happened' }, wait);
    expect(screen.getByText('Ready to export')).toBeTruthy();
    expect(within(happened).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '12 facts confirmed.',
      `Those facts and both drafts were ${PREPARED}, before this visit; the correction and the repair ran live now.`,
      'You approved version 3 of “Project answer” and version 2 of “Cover letter”.',
      '1 fact corrected: it reopened 2 sentences and left 20 untouched.',
      'Meta: 2 model steps, 0 tool calls, 2.0 s total model time, $0.020 estimated.',
      'Nothing has been sent.',
    ]);
    expect(document.querySelector('.guided-receipts .receipts-prepared').textContent).toContain(PREPARED);
    // The conflict settled by the correction is not a second answered question.
    expect(screen.getByText('1 question answered in her own words')).toBeTruthy();
  }, 20000);
});
