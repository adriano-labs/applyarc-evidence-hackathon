// Build the app from the environment: fixture mode unless a provider is set.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createLedger } from './agent/budget.js';
import { createFixtureAgent } from './agent/fixture.js';
import { createModelAgent } from './agent/model.js';
import { providerFromEnv } from './agent/providers.js';
import { createTransport } from './agent/transport.js';
import { faultyFetch } from './agent/fault.js';
import { createVoice } from './agent/voice.js';
import { createApp } from './app.js';
import { fromRoot } from './paths.js';

function agentFor(env, dataDir, fixture, notes, extraForms) {
  const provider = providerFromEnv(env);
  if (!provider) return { agent: createFixtureAgent({ data: fixture, sampleNotes: notes, forms: extraForms }), ledger: null };
  const ledgerFile = env.SPEND_LEDGER_FILE || join(dataDir, 'ledger.json');
  const ledger = createLedger({ file: ledgerFile, capUsd: Number(env.SPEND_CAP_USD ?? 2) });
  // A labelled, demo-only fault: one injected 429 on the first model call (never a real flood).
  if (env.DEMO_FAULT) console.log(`DEMO_FAULT=${env.DEMO_FAULT}: the first model call will get an injected 429.`);
  const fetch = env.DEMO_FAULT ? faultyFetch(globalThis.fetch, env.DEMO_FAULT) : undefined;
  const transport = createTransport({ provider, ledger, firstEventTimeoutMs: provider.firstEventTimeoutMs ?? 45000, fetch });
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
  const sample = {
    name: 'Ellie',
    notes,
    answer: fixture.answer,
    correction: { ...fixture.correction, anchor: 'Helm change' },
    answers: {
      [forms[0].id]: fixture.answer,
      [forms[1].id]: fixtureDrivers.answer,
    },
  };
  const extraForms = { [forms[1].id]: fixtureDrivers };
  const ellieSample = {
    id: 'ellie',
    name: 'Ellie',
    possessive: 'her',
    field: 'Graduate engineer',
    liveOnly: false,
    formId: forms[0].id,
    notes,
    answer: fixture.answer,
    correction: { ...fixture.correction, anchor: 'Helm change' },
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
  const samples = [
    { ...ellieSample, form: forms[0] },
    { ...marcusSample, form: harbourlineForm },
  ];
  sample.samples = samples;
  const { agent, ledger } = agentFor(env, dataDir, fixture, notes, extraForms);
  // A hosted demo with a per-visitor allowance falls back to the fixture once a visitor has used it.
  const capped = ledger && env.VISITOR_CAP_USD;
  const fallback = capped ? createFixtureAgent({ data: fixture, sampleNotes: notes, forms: extraForms }) : null;
  const voice = ledger && env.META_API_KEY ? createVoice({ key: env.META_API_KEY, ledger }) : null;
  return createApp({ dataDir, form, forms, agent, ledger, trustEasyAuth: env.TRUST_EASY_AUTH === '1', visitorCookie: env.VISITOR_COOKIE === '1', sample, samples, fallback, visitorCapUsd: capped ? Number(env.VISITOR_CAP_USD) : undefined, visitorIdsPerIpPerDay: Number(env.VISITOR_IDS_PER_IP_PER_DAY ?? 50), voice });
}
