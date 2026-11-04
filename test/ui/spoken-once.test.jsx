// @vitest-environment jsdom
// Ana's voice note is sent to Muse Voice Transcribe once, only from her own start: never again after
// Start again when another sample starts, never from a screen that has gone, and a start pressed twice
// still opens the walk-through. Each call is paid and becomes a Voice row in someone's trail.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../client/src/App.jsx';
import { GuidedChange } from '../../client/src/components/GuidedChange.jsx';
import { SpokenStart } from '../../client/src/components/SpokenStart.jsx';
import { useClip } from '../../client/src/components/useClip.js';
import { createApp } from '../../server/app.js';
import { fromRoot } from '../../server/paths.js';

const read = (name) => JSON.parse(readFileSync(fromRoot('fixtures', name), 'utf8'));
const saved = read('ellie-prepared-wonder-20261103.json');
const anaForm = read('north-yorkshire-care-form-2026-11-03.json');
const ellie = { id: 'ellie', name: 'Ellie', possessive: 'her', field: 'Graduate engineer', liveOnly: false, formId: saved.application.form.id, form: saved.application.form, notes: saved.applicant.sources[0].text, correction: { anchor: 'Helm change', text: 'My teammate Sam wrote the Helm change; I tested it.' }, prepared: saved.prepared };
const ana = { id: 'ana', name: 'Ana', possessive: 'her', field: 'Care worker', language: 'pt-PT', liveOnly: false, formId: anaForm.id, form: anaForm, notes: 'Chamo-me Ana. Eu trabalho há três anos num lar em Leeds.', correction: { text: 'Correção: foram dois anos.', meaning: 'Correction: it was two years.', actor: 'self', anchor: ['noites'] }, clips: { notes: '/samples/ana-pt-notes.wav', answer: '/samples/ana-pt-answer.wav', correction: '/samples/ana-pt-correction.wav' }, voice: 'Synthetic voice, fictional applicant', voiceHint: true };
const HEARD = 'Chamo-me Ana. Eu trabalho há três anos num lar em Leeds.';

// A stand-in for the live model that finds nothing and asks nothing: never a real call.
const agent = {
  provider: { id: 'meta', label: 'Meta Muse Wonder 1.0', model: 'muse-wonder-1.0', isMeta: true },
  extract: async ({ emit }) => { emit({ type: 'receipt', receipt: { step: 'extract', provider: 'meta', isMeta: true, model: 'muse-wonder-1.0', costUsd: 0.01, totalMs: 1000, toolCalls: [] } }); return { facts: [], conflicts: [] }; },
};

// The app's own server in-process; the clip files as bytes; Voice Transcribe as a counted stand-in.
function serve() {
  const voice = { transcribe: vi.fn(async () => ({ text: HEARD, durationMs: 58800, costUsd: 0.003, model: 'muse-voice-transcribe-1.0', host: 'api.meta.ai' })) };
  const server = createApp({ dataDir: mkdtempSync(join(tmpdir(), 'spoken-once-')), form: saved.application.form, forms: [saved.application.form, anaForm], agent, sample: { name: 'Ellie', notes: ellie.notes, samples: [ellie, ana] }, samples: [ellie, ana], prepared: saved, voice });
  const clips = [];
  const starts = [];
  vi.stubGlobal('fetch', async (url, init) => {
    if (String(url).startsWith('/samples/')) { clips.push(String(url)); return new Response(new Uint8Array([82, 73, 70, 70]), { status: 200 }); }
    if (/^\/api\/actions\/start/.test(String(url))) starts.push(String(url));
    return server.request(String(url), init);
  });
  return { voice, clips, starts };
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); sessionStorage.clear(); });
Element.prototype.scrollIntoView = () => {};
const wait = { timeout: 8000 };
const button = (name) => screen.findByRole('button', { name }, wait);

async function heardThenStartedAgain() {
  render(<App />);
  fireEvent.click(await button('Try it with Ana’s voice note'));
  await screen.findByLabelText('Her words, as Meta heard them', {}, wait);
  fireEvent.click(screen.getByRole('button', { name: 'Start again' }));
  fireEvent.click(screen.getByRole('button', { name: 'Start again' }));
  await button('Try it with Ellie’s notes');
}

describe('her voice note after Start again', () => {
  it('does not open or send it again when Ellie starts at the key moment', async () => {
    const { voice, clips } = serve();
    await heardThenStartedAgain();
    fireEvent.click(await button('Start at the key moment'));
    await screen.findByText('Key moment: correct a fact', {}, wait);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(clips).toEqual(['/samples/ana-pt-notes.wav']);
    expect(voice.transcribe).toHaveBeenCalledTimes(1);
  }, 20000);

  it('does not open or send it again when Ellie’s notes start', async () => {
    const { voice, clips } = serve();
    await heardThenStartedAgain();
    fireEvent.click(await button('Try it with Ellie’s notes'));
    await screen.findByRole('button', { name: 'Open the full workspace' }, wait);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(clips).toEqual(['/samples/ana-pt-notes.wav']);
    expect(voice.transcribe).toHaveBeenCalledTimes(1);
  }, 20000);
});

describe('What Meta did, as her voice note comes back', () => {
  it('lists the voice call at once, before anything else runs', async () => {
    serve();
    render(<App />);
    fireEvent.click(await button('Try it with Ana’s voice note'));
    await screen.findByLabelText('Her words, as Meta heard them', {}, wait);
    await waitFor(() => expect(document.querySelector('.guided-receipts .receipts-line').textContent).toMatch(/^muse-voice-transcribe-1\.0 · 1 run/), wait);
  }, 20000);
});

describe('a start pressed twice', () => {
  it('reads Ana’s words once and stays in the walk-through', async () => {
    const { starts } = serve();
    render(<App />);
    fireEvent.click(await button('Try it with Ana’s voice note'));
    await screen.findByLabelText('Her words, as Meta heard them', {}, wait);
    const readWords = screen.getByRole('button', { name: 'Read Ana’s words' });
    fireEvent.click(readWords);
    fireEvent.click(readWords);
    await waitFor(() => expect(document.querySelector('#spoken-words')).toBeNull(), wait);
    await waitFor(() => expect(screen.queryByText('Reading your words')).toBeNull(), wait);
    expect(starts).toEqual(['/api/actions/startSample']);
    expect(document.querySelector('.guided')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Back to the guided walk-through' })).toBeNull();
  }, 20000);

  it('starts Ellie’s notes once and stays in the walk-through', async () => {
    const { starts } = serve();
    render(<App />);
    const start = await button('Try it with Ellie’s notes');
    fireEvent.click(start);
    fireEvent.click(start);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Try it with Ellie’s notes' })).toBeNull(), wait);
    await waitFor(() => expect(screen.queryByText('Reading your words')).toBeNull(), wait);
    expect(starts).toEqual(['/api/actions/startSample']);
    expect(document.querySelector('.guided')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Back to the guided walk-through' })).toBeNull();
  }, 20000);
});

// The clip's own hook: a screen that goes while the clip is still loading never sends it.
function Clip({ src }) {
  useClip(src, { auto: true });
  return null;
}

describe('a bundled clip whose screen has gone', () => {
  it('is never sent to Muse Voice Transcribe', async () => {
    let release;
    const calls = [];
    vi.stubGlobal('fetch', vi.fn((url) => {
      calls.push(String(url));
      if (String(url).startsWith('/samples/')) return new Promise((resolve) => { release = () => resolve(new Response(new Uint8Array([1]), { status: 200 })); });
      return Promise.resolve(new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }));
    }));
    const { unmount } = render(<Clip src="/samples/c.wav" />);
    await waitFor(() => expect(calls).toEqual(['/samples/c.wav']));
    unmount();
    await act(async () => { release(); await new Promise((r) => setTimeout(r, 20)); });
    expect(calls).toEqual(['/samples/c.wav']);
  });
});

// Fetches the stand-in serves: the clip bytes (held until released, when asked), then Meta's words.
function voiceCalls({ hold = false, text = 'Correção: foram dois anos.' } = {}) {
  const calls = [];
  let release = () => {};
  vi.stubGlobal('fetch', vi.fn((url) => {
    calls.push(String(url));
    if (String(url).startsWith('/samples/')) {
      const bytes = () => new Response(new Uint8Array([82, 73, 70, 70]), { status: 200 });
      return hold ? new Promise((resolve) => { release = () => resolve(bytes()); }) : Promise.resolve(bytes());
    }
    return Promise.resolve(new Response(JSON.stringify({ text, durationMs: 7160, model: 'muse-voice-transcribe-1.0' }), { status: 200, headers: { 'content-type': 'application/json' } }));
  }));
  return { calls, voice: () => calls.filter((u) => u.startsWith('/api/voice')), release: () => release() };
}

const drafted = { applicant: { name: 'Ana', sources: [{ id: 's1', kind: 'notes', text: 'x', language: 'pt-PT', spoken: true }], facts: [{ id: 'f9', status: 'confirmed', language: 'pt-PT', actor: 'self', quote: 'Fiz três anos de noites.', statement: 'I did three years of nights.', sourceId: 's1' }] },
  application: { form: anaForm, documents: { answer: { revision: 1, segments: [] }, letter: { revision: 1, segments: [] } }, repair: null, lastRepair: null } };

describe('her spoken correction at the key moment', () => {
  it('is sent once, when asked, and not again after a look back and return', async () => {
    const { voice } = voiceCalls();
    const keyMoment = () => <GuidedChange workspace={drafted} view={{ citations: { f9: 9 } }} sample={ana} voice handlers={{ onAddNotes: vi.fn() }} />;
    const first = render(keyMoment());
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(voice()).toEqual([]);
    const primary = () => [...document.querySelectorAll('.guided-note .btn.primary')].map((b) => b.textContent);
    expect(primary()).toEqual(['Use Ana’s spoken correction']);
    fireEvent.click(screen.getByRole('button', { name: 'Use Ana’s spoken correction' }));
    await waitFor(() => expect(screen.getByLabelText('Ana’s correction').value).toBe('Correção: foram dois anos.'));
    expect(primary()).toEqual(['Add Ana’s note']);
    first.unmount(); // Back: the look back replaces the key moment
    render(keyMoment()); // Return to correction
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(voice()).toHaveLength(1);
  });
});

describe('her voice note while it is still on its way', () => {
  it('offers her written note, and choosing it stops the clip being sent', async () => {
    const { calls, release } = voiceCalls({ hold: true });
    const onRead = vi.fn();
    render(<SpokenStart sample={ana} view={{}} workspace={{ applicant: { sources: [], facts: [] }, application: { form: anaForm } }} isMeta live onRead={onRead} />);
    await waitFor(() => expect(calls).toEqual(['/samples/ana-pt-notes.wav']));
    fireEvent.click(screen.getByRole('button', { name: 'Use her written note instead' }));
    expect(screen.getByLabelText('Ana’s written note, in Portuguese').value).toBe(ana.notes);
    await act(async () => { release(); await new Promise((r) => setTimeout(r, 20)); });
    expect(calls).toEqual(['/samples/ana-pt-notes.wav']);
    fireEvent.click(screen.getByRole('button', { name: 'Read Ana’s words' }));
    expect(onRead).toHaveBeenCalledWith(undefined);
  });

  it('says a failed call in one sentence, with one full stop', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => (String(url).startsWith('/samples/')
      ? new Response(new Uint8Array([1]), { status: 200 })
      : new Response(JSON.stringify({ error: { code: 'busy', message: 'Meta Voice Transcribe is busy. Try again in a minute, or type your notes.' } }), { status: 503, headers: { 'content-type': 'application/json' } }))));
    render(<SpokenStart sample={ana} view={{}} workspace={{ applicant: { sources: [], facts: [] }, application: { form: anaForm } }} isMeta live onRead={vi.fn()} />);
    const alert = await screen.findByRole('alert');
    expect(alert.querySelector('p').textContent).toBe('Muse Voice Transcribe did not answer: Meta Voice Transcribe is busy. Try again in a minute, or type your notes. Her written note can be used instead; it is labelled as typed, not spoken.');
  });
});
