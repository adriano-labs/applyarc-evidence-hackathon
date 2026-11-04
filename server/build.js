// Build the app from the environment: fixture mode unless a provider is set.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createLedger } from './agent/budget.js';
import { createFixtureAgent } from './agent/fixture.js';
import { createModelAgent } from './agent/model.js';
import { providerFromEnv } from './agent/providers.js';
import { createTransport } from './agent/transport.js';
import { faultyFetch } from './agent/fault.js';
import { keepWarm } from './agent/keepWarm.js';
import { createVoice } from './agent/voice.js';
import { createApp } from './app.js';
import { fromRoot } from './paths.js';
import { languageChoices } from './domain/languages.js';

function agentFor(env, dataDir, fixture, notes, extraForms) {
  const provider = providerFromEnv(env);
  if (!provider) return { agent: createFixtureAgent({ data: fixture, sampleNotes: notes, forms: extraForms }), ledger: null };
  const ledgerFile = env.SPEND_LEDGER_FILE || join(dataDir, 'ledger.json');
  const ledger = createLedger({ file: ledgerFile, capUsd: Number(env.SPEND_CAP_USD ?? 2) });
  // A labelled, demo-only fault: one injected 429 on the first model call (never a real flood).
  if (env.DEMO_FAULT) console.log(`DEMO_FAULT=${env.DEMO_FAULT}: the first model call will get an injected 429.`);
  const fetch = env.DEMO_FAULT ? faultyFetch(globalThis.fetch, env.DEMO_FAULT) : undefined;
  const transport = createTransport({ provider, ledger, firstEventTimeoutMs: provider.firstEventTimeoutMs ?? 45000, fetch });
  keepWarm({ provider, everyMs: Number(env.KEEP_WARM_MS ?? 0) });
  return { agent: createModelAgent({ provider, transport }), ledger };
}

export function buildApp({ dataDir = process.env.DATA_DIR ?? 'data', env = process.env } = {}) {
  const forms = [
    JSON.parse(readFileSync(fromRoot('fixtures', 'graphcore-form-2026-10-26.json'), 'utf8')),
    JSON.parse(readFileSync(fromRoot('fixtures', 'graphcore-drivers-form-2026-10-26.json'), 'utf8')),
  ];
  const form = forms[0];
  const fixture = JSON.parse(readFileSync(fromRoot('fixtures', 'ellie-fixture.json'), 'utf8'));
  const fixtureDrivers = JSON.parse(readFileSync(fromRoot('fixtures', 'ellie-fixture-drivers.json'), 'utf8'));
  const notes = readFileSync(fromRoot('fixtures', 'ellie-notes.md'), 'utf8');
  const harbourlineForm = JSON.parse(readFileSync(fromRoot('fixtures', 'harbourline-form-2026-10-27.json'), 'utf8'));
  const marcusNotes = readFileSync(fromRoot('fixtures', 'marcus-notes.md'), 'utf8');
  // Ellie's sample as a real Muse Wonder run saved it, facts confirmed and both documents approved: the key moment's start.
  const prepared = JSON.parse(readFileSync(fromRoot('fixtures', 'ellie-prepared-wonder-20261103.json'), 'utf8'));
  const sample = {
    name: 'Ellie',
    notes,
    answer: fixture.answer,
    correction: { ...fixture.correction, anchor: ['Helm change', 'Helm patch'] },
    answers: {
      [forms[0].id]: fixture.answer,
      [forms[1].id]: fixtureDrivers.answer,
    },
  };
  // Ana speaks European Portuguese: a public care advert, her hand-written fixture and three
  // synthetic voice clips (Azure pt-PT-RaquelNeural, fictional applicant) the live demo sends to Meta.
  const anaForm = JSON.parse(readFileSync(fromRoot('fixtures', 'north-yorkshire-care-form-2026-11-03.json'), 'utf8'));
  const anaFixture = JSON.parse(readFileSync(fromRoot('fixtures', 'ana-fixture-pt.json'), 'utf8'));
  const extraForms = { [forms[1].id]: fixtureDrivers, [anaForm.id]: anaFixture };
  // Ana's sample as a real Muse Wonder run saved it, both documents approved, before her correction.
  const anaPrepared = JSON.parse(readFileSync(fromRoot('fixtures', 'ana-prepared-wonder-20261103.json'), 'utf8'));
  const ellieSample = {
    id: 'ellie',
    name: 'Ellie',
    possessive: 'her',
    field: 'Graduate engineer',
    liveOnly: false,
    formId: forms[0].id,
    notes,
    answer: fixture.answer,
    correction: { ...fixture.correction, anchor: ['Helm change', 'Helm patch'] },
  };
  const marcusSample = {
    id: 'marcus',
    name: 'Marcus',
    possessive: 'his',
    field: 'Retail to marketing',
    liveOnly: true,
    formId: harbourlineForm.id,
    notes: marcusNotes,
    answer: 'I came up with the idea, rang eight local suppliers and got six to come, and made the posters and the Instagram posts for it. My manager signed off the budget, and the whole team helped on the day.',
    correction: { anchor: '2,100 followers', text: 'The store’s Instagram grew from 300 to 2,100 followers in eleven months, not eight.' },
    // The live model asks about what his notes leave out, usually why this employer.
    answerFor: { motivation: 'I want to do marketing full time and stay in Leeds, and Harbourline is a Leeds company hiring a marketing assistant. The parts of my job I liked most were the Instagram and the meet the makers Saturday, and this role is that work every day.' },
  };
  const anaSample = {
    id: 'ana',
    name: 'Ana',
    possessive: 'her',
    field: 'Care worker',
    language: 'pt-PT',
    liveOnly: false,
    formId: anaForm.id,
    notes: anaFixture.notes,
    answer: anaFixture.answer,
    correction: { ...anaFixture.correction, anchor: ['noites'] },
    clips: { notes: '/samples/ana-pt-notes.wav', answer: '/samples/ana-pt-answer.wav', correction: '/samples/ana-pt-correction.wav' },
    voice: 'Synthetic voice, fictional applicant',
    // The welcome card's own words: the form, the advert's date and why the statement is hard for her.
    blurb: 'North Yorkshire Council’s “Supporting evidence” for a Care and Support Worker (public advert, 3 Nov 2026), 500 words as a working guide. Ana has three years in a Leeds care home and working English; the written statement is the barrier.',
    employerShort: 'the council',
    // The advert's own line on AI, word for word: the welcome leads with it.
    thesis: { quote: 'Using AI? Please follow our guidance to ensure your application reflects your own knowledge and experience', source: 'North Yorkshire Council’s care advert, captured 3 Nov 2026', url: anaForm.url },
    // Her clips go to Muse Voice Transcribe with the Portuguese hint: over 5 paired live calls per
    // clip on 3 Nov it cut word errors on the notes and the answer and tied on the correction.
    voiceHint: true,
    // Her clips also send her name, her town and her opening words as Meta's keywords; an own
    // recording sends none. Over 5 paired live calls per clip on 3 Nov, through this app: her name
    // came back in the notes' opening 4 times in 5 with them and 0 in 5 without, and word errors were
    // 5.3% vs 6.3% (notes), 3.5% vs 3.9% (answer) and 1.2% vs 1.2% (correction).
    voiceKeywords: ['Ana', 'Leeds', 'Chamo-me Ana'],
    // Measured, not estimated: the median of the three live Muse Wonder journeys of 3 Nov waited
    // about 1 min 49 s on Meta's models in all, rounded up to 2 minutes.
    minutes: 2,
    timing: 'Meta’s models take about 2 minutes; allow a few more to read and confirm.',
    // Measured: her prepared key moment took 22 s to 47 s in the live runs of 3 Nov (through the API
    // and in the browser, on both links, to the Evidence Pass), so it says a minute.
    keyTiming: 'About a minute.',
  };
  const samples = [
    { ...ellieSample, form: forms[0], prepared: prepared.prepared },
    { ...marcusSample, form: harbourlineForm },
    { ...anaSample, form: anaForm, prepared: anaPrepared.prepared },
  ];
  sample.samples = samples;
  sample.languages = languageChoices();
  const { agent, ledger } = agentFor(env, dataDir, fixture, notes, extraForms);
  // A hosted demo with a per-visitor allowance falls back to the fixture once a visitor has used it.
  const capped = ledger && env.VISITOR_CAP_USD;
  const fallback = capped ? createFixtureAgent({ data: fixture, sampleNotes: notes, forms: extraForms }) : null;
  const voice = ledger && agent.provider?.id === 'meta' && env.META_API_KEY ? createVoice({ key: env.META_API_KEY, ledger }) : null;
  return createApp({ dataDir, form, forms, agent, ledger, trustEasyAuth: env.TRUST_EASY_AUTH === '1', visitorCookie: env.VISITOR_COOKIE === '1', sample, samples, fallback, visitorCapUsd: capped ? Number(env.VISITOR_CAP_USD) : undefined, visitorIdsPerIpPerDay: Number(env.VISITOR_IDS_PER_IP_PER_DAY ?? 50), voice, prepared, preparedFor: { ana: anaPrepared } });
}
