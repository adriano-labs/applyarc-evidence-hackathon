// @vitest-environment jsdom
// The judges' polish pass (3 Nov): each change from the live judge runs and the judge-eyes review,
// pinned by a test. Ana is a fictional applicant; her Portuguese here is from her own sample.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExportDialog } from '../../client/src/components/ExportDialog.jsx';
import { GuidedBody } from '../../client/src/components/GuidedBody.jsx';
import { GuidedChange } from '../../client/src/components/GuidedChange.jsx';
import { GuidedRun } from '../../client/src/components/GuidedRun.jsx';
import { FinishList } from '../../client/src/components/GuidedReview.jsx';
import { NotesView } from '../../client/src/components/NotesView.jsx';
import { ReceiptsDrawer } from '../../client/src/components/ReceiptsDrawer.jsx';
import { SampleCards } from '../../client/src/components/SampleCards.jsx';
import { TopBar } from '../../client/src/components/TopBar.jsx';
import { SourceCorrectionCard } from '../../client/src/components/SourceCorrectionCard.jsx';
import { SpokenStart } from '../../client/src/components/SpokenStart.jsx';
import { FactsPanel } from '../../client/src/components/StepPanels.jsx';
import { demoLabel, demoLine, packMarkdown } from '../../client/src/flow.js';
import { evidencePassHtml } from '../../client/src/lib/evidencePass.js';
import { happenedLines } from '../../client/src/lib/finish.js';
import { buildApp } from '../../server/build.js';
import { preparedWorkspace } from '../../server/domain/prepared.js';
import { verifyRun } from '../../server/domain/verifyRun.js';
import { fromRoot } from '../../server/paths.js';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const form = { id: 'nyc', company: 'North Yorkshire Council', role: 'Care and Support Worker', documents: [
  { id: 'answer', title: 'Supporting evidence', wordLimit: 500, requirements: [] },
  { id: 'letter', title: 'Cover letter', wordLimit: 350, requirements: [] }] };
const NOTE = 'Correção: os turnos da noite foram dois anos, não três; no último ano passei a fazer dias.';
const ana = {
  id: 'ana', name: 'Ana', possessive: 'her', language: 'pt-PT', form,
  correction: { text: NOTE, meaning: 'Correction: the night shifts were two years, not three; in the last year I moved to days.', actor: 'self', anchor: ['noites'] },
  clips: { notes: '/samples/n.wav', answer: '/samples/a.wav', correction: '/samples/c.wav' }, voice: 'Synthetic voice, fictional applicant',
};
const prepared = { sample: 'ana', model: 'muse-wonder-1.0', ranAt: '2026-11-03T22:03:24.699Z', note: NOTE, loadedAt: '2026-11-03T23:00:00.000Z' };
const f9 = { id: 'f9', status: 'confirmed', language: 'pt-PT', actor: 'self', sourceId: 's1', quote: 'Fiz três anos de noites, e também fins de semana.', statement: 'I did 3 years of nights, and also weekends.' };

// Ana's prepared key moment after the open-weight model read her note: the note is in, and both documents wait for approval again.
function afterNote({ asFacts = true, withheld = false } = {}) {
  const note = { id: 's3', kind: 'notes', text: NOTE, language: 'pt-PT', at: '2026-11-03T23:01:00.000Z', read: true, ...(withheld ? { withheld: true } : {}) };
  const read = asFacts ? [{ id: 'f20', status: 'confirmed', language: 'pt-PT', actor: 'self', sourceId: 's3', quote: 'os turnos da noite foram dois anos, não três', statement: 'I did 2 years of night shifts, not 3' }] : [];
  return {
    prepared,
    applicant: { name: 'Ana', sources: [{ id: 's1', kind: 'notes', text: 'x', language: 'pt-PT', spoken: true, at: '2026-11-03T22:03:52.299Z', read: true }, note], facts: [f9, ...read] },
    application: { form, documents: { answer: { revision: 1, segments: [] }, letter: { revision: 1, segments: [] } }, repair: null, lastRepair: null },
  };
}
const nothingCorrected = { next: 'approve', citations: { f9: 9, f20: 20 }, approvals: {} };

describe('1 · the key moment never dead-ends', () => {
  it('on the open edition, says the note was read as new facts and corrects the fact in one click', () => {
    const onCorrectFact = vi.fn();
    render(<GuidedChange workspace={afterNote()} view={nothingCorrected} sample={ana} voice={false} handlers={{ onCorrectFact, onApprove: vi.fn() }} />);
    expect(screen.getByText('Nothing was corrected, so both documents stay as they were.')).toBeTruthy();
    expect(screen.getByText('The model read her note as new facts, not as a correction. Correct the fact yourself: one click, and the repair still runs live.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Correct this fact' }));
    expect(screen.getByText('Fact [9] says')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Correct this fact' }));
    expect(onCorrectFact).toHaveBeenCalledTimes(1);
    expect(onCorrectFact.mock.calls[0].slice(0, 2)).toEqual(['f9', NOTE]);
  });

  it('offers it without the reason when the model raised the conflict and she kept the earlier account', () => {
    render(<GuidedChange workspace={afterNote({ asFacts: false, withheld: true })} view={nothingCorrected} sample={ana} voice={false} handlers={{ onCorrectFact: vi.fn(), onApprove: vi.fn() }} />);
    expect(screen.queryByText(/read her note as new facts/)).toBeNull();
    expect(screen.getByText('Correct the fact yourself: one click, and the repair still runs live.')).toBeTruthy();
    // The way forward leads; approving the unchanged documents stays possible, as a plain button.
    expect(screen.getByRole('button', { name: 'Correct this fact' }).className).toBe('btn primary');
    expect(screen.getByRole('button', { name: 'Approve the supporting evidence, version 1' }).className).toBe('btn');
  });

  it('before her note’s facts are checked, sets them aside and opens the correction, so it is not listed twice', async () => {
    const ws = afterNote();
    ws.applicant.facts[1] = { ...ws.applicant.facts[1], status: 'proposed' };
    const onDecideFact = vi.fn(async () => ({}));
    render(<GuidedChange workspace={ws} view={{ next: 'facts', citations: { f9: 9 }, approvals: {} }} sample={ana} voice={false} handlers={{ onDecideFact, onCorrectFact: vi.fn(), onApprove: vi.fn(), onConfirmFacts: vi.fn() }} />);
    expect(screen.getByText('The model read her note as new facts, not as a correction. Correct the fact yourself instead: the facts read from the note are set aside, and the repair still runs live.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Correct this fact instead' }));
    expect(await screen.findByText('Fact [9] says')).toBeTruthy();
    expect(onDecideFact).toHaveBeenCalledTimes(1);
    expect(onDecideFact).toHaveBeenCalledWith('f20', 'reject');
    expect(screen.getByText('the night shifts were two years, not three; in the last year I moved to days.'.replace(/^t/, 'T'))).toBeTruthy();
  });

  it('offers it to Ellie too, whose remembered correction is in English', () => {
    const ellie = { id: 'ellie', name: 'Ellie', possessive: 'her', correction: { anchor: 'Helm change', text: 'My teammate Sam wrote the Helm change; I tested it.' } };
    const ws = afterNote();
    ws.applicant.facts = [{ id: 'f12', status: 'confirmed', sourceId: 's1', quote: 'I wrote the Helm change that fixed it.', statement: 'Ellie wrote the Helm change.' }, { id: 'f20', status: 'confirmed', sourceId: 's3', quote: 'My teammate Sam wrote it', statement: 'Sam wrote it.' }];
    const onCorrectFact = vi.fn();
    render(<GuidedChange workspace={ws} view={{ ...nothingCorrected, citations: { f12: 11 } }} sample={ellie} voice={false} handlers={{ onCorrectFact, onApprove: vi.fn() }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Correct this fact' }));
    fireEvent.click(screen.getByRole('button', { name: 'Correct this fact' }));
    expect(onCorrectFact).toHaveBeenCalledWith('f12', 'My teammate Sam wrote the Helm change; I tested it.');
  });
});

// The clip, then Meta's reply with these words; anything else fails loudly.
function voiceReply(text) {
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    if (String(url).startsWith('/samples/')) return new Response(new Uint8Array([82, 73, 70, 70]), { status: 200 });
    if (String(url).startsWith('/api/voice')) return new Response(JSON.stringify({ text, durationMs: 58840, model: 'muse-voice-transcribe-1.0' }), { status: 200, headers: { 'content-type': 'application/json' } });
    throw new Error(`unexpected fetch ${url}`);
  }));
}
// The opening of her voice note as Muse Voice Transcribe heard it in the 3 Nov judge run.
const HEARD = 'Chamome Ana. Eu Eu trabalho há três anos num lar em Leeds. No No fim do turno, escrevo as daily notes e assino a folha da da medicação.';
const CLEANED = 'Chamome Ana. Eu trabalho há três anos num lar em Leeds. No fim do turno, escrevo as daily notes e assino a folha da medicação.';
const fresh = { applicant: { sources: [], facts: [] }, application: { form } };

describe('2 · words Voice Transcribe repeated', () => {
  it('names them under her words, and removes them only when she taps', async () => {
    voiceReply(HEARD);
    const onRead = vi.fn();
    render(<SpokenStart sample={{ ...ana, notes: 'x' }} view={{}} workspace={fresh} isMeta live onRead={onRead} />);
    const box = await screen.findByLabelText('Her words, as Meta heard them');
    expect(box.value).toBe(HEARD);
    expect(document.querySelector('.repeated-words').textContent).toBe('Muse Voice Transcribe wrote 3 repeats: “Eu Eu”, “No No”, “da da”. Remove the repeats · or fix them yourself above.');
    fireEvent.click(screen.getByRole('button', { name: 'Remove the repeats' }));
    expect(box.value).toBe(CLEANED);
    expect(document.querySelector('.repeated-words')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Read Ana’s words' }));
    expect(onRead).toHaveBeenCalledWith(CLEANED);
  });

  it('says nothing under her written note, and nothing when no word repeats', async () => {
    render(<SpokenStart sample={{ ...ana, notes: HEARD }} view={{}} workspace={fresh} live={false} openWeight onRead={vi.fn()} />);
    expect(screen.getByLabelText('Ana’s written note, in Portuguese').value).toBe(HEARD);
    expect(document.querySelector('.repeated-words')).toBeNull();
    cleanup();
    voiceReply(CLEANED);
    render(<SpokenStart sample={{ ...ana, notes: 'x' }} view={{}} workspace={fresh} isMeta live onRead={vi.fn()} />);
    await screen.findByLabelText('Her words, as Meta heard them');
    expect(screen.queryByRole('button', { name: 'Remove the repeats' })).toBeNull();
  });

  it('is offered under her spoken correction too', async () => {
    voiceReply('Correção: os os turnos da noite foram dois anos.');
    const ws = { prepared, applicant: { name: 'Ana', sources: [], facts: [f9] }, application: { form, documents: {}, repair: null, lastRepair: null } };
    render(<GuidedChange workspace={ws} view={{ citations: { f9: 9 } }} sample={ana} voice handlers={{ onAddNotes: vi.fn() }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Use Ana’s spoken correction' }));
    await waitFor(() => expect(screen.getByLabelText('Ana’s correction').value).toBe('Correção: os os turnos da noite foram dois anos.'));
    expect(document.querySelector('.repeated-words').textContent).toMatch(/^Muse Voice Transcribe wrote 1 repeat: “os os”\./);
    fireEvent.click(screen.getByRole('button', { name: 'Remove the repeats' }));
    expect(screen.getByLabelText('Ana’s correction').value).toBe('Correção: os turnos da noite foram dois anos.');
  });
});

// Her export pack as the server builds it, and as the app shows it for a sample run.
const exported = {
  status: 'NOT SUBMITTED', notice: 'Prepared with ApplyArc Evidence. Nothing has been submitted.', createdAt: '2026-11-03T23:05:00.000Z', applicant: 'Ana',
  application: { company: 'North Yorkshire Council', role: 'Care and Support Worker', url: 'https://example.test/advert', snapshotFetchedAt: '2026-11-03T12:00:00.000Z' },
  documents: [{ id: 'answer', title: 'Supporting evidence', revision: 2, words: 214, wordLimit: 500, text: 'I did two years of night shifts.', sentences: [{ text: 'I did two years of night shifts.', refs: [1], startsParagraph: true }], references: [{ n: 1, statement: 'The night shifts were two years.', quote: NOTE, from: 'correction', language: 'pt-PT', actor: 'self' }] }],
  portalTasks: [],
};
const spokenWs = { applicant: { name: 'Ana', sources: [{ id: 's1', kind: 'notes', spoken: true }] } };
const writtenWs = { applicant: { name: 'Ana', sources: [{ id: 's1', kind: 'notes' }] } };

describe('3 · the pack and the Evidence Pass say NOT SUBMITTED and fictional', () => {
  it('names a fictional applicant, and her synthetic voice only when her words were spoken', () => {
    expect(demoLabel(ana, spokenWs)).toBe('Synthetic voice, fictional applicant');
    expect(demoLabel(ana, writtenWs)).toBe('Fictional applicant');
    expect(demoLabel({ name: 'Ellie' }, spokenWs)).toBe('Fictional applicant');
    expect(demoLine(ana, spokenWs)).toBe('Demo: synthetic voice, fictional applicant.');
  });

  it('stamps the Evidence Pass NOT SUBMITTED and carries the demo line, before its intro', () => {
    const doc = new DOMParser().parseFromString(evidencePassHtml({ ...exported, demo: demoLine(ana, spokenWs) }, { drafter: 'Meta Muse Spark Open on Modal' }), 'text/html');
    const header = [...doc.querySelector('header').children].map((e) => [e.className || e.tagName, e.textContent]);
    expect(header.slice(1, 3)).toEqual([['stamp', 'NOT SUBMITTED'], ['demo', 'Demo: synthetic voice, fictional applicant.']]);
    expect(header[3][0]).toBe('intro');
    expect(new DOMParser().parseFromString(evidencePassHtml({ ...exported, demo: '<b>x</b>' }), 'text/html').querySelector('.demo b')).toBeNull();
  });

  it('adds the demo line to the pack after its notice, and shows it in the dialog it downloads from', () => {
    const shown = { ...exported, demo: demoLine(ana, spokenWs) };
    const md = packMarkdown(shown).split('\n');
    expect(md.slice(0, 5)).toEqual(['# NOT SUBMITTED: North Yorkshire Council · Care and Support Worker', '', exported.notice, '', 'Demo: synthetic voice, fictional applicant.']);
    expect(packMarkdown(exported)).not.toContain('Demo:');
    const onDownload = vi.fn();
    const onDownloadPass = vi.fn();
    render(<ExportDialog pack={shown} onClose={vi.fn()} onCopy={vi.fn()} onDownload={onDownload} onDownloadPass={onDownloadPass} />);
    expect(screen.getByText('Demo: synthetic voice, fictional applicant.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Download the pack (.md)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Download Evidence Pass' }));
    expect(onDownload).toHaveBeenCalledWith(shown);
    expect(onDownloadPass).toHaveBeenCalledWith(shown);
  });
});

describe('4 · the walk-through always says who this is', () => {
  it('tags every step with the fictional applicant, and keeps the step line as it was', () => {
    const { rerender } = render(<GuidedRun view={{ next: 'read' }} workspace={{ ...spokenWs, application: { form } }} sampleName="Ana" sample={ana} isMeta onExit={vi.fn()}>body</GuidedRun>);
    expect(document.querySelector('.guided-demo').textContent).toBe('Synthetic voice, fictional applicant · nothing is submitted');
    expect(screen.getByText('Step 1 of 4')).toBeTruthy();
    rerender(<GuidedRun view={{ next: 'export' }} workspace={afterNote()} sampleName="Ana" sample={ana} isMeta onExit={vi.fn()}>body</GuidedRun>);
    expect(document.querySelector('.guided-demo').textContent).toBe('Synthetic voice, fictional applicant · nothing is submitted');
    rerender(<GuidedRun view={{ next: 'read' }} workspace={{ ...writtenWs, application: { form } }} sampleName="Ana" sample={ana} isMeta onExit={vi.fn()}>body</GuidedRun>);
    expect(document.querySelector('.guided-demo').textContent).toBe('Fictional applicant · nothing is submitted');
  });

  it('is on her spoken start too, before any words are in', () => {
    render(<SpokenStart sample={{ ...ana, notes: 'x' }} view={{}} workspace={fresh} live={false} openWeight onRead={vi.fn()} />);
    expect(document.querySelector('.guided-demo').textContent).toBe('Fictional applicant · nothing is submitted');
  });
});

// Her voice note read, its first fact waiting to be confirmed (and an English one, as Ellie's are).
function proposed(fact) {
  return { applicant: { name: 'Ana', sources: [{ id: 's1', kind: 'notes', text: 'x', language: 'pt-PT', spoken: true, read: true }], facts: [{ status: 'proposed', sourceId: 's1', requirementIds: [], ...fact }] }, application: { form, coverage: {}, questions: [] } };
}
const ptFact = { id: 'f1', language: 'pt-PT', actor: 'self', quote: 'Eu trabalho há três anos num lar em Leeds.', statement: 'I have worked for 3 years in a care home in Leeds.' };
const sourceLine = () => document.querySelector('.fact-card .fact-source').textContent;

describe('5 · her fact card speaks of her, as the headline does', () => {
  it('says "From her voice note · Ana did this" in the walk-through', () => {
    render(<GuidedBody stepKey="facts" workspace={proposed(ptFact)} view={{ next: 'facts' }} busy={null} sample={ana} handlers={{}} />);
    expect(sourceLine()).toBe('From her voice note · Ana did this');
    cleanup();
    render(<GuidedBody stepKey="facts" workspace={proposed({ ...ptFact, actor: 'team' })} view={{ next: 'facts' }} busy={null} sample={ana} handlers={{}} />);
    expect(sourceLine()).toBe('From her voice note · The team did this');
  });

  it('keeps an English card and the full workspace as they were', () => {
    render(<GuidedBody stepKey="facts" workspace={proposed({ id: 'f1', quote: 'I wrote the Helm patch.', statement: 'Ellie wrote the Helm patch.' })} view={{ next: 'facts' }} busy={null} sample={{ name: 'Ellie', possessive: 'her' }} handlers={{}} />);
    expect(sourceLine()).toBe('From your voice note');
    cleanup();
    render(<FactsPanel workspace={proposed(ptFact)} view={{ next: 'facts' }} busy={null} />);
    expect(sourceLine()).toBe('From your voice note · You did this');
  });
});

describe('6 · one main button per screen, and her application named as such', () => {
  it('makes "Review updated documents" secondary beside the approvals', () => {
    const ws = afterNote();
    ws.application.lastRepair = { factId: 'f9', changed: 2, at: '2026-11-03T23:02:00.000Z' };
    render(<GuidedChange workspace={ws} view={nothingCorrected} sample={ana} voice={false} handlers={{ onApprove: vi.fn(), onReview: vi.fn() }} />);
    expect(screen.getByRole('button', { name: 'Review updated documents' }).className).toBe('btn');
    expect(screen.getAllByRole('button', { name: /^Approve the/ }).map((b) => b.className)).toEqual(['btn primary', 'btn primary']);
  });

  it('writes "her application" for a sample in another language, and Ellie keeps "her answer"', () => {
    const draft = { applicant: { sources: [{ id: 's1', kind: 'notes', read: true }], facts: [] }, application: { form } };
    const { rerender } = render(<GuidedRun view={{ next: 'draft' }} workspace={draft} sampleName="Ana" sample={ana} onPrimary={vi.fn()} onExit={vi.fn()}>body</GuidedRun>);
    expect(screen.getByRole('button', { name: 'Write her application' })).toBeTruthy();
    rerender(<GuidedRun view={{ next: 'draft' }} workspace={draft} sampleName="Ellie" sample={{ name: 'Ellie', possessive: 'her' }} onPrimary={vi.fn()} onExit={vi.fn()}>body</GuidedRun>);
    expect(screen.getByRole('button', { name: 'Write her answer' })).toBeTruthy();
  });
});

describe('7 · a corrected fact does not start with "Correction:"', () => {
  it('prefills the English meaning without the label, keeps her words verbatim, in a shorter box', async () => {
    const offer = { questionId: 'q2', sourceId: 's3', factId: 'f9', before: f9.quote, text: NOTE, meaning: ana.correction.meaning, actor: 'self' };
    const question = { id: 'q2', kind: 'source-conflict', status: 'open', language: 'pt-PT', text: 'Foram dois anos ou três?', english: 'Was it two years or three?', quote: NOTE, priorQuote: f9.quote, meaning: ana.correction.meaning, actor: 'self' };
    const onResolve = vi.fn(async () => ({}));
    render(<SourceCorrectionCard offer={offer} question={question} busy={false} onResolve={onResolve} onAnswer={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.getByLabelText('Your correction').value).toBe(NOTE);
    expect(screen.getByLabelText('Your correction').getAttribute('rows')).toBe('3');
    expect(screen.getByLabelText('In English (working translation)').value).toBe('The night shifts were two years, not three; in the last year I moved to days.');
    fireEvent.click(screen.getByRole('button', { name: 'Use this correction' }));
    await waitFor(() => expect(onResolve).toHaveBeenCalledWith({ questionId: 'q2', sourceId: 's3', factId: 'f9', text: NOTE, meaning: 'The night shifts were two years, not three; in the last year I moved to days.', actor: 'self' }));
  });

  it('sends the plain meaning on the typed route too, and leaves a meaning without the label alone', () => {
    const onCorrectFact = vi.fn();
    render(<GuidedChange workspace={afterNote()} view={nothingCorrected} sample={ana} voice={false} handlers={{ onCorrectFact, onApprove: vi.fn() }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Correct this fact' }));
    fireEvent.click(screen.getByRole('button', { name: 'Correct this fact' }));
    expect(onCorrectFact).toHaveBeenCalledWith('f9', NOTE, { meaning: 'The night shifts were two years, not three; in the last year I moved to days.', actor: 'self' });
    cleanup();
    render(<SourceCorrectionCard offer={{ questionId: 'q2', sourceId: 's3', factId: 'f9', text: NOTE, meaning: 'It was two years.', actor: 'self' }} question={{ id: 'q2', kind: 'source-conflict', status: 'open', text: 'x?', quote: NOTE, priorQuote: f9.quote }} busy={false} onResolve={vi.fn()} onAnswer={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.getByLabelText('In English (working translation)').value).toBe('It was two years.');
  });
});

describe('8 · the finish of a spoken run says so', () => {
  const finished = (spoken) => ({
    applicant: { name: 'Ana', sources: [{ id: 's1', kind: 'notes', text: 'Eu trabalho há três anos num lar em Leeds.', language: 'pt-PT', ...(spoken ? { spoken: true } : {}) }], facts: [f9] },
    application: { form, documents: {}, questions: [], lastRepair: null },
  });
  const notesRow = () => document.querySelector('.guided-summary-row dd').textContent;

  it('counts her words spoken in Portuguese, or her written notes', () => {
    const { rerender } = render(<FinishList workspace={finished(true)} possessive="her" onReview={vi.fn()} />);
    expect(notesRow()).toBe('9 words spoken in Portuguese');
    rerender(<FinishList workspace={finished(false)} possessive="her" onReview={vi.fn()} />);
    expect(notesRow()).toBe('9 words of rough notes');
  });

  it('says each English meaning is a working translation she confirmed, for facts in her language only', () => {
    expect(happenedLines(finished(true), { approvals: {} }, []).slice(0, 2)).toEqual(['1 fact confirmed.', 'Each English meaning is a working translation Ana confirmed.']);
    const english = finished(true);
    english.applicant.facts = [{ id: 'f1', status: 'confirmed', quote: 'I wrote it.', statement: 'Ellie wrote it.' }];
    expect(happenedLines(english, { approvals: {} }, [])).toEqual(['1 fact confirmed.', 'Nothing has been sent.']);
  });
});

describe('9 · the open-weight edition says what it does', () => {
  const OPEN = 'meta-models/Muse-Spark-Open-816B-A42B';
  const withPrepared = { ...ana, prepared };

  it('offers her written note when there is no live voice, and her voice note when there is', () => {
    const { rerender } = render(<SampleCards samples={[ana]} liveModel voice={false} onStart={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Try it with Ana’s written note' })).toBeTruthy();
    rerender(<SampleCards samples={[ana]} liveModel voice onStart={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Try it with Ana’s voice note' })).toBeTruthy();
  });

  it('names Muse Spark Open at the key moment, says it may read the note as new facts, and where the state was prepared', () => {
    const ws = { ...afterNote(), applicant: { ...afterNote().applicant, sources: afterNote().applicant.sources.slice(0, 1) } };
    const { rerender } = render(<GuidedRun view={{ next: 'export' }} workspace={ws} sampleName="Ana" sample={withPrepared} isMeta model={OPEN} onExit={vi.fn()}>body</GuidedRun>);
    expect(document.querySelector('.guided-why').textContent).toBe('Add Ana’s note. Muse Spark Open reads it against her confirmed facts: it may flag the contradiction itself, or read the note as new facts, and then you correct the fact yourself. Only the sentences that cite that fact reopen, and you decide each rewrite.');
    expect(document.querySelector('.guided-expect').textContent).toBe('Her facts and both drafts were prepared on the Muse Wonder link on 3 Nov, before this visit. The correction and the repair run live now.');
    rerender(<GuidedRun view={{ next: 'export' }} workspace={ws} sampleName="Ana" sample={withPrepared} isMeta model="muse-wonder-1.0" onExit={vi.fn()}>body</GuidedRun>);
    expect(document.querySelector('.guided-why').textContent).toBe('Add Ana’s note. Meta reads it against her confirmed facts, flags the contradiction itself and offers the correction. Only the sentences that cite that fact reopen, and you decide each rewrite.');
    expect(document.querySelector('.guided-expect').textContent).toBe('Her facts and both drafts were prepared from a real Muse Wonder run on 3 Nov, before this visit. The correction and the repair run live now.');
  });

  it('says the same on her card, in What Meta did and on the finish', () => {
    render(<SampleCards samples={[withPrepared]} liveModel voice={false} model={OPEN} onStart={vi.fn()} onStartPrepared={vi.fn()} />);
    expect(screen.getByText(/^Her facts are confirmed and both documents approved, prepared on the Muse Wonder link on 3 Nov\./)).toBeTruthy();
    cleanup();
    render(<ReceiptsDrawer receipts={[]} modeLabel="Meta Muse Spark Open on Modal" mode={{ id: 'compatible', model: OPEN, isMeta: true }} workspace={afterNote()} view={{ approvals: {} }} />);
    expect(document.querySelector('.receipts-prepared').textContent).toBe('Facts and drafts: prepared on the Muse Wonder link on 3 Nov, before this visit and not counted here · Correction and repair: live in this visit');
    const repair = { step: 'repair', flow: 'repair', provider: 'compatible', isMeta: true, model: OPEN, costUsd: 0.01, totalMs: 1000, toolCalls: [], at: '2026-11-03T23:02:00.000Z' };
    expect(happenedLines(afterNote(), { approvals: {} }, [repair])).toContain('Those facts and both drafts were prepared on the Muse Wonder link on 3 Nov, before this visit.');
    expect(happenedLines(afterNote(), { approvals: {} }, [{ ...repair, provider: 'meta', model: 'muse-wonder-1.0' }])).toContain('Those facts and both drafts were prepared from a real Muse Wonder run on 3 Nov, before this visit.');
  });
});

describe('10 · the question row and Ana’s key-moment card', () => {
  it('lets the answer row wrap whole, with the clip’s caption and messages unbroken', () => {
    const css = readFileSync(fromRoot('client', 'src', 'components', 'QuestionCard.css'), 'utf8');
    const buttons = readFileSync(fromRoot('client', 'src', 'styles', 'buttons.css'), 'utf8');
    expect(css).toMatch(/\.question-card \.question-actions \{\n  display: flex;\n  flex-wrap: wrap;/);
    expect(buttons.indexOf('.question-card .question-actions .btn { white-space: nowrap; }')).toBeGreaterThan(-1);
    expect(buttons.indexOf('.question-card .question-actions .btn')).toBeLessThan(buttons.indexOf('.source-correction .question-actions .btn'));
    expect(css).toContain('.question-card .question-actions .speak-status { flex-basis: 100%; }');
    // 4 Nov live checks: the offer above her note's facts touched the fact card.
    expect(readFileSync(fromRoot('client', 'src', 'components', 'GuidedRun.css'), 'utf8')).toContain('.guided-typed-offer { margin-bottom: var(--s5); }');
    expect(css).toContain('.question-card .clip-note { font-size: var(--text-xs); color: var(--muted); white-space: nowrap; }');
  });

  it('says her key moment takes about a minute, from the measured runs', async () => {
    const app = buildApp({ dataDir: mkdtempSync(join(tmpdir(), 'polish-')), env: {} });
    const served = (await (await app.request('/api/sample')).json()).samples.find((s) => s.id === 'ana');
    expect(served.keyTiming).toBe('About a minute.');
    render(<SampleCards samples={[{ ...served, prepared }]} liveModel voice onStart={vi.fn()} onStartPrepared={vi.fn()} />);
    expect(screen.getByText('Her facts are confirmed and both documents approved, prepared from a real Muse Wonder run on 3 Nov. You make the one correction; the repair runs live. About a minute.')).toBeTruthy();
  });
});

describe('what must not be claimed', () => {
  it('says the council’s advert is public, not a partner, right after its citation, and once', () => {
    const thesis = { quote: 'Using AI? Please follow our guidance to ensure your application reflects your own knowledge and experience', source: 'North Yorkshire Council’s care advert, captured 3 Nov 2026', url: 'https://example.test/advert' };
    render(<NotesView sources={[]} facts={[]} questions={[]} samples={[{ ...ana, thesis }]} liveModel voice model="muse-wonder-1.0" sampleNotes="x" company="North Yorkshire Council" onStartSample={vi.fn()} />);
    expect(document.querySelector('.notes-thesis-source').textContent).toBe('North Yorkshire Council’s care advert, captured 3 Nov 2026 · a public advert, not a partner or endorser');
    expect(document.body.textContent.match(/not a partner/g)).toHaveLength(1);
    expect(screen.getByText(/^In England and Wales, 880,000 people could not speak English well/).textContent).toBe('In England and Wales, 880,000 people could not speak English well (ONS, Census 2021).');
  });

  it('says there is nothing to check when none of her sentences is her own wording', () => {
    const saved = JSON.parse(readFileSync(fromRoot('fixtures', 'ana-prepared-wonder-20261103.json'), 'utf8'));
    const own = verifyRun(preparedWorkspace(saved), []).find((c) => c.id === 'own');
    expect(own).toMatchObject({ pass: true, count: 0, text: 'No sentences in Ana’s own wording (none to check)' });
  });

  // 4 Nov (Adrian): no spend counter in the bar for judges; each run's cost stays in What Meta did.
  it('shows no demo spend counter in the top bar, on either link', () => {
    render(<TopBar company="North Yorkshire Council" role="Care and Support Worker" mode={{ id: 'compatible', label: 'Meta Muse Spark Open on Modal', model: 'meta-models/Muse-Spark-Open-816B-A42B', isMeta: true }} budget={{ spentUsd: 0.7, reservedUsd: 0.081, capUsd: 80 }} onCommands={vi.fn()} onReset={vi.fn()} onReceipts={vi.fn()} />);
    expect(document.querySelector('.spend')).toBeNull();
    expect(document.querySelector('.topbar').textContent).not.toMatch(/spend|\$\d/i);
  });
});

// 4 Nov live check: stutters reached the pack from the spoken answer and the spoken correction.
describe('repeats are offered wherever her spoken words can be edited', () => {
  const offer = { questionId: 'q1', sourceId: 's3', factId: 'f9', text: 'Os turnos da noite foram noite foram dois anos, não três.', meaning: 'Correction, the night shifts were two years, not three.', actor: 'self', before: 'Fiz três anos de noites.' };
  const question = { id: 'q1', kind: 'source-conflict', text: 'Dois anos ou três anos?', why: 'x' };

  it('on a spoken correction: names the two-word repeat, removes it on tap, and drops the "Correction," prefix', () => {
    render(<SourceCorrectionCard offer={offer} question={question} busy={false} onResolve={vi.fn()} onAnswer={vi.fn()} onSkip={vi.fn()} spoken />);
    expect(screen.getByText(/wrote 1 repeat: “noite foram noite foram”/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove the repeats' }));
    expect(screen.getByLabelText('Your correction').value).toBe('Os turnos da noite foram dois anos, não três.');
    expect(screen.getByDisplayValue('The night shifts were two years, not three.')).toBeTruthy();
  });

  it('never on a written correction', () => {
    render(<SourceCorrectionCard offer={offer} question={question} busy={false} onResolve={vi.fn()} onAnswer={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Remove the repeats' })).toBeNull();
  });
});

// 4 Nov (Adrian's final pass): the key-moment route shows its Verify result on the finish screen, the rewrite
// in progress says what is happening, and her note's Add button appears only once there is something to add.
describe('final judge pass', () => {
  it('runs Verify this run on the finish screen by itself', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (String(url).startsWith('/api/verify')) return new Response(JSON.stringify({ revision: 7, checks: [{ id: 'quotes', pass: true, count: 19, text: '19 of 19 confirmed facts quote Ana’s text word for word', failures: [] }] }), { status: 200, headers: { 'content-type': 'application/json' } });
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<GuidedBody stepKey="finish" workspace={{ ...afterNote(), revision: 7 }} view={{ approvals: {} }} modeLabel="Muse Wonder" handlers={{}} />);
    expect(await screen.findByText('19 of 19 confirmed facts quote Ana’s text word for word')).toBeTruthy();
    expect(screen.getByText('Checked by code, with no model call')).toBeTruthy();
  });

  it('says the rewrite is in progress, not just waiting', () => {
    const css = readFileSync(fromRoot('client', 'src', 'components', 'ChangeQueue.css'), 'utf8');
    expect(css).toContain('.queue .chip.waiting::before');
    expect(readFileSync(fromRoot('client', 'src', 'components', 'ChangeQueue.jsx'), 'utf8')).toContain("{ cls: 'waiting', text: 'Rewriting…' }");
  });
});
