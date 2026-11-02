// Ellie's whole journey through the HTTP API, step by step, with timings.
// As a script: `pnpm journey` runs it in-process on fixture mode, or
// BASE_URL=http://localhost:3000 pnpm journey runs it against a server;
// SAMPLE=marcus runs Marcus's sample instead, which needs a live model.
// The test suite imports runJourney and checks every step.
import { pathToFileURL } from 'node:url';

function check(condition, message) {
  if (!condition) throw new Error(`Journey check failed: ${message}`);
}

async function ndjson(response) {
  const events = (await response.text()).split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const end = events.at(-1);
  if (end?.type === 'error') throw Object.assign(new Error(`${end.error.code}: ${end.error.message}`), { code: end.error.code });
  return { events, ...end };
}

// What an applicant does when a step fails with "Try again": try once more.
const RETRYABLE = new Set(['cut', 'busy', 'timeout', 'network', 'invalid-output', 'invalid-draft']);

export function apiClient(request, { retryOnce = false, onRetry = () => {} } = {}) {
  let revision = 0;
  const remember = (data) => { if (data.workspace) revision = data.workspace.revision; return data; };
  return {
    get: async (path) => remember(await (await request('GET', path)).json()),
    reset: async () => remember(await (await request('POST', '/api/reset', {})).json()),
    async act(name, input = {}) {
      const response = await request('POST', `/api/actions/${name}`, { revision, ...input });
      const data = await response.json();
      if (!response.ok) throw new Error(`${name}: ${data.error.code}: ${data.error.message}`);
      return remember(data);
    },
    async run(name, input = {}) {
      const once = async () => remember(await ndjson(await request('POST', `/api/run/${name}`, { revision, ...input })));
      try {
        return await once();
      } catch (error) {
        if (!retryOnce || !RETRYABLE.has(error.code)) throw error;
        onRetry(`${name} failed with ${error.code}; tried again`);
        return once();
      }
    },
  };
}

const segmentCiting = (doc, factId) => doc.segments.find((s) => s.factIds.includes(factId));
const words = (t) => new Set(t.toLowerCase().match(/[a-z0-9/]+/g) ?? []);
const overlap = (a, b) => [...words(a)].filter((w) => words(b).has(w)).length;

// strict: the fixture's exact story. Live runs (a real model) check the
// invariants only, because a model may word, split and cite facts its own way.
export async function runJourney(request, log = () => {}, { strict = true, sampleId = null } = {}) {
  const notes = [];
  const api = apiClient(request, { retryOnce: !strict, onRetry: (n) => notes.push(`retry: ${n}`) });
  const steps = [];
  const step = async (name, fn) => {
    const started = performance.now();
    const out = await fn();
    steps.push({ name, ms: Math.round(performance.now() - started) });
    log(`${String(steps.length).padStart(2)} ${name} (${steps.at(-1).ms} ms)`);
    return out;
  };
  const confirmAll = async (state) => {
    for (const id of state.result.accepted) state = await api.act('decideFact', { factId: id, decision: 'confirm' });
    return state;
  };

  await step('start fresh', () => api.reset());
  const ellie = await step('load the sample notes', () => api.get('/api/sample'));
  // A named sample starts on its own form; the default is Ellie's story on the main form.
  const sample = sampleId ? ellie.samples?.find((s) => s.id === sampleId) : ellie;
  check(sample, `a sample called "${sampleId}"`);
  let state = await step('add notes', () => (sampleId ? api.act('startSample', { sampleId }) : api.act('notes', { text: sample.notes })));
  state = await step('read the notes', () => api.run('read', { sourceId: state.result.id }));
  notes.push(`notes: ${state.result.accepted.length} facts admitted, ${state.result.refused.length} refused (${state.result.refused.map((r) => r.reason).join('; ') || 'none'})`);
  check(state.result.accepted.length >= (strict ? 5 : 3), 'facts proposed from the notes');
  if (strict) check(state.result.refused.length === 0, 'no fixture fact refused');
  state = await step('confirm the facts', () => confirmAll(state));
  const covered = (id) => state.view.coverage.find((r) => r.id === id)?.covered;
  if (!sampleId) check(!covered('contribution'), 'team-only notes leave "your contribution" uncovered');
  state = await step('check what the form still needs', () => api.run('check'));
  const questions = state.workspace.application.questions;
  notes.push(`questions: ${questions.map((q) => `${q.requirementId}: ${q.text}`).join(' | ') || 'none'}`);
  check(new Set(questions.map((q) => q.requirementId)).size === questions.length, 'never two questions for one requirement');
  const question = sampleId ? questions.find((q) => q.status === 'open') : questions.find((q) => q.requirementId === 'contribution');
  // Ellie's notes always leave her own part open; another sample's notes may already cover the form.
  check(question || sampleId, 'the contribution question is asked');
  if (question) {
    if (strict) check(questions.length === 1, 'one question, not a questionnaire');
    for (const q of questions.filter((x) => x.status === 'open' && x !== question)) state = await api.act('skip', { questionId: q.id });
    state = await step('answer the question', () => api.act('answer', { questionId: question.id, text: sample.answerFor?.[question.requirementId] ?? sample.answer }));
    state = await step('read the answer', () => api.run('read', { sourceId: state.result.source.id }));
    state = await step('confirm the new facts', () => confirmAll(state));
    check(covered(question.requirementId), 'the answer covers what was asked');
    state = await step('check again', () => api.run('check'));
    check(state.result.modelCalled === false || state.result.added.length === 0, 'nothing new is asked');
  } else notes.push('questions: none, the notes already cover the form');
  state = await step('write both documents', () => api.run('draft'));
  for (const id of ['answer', 'letter']) notes.push(`${id}: ${state.view.stats[id].words} of ${state.view.stats[id].wordLimit} words`);
  check(!state.view.stats.answer.overLimit, 'project answer within the limit');
  const facts = state.workspace.applicant.facts.filter((f) => f.status === 'confirmed');
  const { letter: draftedLetter } = state.workspace.application.documents;
  const fixed = facts
    .map((f) => ({ f, score: overlap(f.quote, sample.correction.quote ?? sample.correction.anchor) + (segmentCiting(draftedLetter, f.id) ? 1 : 0) }))
    .sort((a, b) => b.score - a.score)[0].f;
  if (strict) check(fixed.quote === sample.correction.quote, 'the fixture fact to correct');
  const letterSentence = segmentCiting(draftedLetter, fixed.id) ?? draftedLetter.segments.find((s) => s.kind === 'claim');
  state = await step('edit a letter sentence by hand', () =>
    api.act('edit', { docId: 'letter', segmentId: letterSentence.id, text: `For context: ${letterSentence.text}` }));
  state = await step('correct a fact', () => api.act('changeFact', { factId: fixed.id, text: sample.correction.text }));
  const items = state.workspace.application.repair?.items ?? [];
  notes.push(`repair: ${items.length} reliant sentences (${items.map((i) => i.segmentId).join(', ')})`);
  check(items.length >= 1, 'at least one sentence relied on the fact');
  if (strict) check(items.length === 2 && new Set(items.map((i) => i.docId)).size === 2, 'two reliant sentences, one in each document');
  const bystander = ['answer', 'letter'].flatMap((d) => state.workspace.application.documents[d].segments.map((s) => ({ d, s }))).find(({ s }) => !s.factIds.includes(fixed.id));
  state = await step('propose the changes', () => api.run('repair'));
  const repairItems = state.workspace.application.repair.items;
  notes.push(`proposals: ${repairItems.map((i) => `${i.segmentId}=${i.status}`).join(', ')}`);
  // A real applicant can keep their wording. This technical repair journey
  // cannot choose that silently and count an unavailable replacement as success.
  const incompleteItems = repairItems.filter((i) => typeof i.after !== 'string' || !i.after.trim());
  if (incompleteItems.length) throw Object.assign(new Error(`Journey incomplete: no accepted repair for ${incompleteItems.map((i) => `${i.docId}/${i.segmentId}`).join(', ')}.`), {
    code: 'repair-incomplete', incompleteItems, steps, notes,
  });
  if (letterSentence.factIds.includes(fixed.id)) check(repairItems.some((i) => i.segmentId === letterSentence.id && i.status === 'conflict'), 'the hand-edited sentence needs a decision');
  state = await step('decide what needs you', async () => {
    for (const i of repairItems.filter((x) => x.status !== 'proposed')) state = await api.act('decideChange', { itemId: i.id, decision: 'take' });
    return state;
  });
  state = await step('apply the changes', () => api.act('applyChanges'));
  const after = state.workspace.application.documents[bystander.d].segments.find((s) => s.id === bystander.s.id);
  check(after.text === bystander.s.text, 'a sentence that did not cite the fact is untouched');
  const { answer, letter } = state.workspace.application.documents;
  state = await step('approve the project answer', () => api.act('approve', { docId: 'answer', docRevision: answer.revision }));
  state = await step('approve the cover letter', () => api.act('approve', { docId: 'letter', docRevision: letter.revision }));
  const pack = await step('export the pack', () => api.act('export'));
  check(pack.result.status === 'NOT SUBMITTED', 'the pack says NOT SUBMITTED');
  check(pack.result.documents.every((d) => d.text.length > 0) && pack.result.portalTasks.length > 0, 'pack has both documents and the portal tasks');
  const { receipts, mode, budget } = await api.get('/api/receipts');
  return { steps, notes, pack: pack.result, workspace: pack.workspace, receipts, mode, budget };
}

// For the hosted demo: one visitor for the whole run, by sending back the ae_visitor cookie.
export function remoteRequest(baseUrl, fetchImpl = fetch) {
  let cookie = null;
  return async (method, path, body) => {
    const headers = { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) };
    const response = await fetchImpl(new URL(path, baseUrl).href, { method, headers, body: body && JSON.stringify(body) });
    cookie ??= /ae_visitor=[^;,\s]+/.exec(response.headers.get('set-cookie') ?? '')?.[0] ?? null;
    return response;
  };
}

async function main() {
  let request;
  if (process.env.BASE_URL) {
    request = remoteRequest(process.env.BASE_URL);
  } else {
    const { mkdtempSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { buildApp } = await import('../server/build.js');
    const app = buildApp({ dataDir: process.env.DATA_DIR ?? mkdtempSync(join(tmpdir(), 'journey-')) });
    request = (method, path, body) => app.request(path, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
  }
  const started = performance.now();
  const live = Boolean(process.env.PROVIDER && process.env.PROVIDER !== 'fixture');
  const { steps, notes, pack, receipts, mode, budget } = await runJourney(request, console.log, { strict: !live, sampleId: process.env.SAMPLE ?? null });
  for (const n of notes) console.log(`   ${n}`);
  // The trace a live run commits: what the model did, not just the steps.
  if (process.env.JOURNEY_OUT) (await import('node:fs')).writeFileSync(process.env.JOURNEY_OUT, JSON.stringify({ steps, notes, pack, receipts, mode, budget }, null, 2));
  console.log(`Journey passed: ${steps.length} steps in ${Math.round(performance.now() - started)} ms (${process.env.BASE_URL ?? `in-process, ${process.env.PROVIDER ?? 'fixture'}`})`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
