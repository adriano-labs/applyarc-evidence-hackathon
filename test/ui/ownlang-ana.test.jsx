// @vitest-environment jsdom
// Ana's path on screen: her card leads the welcome, her voice note goes to Muse Voice Transcribe
// before anything is read, her Portuguese comes first on every card with the English meaning beneath,
// the question and the correction come in her language, and the form's own titles are used.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SampleCards } from '../../client/src/components/SampleCards.jsx';
import { SpokenStart } from '../../client/src/components/SpokenStart.jsx';
import { FactsReview } from '../../client/src/components/FactsReview.jsx';
import { QuestionCard } from '../../client/src/components/QuestionCard.jsx';
import { SourceCorrectionCard } from '../../client/src/components/SourceCorrectionCard.jsx';
import { GuidedChange } from '../../client/src/components/GuidedChange.jsx';
import { GuidedRun } from '../../client/src/components/GuidedRun.jsx';
import { ChangeQueue } from '../../client/src/components/ChangeQueue.jsx';
import { DroppedWordingNotice } from '../../client/src/components/DroppedWordingNotice.jsx';
import { NotesView } from '../../client/src/components/NotesView.jsx';
import { ReceiptsDrawer } from '../../client/src/components/ReceiptsDrawer.jsx';
import { buildCommands } from '../../client/src/commands.js';
import { isSampleRun } from '../../client/src/flow.js';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const form = { id: 'nyc', company: 'North Yorkshire Council', role: 'Care and Support Worker', documents: [
  { id: 'answer', title: 'Supporting evidence', wordLimit: 500, requirements: Array.from({ length: 10 }, (_, i) => ({ id: `r${i}`, text: `Point ${i}` })) },
  { id: 'letter', title: 'Cover letter', wordLimit: 350, requirements: [] }] };
const ana = {
  id: 'ana', name: 'Ana', possessive: 'her', field: 'Care worker', language: 'pt-PT', liveOnly: false, formId: 'nyc', form,
  notes: 'Chamo-me Ana. Trabalho há três anos num lar em Leeds.', answer: 'Para mim, dignidade é bater à porta.',
  correction: { quote: 'Fiz três anos de noites.', text: 'Correção: foram dois anos.', meaning: 'Correction: it was two years.', actor: 'self', anchor: ['noites'] },
  clips: { notes: '/samples/n.wav', answer: '/samples/a.wav', correction: '/samples/c.wav' },
  voice: 'Synthetic voice, fictional applicant', blurb: 'North Yorkshire Council’s “Supporting evidence” for a Care and Support Worker.', voiceHint: true,
  thesis: { quote: 'Using AI? Please follow our guidance to ensure your application reflects your own knowledge and experience', source: 'North Yorkshire Council’s care advert, captured 3 Nov 2026', url: 'https://example.test/advert' },
};
const ellie = { id: 'ellie', name: 'Ellie', possessive: 'her', field: 'Graduate engineer', liveOnly: false, prepared: { model: 'muse-wonder-1.0', ranAt: '2026-11-03T16:03:18.705Z' }, form: { company: 'Graphcore', documents: [{ id: 'answer', title: 'Project answer', wordLimit: 300 }] } };

// The clip, then Meta's reply; anything else fails loudly.
function voiceServer(reply = { text: 'Szemmien. Trabalha há três anos num lar em Leeds.', durationMs: 58840, model: 'muse-voice-transcribe-1.0' }, status = 200) {
  const calls = [];
  vi.stubGlobal('fetch', vi.fn(async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).startsWith('/samples/')) return new Response(new Uint8Array([82, 73, 70, 70]), { status: 200 });
    if (String(url).startsWith('/api/voice')) return new Response(JSON.stringify(status === 200 ? reply : { error: { code: 'limit', message: 'Too many requests' } }), { status, headers: { 'content-type': 'application/json' } });
    throw new Error(`unexpected fetch ${url}`);
  }));
  return calls;
}

describe('the welcome', () => {
  it('puts the spoken sample first with its own line, and Ellie’s key moment before her full run', () => {
    const onStart = vi.fn();
    render(<SampleCards samples={[ellie, ana]} liveModel voice onStart={onStart} onStartPrepared={vi.fn()} />);
    const cards = document.querySelectorAll('.sample-card');
    expect(cards[0].querySelector('strong').textContent).toBe('Ana · Care worker · speaks Portuguese');
    expect(within(cards[0]).getByText(ana.blurb)).toBeTruthy();
    const primary = within(cards[0]).getByRole('button', { name: 'Try it with Ana’s voice note' });
    expect(primary.className).toMatch(/\bprimary\b/);
    expect(within(cards[0]).getByText('Fictional applicant. Synthetic voice, made before the demo; not a runtime model. Nothing is sent.')).toBeTruthy();
    const ellieButtons = within(cards[1]).getAllByRole('button').map((b) => [b.textContent, b.className]);
    expect(ellieButtons).toEqual([['Start at the key moment', 'btn'], ['Try it with Ellie’s notes', 'btn link small']]);
    fireEvent.click(primary);
    expect(onStart).toHaveBeenCalledWith('ana');
  });

  it('says where her voice runs on each edition', () => {
    const { rerender } = render(<SampleCards samples={[ana]} liveModel voice={false} onStart={vi.fn()} />);
    expect(screen.getByText(/Spoken notes run on Meta’s API only; on this open-weight edition her written note is used instead\./)).toBeTruthy();
    rerender(<SampleCards samples={[ana]} liveModel={false} onStart={vi.fn()} />);
    expect(screen.getByText(/With no live model, her written note is used \(typed, not spoken\)\./)).toBeTruthy();
    rerender(<SampleCards samples={[{ ...ana, timing: 'About 5 minutes on Muse Wonder: she speaks, you confirm, the correction is the last step.' }]} liveModel voice onStart={vi.fn()} />);
    expect(screen.getByText(/not a runtime model\. About 5 minutes on Muse Wonder: she speaks, you confirm, the correction is the last step\. Nothing is sent\./)).toBeTruthy();
  });

  it('leads with the council’s own line on AI when a sample speaks, and names Meta’s two models', () => {
    render(<NotesView sources={[]} facts={[]} questions={[]} samples={[ana, ellie]} liveModel voice model="muse-wonder-1.0" sampleNotes="x" company="Graphcore" onStartSample={vi.fn()} />);
    expect(screen.getByText('“Using AI? Please follow our guidance to ensure your application reflects your own knowledge and experience”')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'North Yorkshire Council’s care advert, captured 3 Nov 2026' }).getAttribute('href')).toBe('https://example.test/advert');
    expect(screen.getByRole('heading', { level: 2, name: 'Say what you did, in your own language.' })).toBeTruthy();
    expect(within(screen.getByRole('list', { name: 'How it works' })).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Speak in your own language. Muse Voice Transcribe writes it down, and you check the words.',
      'Muse Wonder turns them into facts that quote you word for word, with the English meaning beneath. You confirm both.',
      'Your English application cites those facts. Fix one fact once, and only the sentences that cite it reopen, in both documents.',
    ]);
    expect(screen.getByRole('link', { name: 'ONS, Census 2021' })).toBeTruthy();
  });
});

describe('her voice note, before anything is read', () => {
  it('sends the clip to Muse Voice Transcribe at once, with her language, and reads the words she checked', async () => {
    const calls = voiceServer();
    const onRead = vi.fn();
    render(<SpokenStart sample={ana} view={{}} workspace={{ applicant: { sources: [], facts: [] }, application: { form } }} isMeta live onRead={onRead} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Ana says it in Portuguese');
    const box = await screen.findByLabelText('Her words, as Meta heard them');
    expect(box.value).toBe('Szemmien. Trabalha há três anos num lar em Leeds.');
    expect(calls.map((c) => c.url)).toEqual(['/samples/n.wav', '/api/voice?language=pt-PT&sample=ana']);
    expect(screen.getByText('Transcribed by Muse Voice Transcribe · 59 s of speech · fix any word it misheard; the app changes nothing unless you tap.')).toBeTruthy();
    fireEvent.change(box, { target: { value: 'Chamo-me Ana. Trabalha há três anos num lar em Leeds.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Read Ana’s words' }));
    expect(onRead).toHaveBeenCalledWith('Chamo-me Ana. Trabalha há três anos num lar em Leeds.');
  });

  it('offers her written note, said to be typed, when Meta does not answer', async () => {
    voiceServer(null, 429);
    const onRead = vi.fn();
    render(<SpokenStart sample={ana} view={{}} workspace={{ applicant: { sources: [], facts: [] }, application: { form } }} isMeta live onRead={onRead} />);
    expect((await screen.findByRole('alert')).textContent).toContain('Muse Voice Transcribe did not answer: Too many requests. Her written note can be used instead; it is labelled as typed, not spoken.');
    fireEvent.click(screen.getByRole('button', { name: 'Use her written note' }));
    expect(screen.getByLabelText('Ana’s written note, in Portuguese').value).toBe(ana.notes);
    fireEvent.click(screen.getByRole('button', { name: 'Read Ana’s words' }));
    expect(onRead).toHaveBeenCalledWith(undefined);
  });

  it('calls no voice service without a live voice, and shows her written note to read', () => {
    const calls = voiceServer();
    render(<SpokenStart sample={ana} view={{}} workspace={{ applicant: { sources: [], facts: [] }, application: { form } }} live={false} openWeight onRead={vi.fn()} />);
    expect(calls).toEqual([]);
    expect(screen.getByLabelText('Ana’s written note, in Portuguese').readOnly).toBe(true);
    expect(screen.getByText('Spoken notes run on Meta’s API only. On this open-weight edition her written note is used instead.')).toBeTruthy();
  });
});

const ptFact = { id: 'f8', status: 'proposed', sourceId: 's1', language: 'pt-PT', actor: 'self', quote: 'Eu fiz cartões com fotografias da comida.', statement: 'I made cards with photos of the food.', requirementIds: [] };

describe('a fact in her language', () => {
  it('shows her words first, then the English meaning, then where it came from and who did it', () => {
    render(<FactsReview facts={[ptFact]} total={1} sources={{ s1: 'notes' }} spoken={new Set(['s1'])} onDecide={vi.fn()} />);
    const card = document.querySelector('.fact-card');
    const lines = [...card.querySelectorAll('p')].map((p) => p.textContent);
    expect(lines.slice(0, 3)).toEqual(['“Eu fiz cartões com fotografias da comida.”', 'In English (working translation): I made cards with photos of the food.', 'From your voice note · You did this']);
    expect(card.querySelector('mark').textContent).toBe('Eu fiz cartões com fotografias da comida.');
    expect(card.querySelector('[lang="pt-PT"]')).toBeTruthy();
  });

  it('leaves an English card as it was', () => {
    const fact = { id: 'f1', status: 'proposed', sourceId: 's1', quote: 'I wrote the Helm patch.', statement: 'Ellie wrote the Helm patch.', requirementIds: [] };
    render(<FactsReview facts={[fact]} total={1} sources={{ s1: 'notes' }} spoken={new Set()} onDecide={vi.fn()} />);
    const lines = [...document.querySelectorAll('.fact-card p')].map((p) => p.textContent);
    expect(lines).toEqual(['Ellie wrote the Helm patch.', '“I wrote the Helm patch.”', 'From your notes', 'Enter: yes · Backspace: not right']);
  });
});

describe('the question and the correction, in her language', () => {
  const question = { id: 'q1', requirementId: 'dignity', text: 'Como respeita a dignidade de cada pessoa?', english: 'How do you respect each person’s dignity?', why: 'The form asks it.', status: 'open' };

  it('asks in Portuguese with the English beneath, and fills her spoken answer from its clip', async () => {
    const calls = voiceServer({ text: 'Para mim, dignidade é bater à porta.', durationMs: 16090, model: 'muse-voice-transcribe-1.0' });
    render(<QuestionCard question={question} requirementText="Dignity & Respect" onAnswer={vi.fn()} onSkip={vi.fn()} sample={ana.answer} sampleName="Ana" voice language="pt-PT" hint="pt-PT" clip={ana.clips.answer} clipFrom="ana" />);
    expect(screen.getByText('Como respeita a dignidade de cada pessoa?').getAttribute('lang')).toBe('pt-PT');
    expect(screen.getByText('In English: How do you respect each person’s dignity?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Use Ana’s spoken answer' }));
    await waitFor(() => expect(document.querySelector('#answer-box').value).toBe('Para mim, dignidade é bater à porta.'));
    expect(calls.map((c) => c.url)).toEqual(['/samples/a.wav', '/api/voice?language=pt-PT&sample=ana']);
    expect(screen.getByText('Transcribed by Muse Voice Transcribe · 16 s of speech · check the words before you answer')).toBeTruthy();
  });

  it('shows the model’s question in her language and keeps her checked English meaning in the correction', async () => {
    const conflict = { id: 'q2', kind: 'source-conflict', status: 'open', language: 'pt-PT', text: 'Foram dois anos ou três?', english: 'Was it two years or three?', meaning: 'Correction: it was two years.', actor: 'self', quote: 'Correção: foram dois anos.', priorQuote: 'Fiz três anos de noites.' };
    const offer = { questionId: 'q2', sourceId: 's4', factId: 'f9', before: 'Fiz três anos de noites.', text: 'Correção: foram dois anos.', meaning: 'Correction: it was two years.', actor: 'self' };
    const onResolve = vi.fn(async () => ({}));
    render(<SourceCorrectionCard offer={offer} question={conflict} busy={false} onResolve={onResolve} onAnswer={vi.fn()} onSkip={vi.fn()} />);
    expect(document.querySelector('.conflict-question .question-text').textContent).toBe('Foram dois anos ou três?');
    expect(screen.getByText('In English: Was it two years or three?')).toBeTruthy();
    expect(screen.queryByText('These details may not agree. What should I use?')).toBeNull();
    const meaning = screen.getByLabelText('In English (working translation)');
    expect(meaning.value).toBe('It was two years.');
    expect(screen.queryByRole('radio')).toBeNull();
    fireEvent.change(meaning, { target: { value: 'Correction: the nights were two years.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use this correction' }));
    await waitFor(() => expect(onResolve).toHaveBeenCalledWith({ questionId: 'q2', sourceId: 's4', factId: 'f9', text: 'Correção: foram dois anos.', meaning: 'Correction: the nights were two years.', actor: 'self' }));
  });
});

const drafted = (prepared = null) => ({
  prepared,
  applicant: { name: 'Ana', sources: [{ id: 's1', kind: 'notes', text: 'x', language: 'pt-PT', spoken: true }], facts: [{ id: 'f9', status: 'confirmed', language: 'pt-PT', actor: 'self', quote: 'Fiz três anos de noites.', statement: 'I did three years of nights.', sourceId: 's1' }] },
  application: { form, documents: { answer: { revision: 1, segments: [] }, letter: { revision: 1, segments: [] } }, repair: null, lastRepair: null },
});

describe('the key moment for a sample who speaks', () => {
  it('says the correction on the live model, and keeps typing it one link away', async () => {
    voiceServer({ text: 'Correção: foram dois anos.', durationMs: 7160, model: 'muse-voice-transcribe-1.0' });
    const onAddNotes = vi.fn();
    render(<GuidedChange workspace={drafted()} view={{ citations: { f9: 9 } }} sample={ana} voice handlers={{ onAddNotes, onCorrectFact: vi.fn() }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Use Ana’s spoken correction' }));
    await waitFor(() => expect(screen.getByLabelText('Ana’s correction').value).toBe('Correção: foram dois anos.'));
    fireEvent.click(screen.getByRole('button', { name: 'Add Ana’s note' }));
    expect(onAddNotes).toHaveBeenCalledWith('Correção: foram dois anos.', { spoken: true });
    fireEvent.click(screen.getByRole('button', { name: 'Show the written correction' }));
    expect(screen.getByRole('button', { name: 'Correct this fact' })).toBeTruthy();
  });

  it('corrects the fact with its English meaning and who did it on the fixture', () => {
    const onCorrectFact = vi.fn();
    render(<GuidedChange workspace={drafted()} view={{ citations: { f9: 9 } }} sample={ana} voice={false} handlers={{ onCorrectFact }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Correct this fact' }));
    expect(onCorrectFact).toHaveBeenCalledWith('f9', 'Correção: foram dois anos.', { meaning: 'It was two years.', actor: 'self' });
  });

  it('opens the walk-through for her spoken words, which never equal the written note', () => {
    const ws = drafted();
    expect(isSampleRun(ws, ana)).toBe(true);
    expect(isSampleRun({ ...ws, applicant: { ...ws.applicant, name: null } }, ana)).toBe(false);
    expect(isSampleRun({ applicant: { name: 'Ellie', sources: [{ kind: 'notes', text: 'mine' }] } }, { name: 'Ellie', notes: 'hers' })).toBe(false);
  });

  it('names her words as Meta heard them, or her written note, in the walk-through', () => {
    const { rerender } = render(<GuidedRun view={{ next: 'read' }} workspace={drafted()} sampleName="Ana" sample={ana} isMeta onExit={vi.fn()}>body</GuidedRun>);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Ana’s words, as Meta heard them');
    rerender(<GuidedRun view={{ next: 'read' }} workspace={drafted()} sampleName="Ana" sample={{ ...ana, minutes: 2 }} isMeta onExit={vi.fn()}>body</GuidedRun>);
    expect(screen.getByText('Meta’s models hear, read, ask, write, check and repair (about 2 minutes in all in our live runs), and you decide every step. Watch each step in “What Meta did” below.')).toBeTruthy();
    const written = drafted();
    delete written.applicant.sources[0].spoken;
    rerender(<GuidedRun view={{ next: 'read' }} workspace={written} sampleName="Ana" sample={ana} isMeta onExit={vi.fn()}>body</GuidedRun>);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Ana’s notes, in Portuguese');
    expect(screen.getByText('Her written note is used here (typed, not spoken).')).toBeTruthy();
  });
});

describe('the form’s own titles', () => {
  it('labels the queue, the left-out wording and the commands with the council’s document names', () => {
    const repair = { factId: 'f9', status: 'review', items: [{ id: 'c1', docId: 'answer', segmentId: 'answer-3', before: 'I did three years of nights.', after: 'I did two years of nights.', status: 'proposed', decision: null }] };
    render(<ChangeQueue repair={repair} fact={{ id: 'f9', statement: 'x', history: [] }} number={9} docTitles={{ answer: 'Supporting evidence', letter: 'Cover letter' }} busy={false} onShow={vi.fn()} onDecide={vi.fn()} onApply={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Show in the supporting evidence/ })).toBeTruthy();
    cleanup();
    render(<DroppedWordingNotice details={[{ docId: 'answer', text: 'x', reason: 'y' }]} titles={{ answer: 'Supporting evidence' }} />);
    expect(screen.getByText('Supporting evidence')).toBeTruthy();
    const labels = buildCommands({ view: {}, workspace: { application: { form } }, currentTab: 'answer', setTab: vi.fn(), actions: {}, sample: null }).map((c) => c.label);
    expect(labels).toContain('Open the supporting evidence');
  });
});

describe('what Meta did', () => {
  it('dates the two weeks-old models when both ran, and shows the hint sent with the voice call', () => {
    const receipts = [
      { step: 'transcribe', flow: 'voice', provider: 'meta', isMeta: true, model: 'muse-voice-transcribe-1.0', host: 'api.meta.ai', languageBias: 'Portuguese', keywords: ['Ana', 'Leeds', 'Chamo-me Ana'], costUsd: 0.003, totalMs: 4000, at: '2026-11-03T20:00:00.000Z' },
      { step: 'extract', flow: 'read', provider: 'meta', isMeta: true, model: 'muse-wonder-1.0', host: 'api.meta.ai', costUsd: 0.05, totalMs: 9000, at: '2026-11-03T20:00:10.000Z', usage: { input: 1, cached: 0, output: 1, reasoning: 0 }, toolCalls: [] },
    ];
    render(<ReceiptsDrawer receipts={receipts} modeLabel="Meta Muse Wonder 1.0" open onToggle={vi.fn()} />);
    expect(screen.getByText('Muse Voice Transcribe was introduced in a Meta post dated 3 September 2026, and Muse Wonder in a Meta post dated 12 October 2026.')).toBeTruthy();
    expect(screen.getByText('language hint: Portuguese')).toBeTruthy();
    expect(screen.getByText('keywords: Ana, Leeds, Chamo-me Ana')).toBeTruthy();
    cleanup();
    render(<ReceiptsDrawer receipts={receipts.slice(1)} modeLabel="Meta Muse Wonder 1.0" open onToggle={vi.fn()} />);
    expect(screen.queryByText(/3 September 2026/)).toBeNull();
  });
});

describe('Ana’s prepared key moment', () => {
  const prepared = { sample: 'ana', model: 'muse-wonder-1.0', ranAt: '2026-11-03T20:36:24.465Z', note: 'Correção: foram dois anos.', loadedAt: '2026-11-03T21:00:00.000Z' };

  it('is offered on her card, after her voice note, and starts her own saved state', () => {
    const onStartPrepared = vi.fn();
    render(<SampleCards samples={[ellie, { ...ana, prepared }]} liveModel voice onStart={vi.fn()} onStartPrepared={onStartPrepared} />);
    const card = document.querySelectorAll('.sample-card')[0];
    expect(within(card).getAllByRole('button').map((b) => b.textContent)).toEqual(['Try it with Ana’s voice note', 'Start at Ana’s key moment']);
    expect(within(card).getByText('Her facts are confirmed and both documents approved, prepared from a real Muse Wonder run on 3 Nov. You make the one correction; the repair runs live.')).toBeTruthy();
    fireEvent.click(within(card).getByRole('button', { name: 'Start at Ana’s key moment' }));
    expect(onStartPrepared).toHaveBeenCalledWith('ana');
  });

  it('opens on her spoken correction, with the saved note if the voice call fails', async () => {
    voiceServer(null, 429);
    const ws = { ...drafted(prepared), prepared };
    render(<GuidedChange workspace={ws} view={{ citations: { f9: 9 } }} sample={ana} voice handlers={{ onAddNotes: vi.fn() }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Use Ana’s spoken correction' }));
    await waitFor(() => expect(screen.getByLabelText('Ana’s correction').value).toBe('Correção: foram dois anos.'));
    expect(screen.getByRole('alert').textContent).toContain('Muse Voice Transcribe did not answer');
  });

  // A prepared key moment whose live reading flags nothing still reaches What changed: her remembered
  // correction is applied to the fact it changes, with its English meaning and who did it.
  it('corrects the fact directly when typed, before or after her note', () => {
    const ws = { ...drafted(prepared), prepared };
    const onCorrectFact = vi.fn();
    const { unmount } = render(<GuidedChange workspace={ws} view={{ citations: { f9: 9 } }} sample={ana} voice handlers={{ onCorrectFact, onAddNotes: vi.fn() }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show the written correction' }));
    fireEvent.click(screen.getByRole('button', { name: 'Correct this fact' }));
    expect(onCorrectFact).toHaveBeenCalledWith('f9', 'Correção: foram dois anos.', { meaning: 'It was two years.', actor: 'self' });
    unmount();
    const read = { ...ws, applicant: { ...ws.applicant, sources: [...ws.applicant.sources, { id: 's2', kind: 'notes', text: 'Correção.', at: '2026-11-03T21:01:00.000Z', read: true }] } };
    render(<GuidedChange workspace={read} view={{ next: 'approve', citations: { f9: 9 }, approvals: {} }} sample={ana} voice handlers={{ onCorrectFact, onApprove: vi.fn() }} />);
    expect(screen.getByText(/Nothing was corrected, so both documents stay as they were\./)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Correct this fact' }));
    fireEvent.click(screen.getByRole('button', { name: 'Correct this fact' }));
    expect(onCorrectFact).toHaveBeenCalledTimes(2);
  });
});
