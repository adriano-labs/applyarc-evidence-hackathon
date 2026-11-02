// Offline by default: print the frozen manifest only. This script never reads
// provider credentials until --run-live and the reviewed corpus hash are set.
import { readFileSync, writeFileSync, mkdirSync, renameSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { providerFromEnv } from '../server/agent/providers.js';
import { createLedger } from '../server/agent/budget.js';
import { createTransport } from '../server/agent/transport.js';
import { createModelAgent } from '../server/agent/model.js';
import { runAppCase } from './workflow-comparison/app.mjs';
import { runBaselineCase } from './workflow-comparison/baseline.mjs';
import { pairCases, protocolLabel, safeFailure, fail } from './workflow-comparison/shared.mjs';

const v5 = process.env.WORKFLOW_PROTOCOL === 'v5';
// Set 3B (ACCEPTANCE-SET3B.md): the applicant's own unrelated sentence is placed in both arms before the correction.
const set3b = process.env.WORKFLOW_SET3B === '1';
const v4 = v5 || process.env.WORKFLOW_PROTOCOL === 'v4';
import { digest, liveOptions, scopedTransport } from './workflow-comparison/runtime.mjs';

// WORKFLOW_CORPUS picks another frozen corpus in fixtures/, such as the held-out set.
const corpusFile = process.env.WORKFLOW_CORPUS || 'workflow-comparison.json';
if (!/^[a-z0-9-]+\.json$/.test(corpusFile)) fail('invalid-corpus-name');
const fixtureText = readFileSync(new URL(`../fixtures/${corpusFile}`, import.meta.url), 'utf8');
const corpus = JSON.parse(fixtureText);
const corpusSha256 = digest(fixtureText);
const label = { ...protocolLabel(v5 ? 'v5' : v4, corpus.heldOut === true), ...(set3b ? { pairedCheck: 'ACCEPTANCE-SET3B.md: an unrelated hand-written sentence placed in both arms before the correction and checked for exact survival' } : {}) };

function selectedCases() {
  const ids = process.env.WORKFLOW_CASES?.split(',').filter(Boolean);
  if (!ids) return corpus.cases;
  if (new Set(ids).size !== ids.length || ids.some((id) => !corpus.cases.some((c) => c.id === id))) fail('invalid-case-selection');
  return corpus.cases.filter((c) => ids.includes(c.id));
}

function sourceFiles(root, directory) {
  return readdirSync(join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const file = `${directory}/${entry.name}`;
    return entry.isDirectory() ? sourceFiles(root, file) : /\.[cm]?js$/.test(file) ? [file] : [];
  });
}

function sourceVersion() {
  const cwd = fileURLToPath(new URL('..', import.meta.url));
  const files = [...sourceFiles(cwd, 'server'), ...sourceFiles(cwd, 'scripts/workflow-comparison'),
    'scripts/compare-workflow.mjs', 'scripts/journey.mjs', 'package.json', 'pnpm-lock.yaml'];
  const manifest = Object.fromEntries(files.sort().map((file) => [file, digest(readFileSync(join(cwd, file)))]));
  return {
    sha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim(),
    // Hash the tracked patch as well: concurrent local implementation may not
    // yet be committed. New harness files are preserved in this output folder.
    trackedPatchSha256: digest(execFileSync('git', ['diff', 'HEAD'], { cwd, encoding: 'utf8' })),
    manifest, manifestSha256: digest(JSON.stringify(manifest)),
  };
}

async function privateFetch(...args) {
  const response = await fetch(...args);
  if (response.status < 400) return response;
  // Transport needs status and retry/rate headers, never an upstream error
  // body that could echo credentials into its console warning.
  await response.body?.cancel();
  return new Response('', { status: response.status, headers: response.headers });
}

function saveReport(outputDir, report) {
  const target = join(outputDir, 'report.json');
  writeFileSync(`${target}.tmp`, JSON.stringify(report, null, 2), { mode: 0o600 });
  renameSync(`${target}.tmp`, target);
}

async function live(options, cases) {
  const outputDir = resolve(options.outputDir);
  // No --force or resume: the first run and every failed arm remain inspectable.
  try { mkdirSync(outputDir, { mode: 0o700 }); }
  catch (error) { if (error.code === 'EEXIST') fail('output-already-exists'); throw error; }
  const provider = { ...providerFromEnv(process.env), effort: options.effort };
  const ledger = createLedger({ file: resolve(options.ledgerFile), capUsd: options.capUsd });
  const transport = createTransport({ provider, ledger, fetch: privateFetch, firstEventTimeoutMs: provider.firstEventTimeoutMs ?? 45000 });
  const metadata = { startedAt: new Date().toISOString(), corpusSha256, source: sourceVersion(),
    provider: { id: provider.id, label: provider.label, model: provider.model, isMeta: Boolean(provider.isMeta),
      effort: options.effort, wire: provider.wire ?? 'responses',
      structuredOutputMode: provider.wire === 'chat' ? (provider.structured ? 'chat-json-schema' : 'prompt-json') : 'responses-json-schema',
      toolNote: provider.wire === 'chat' ? 'This chat adapter does not send native tool requests.' : 'Inspect receipts for actual native tool calls; configuration is not proof of use.' },
    selectedCases: cases.map((c) => c.id), budgetAtStart: ledger.summary(), corpusProtocol: corpus.protocol, ...label };
  writeFileSync(join(outputDir, 'frozen-corpus.json'), fixtureText, { mode: 0o600 });
  const files = ['compare-workflow.mjs', 'workflow-comparison/app.mjs', 'workflow-comparison/baseline.mjs',
    'workflow-comparison/shared.mjs', 'workflow-comparison/runtime.mjs'];
  for (const file of files) writeFileSync(join(outputDir, file.replaceAll('/', '-')), readFileSync(new URL(file, import.meta.url)), { mode: 0o600 });
  const runner = (method) => async (c) => {
    const scoped = scopedTransport({ transport, ledger, provider, armCapUsd: options.armCapUsd });
    const result = method === 'app'
      ? await runAppCase(c, { dataDir: join(outputDir, `${c.id}-app`), agent: createModelAgent({ provider, transport: scoped }), ledger, continuation: v4, routing: v5 ? 'personal' : 'first', unrelatedEdit: set3b })
      : await runBaselineCase(c, { provider, transport: scoped, continuation: v4, unrelatedEdit: set3b });
    return { ...result, providerEvidence: scoped.evidence() };
  };
  saveReport(outputDir, { ...metadata, runs: [] });
  const report = await pairCases(cases, { app: runner('app'), baseline: runner('baseline') }, async (progress) => {
    saveReport(outputDir, { ...metadata, ...progress, budget: ledger.summary() });
    const last = progress.runs.at(-1);
    process.stdout.write(`${last.caseId} ${last.method}: ${last.status}${last.failure ? ` (${last.failure})` : ''}\n`);
  }, label);
  const sourceAtEnd = sourceVersion();
  saveReport(outputDir, { ...metadata, ...report, finishedAt: new Date().toISOString(), budget: ledger.summary(),
    sourceAtEnd, sourceChangedDuringRun: metadata.source.manifestSha256 !== sourceAtEnd.manifestSha256 });
  process.stdout.write(`Retained ${report.runs.length} arms. Semantic quality NOT GRADED; human time saving NOT MEASURED.\n`);
}

try {
  const cases = selectedCases();
  const options = liveOptions(process.env, process.argv.slice(2), corpusSha256);
  if (options) await live(options, cases);
  else process.stdout.write(`${JSON.stringify({ ...label, corpusSha256, caseIds: cases.map((c) => c.id),
    status: 'OFFLINE MANIFEST ONLY; no provider calls', required: 'Independent corpus review, then --run-live with explicit WORKFLOW_* options.' }, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`Workflow comparison stopped: ${safeFailure(error)}. No credential or provider payload printed.\n`);
  process.exitCode = 1;
}
