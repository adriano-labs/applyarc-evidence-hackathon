#!/usr/bin/env node
// Turn runs/<host>/*.json into the Markdown tables for RESULTS.md (printed to stdout).
// Journeys are grouped by host and variant (plain-phrased correcting note, probe).
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('.', import.meta.url).pathname;
const HOSTS = process.argv.slice(2).length ? process.argv.slice(2) : ['wonder', 'modal', 'baseten'];
const KEYS = [
  ['quotesVerbatim', '1 quotes verbatim'], ['withinLimits', '2 within limits'], ['citationsConfirmed', '3 citations confirmed'],
  ['onlyCitingSentencesChanged', '4 only citing sentences changed'], ['manualSentenceIntact', '5 manual sentence intact'],
  ['approvalsClearedAndRenewed', '6 approvals cleared and renewed'], ['exportNotSubmitted', '7 export NOT SUBMITTED'],
  ['noServerErrors', '8 no 5xx or unhandled error'], ['noUncitedNumbers', '9 no number outside cited facts'],
];
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };
const secs = (ms) => (ms === null || ms === undefined ? 'n/a' : `${(ms / 1000).toFixed(1)} s`);
const usd = (v) => (v === null || v === undefined ? 'n/a' : `$${v.toFixed(3)}`);
const variantOf = (j) => `${j.plain ? 'plain' : 'as written'}${j.probe ? ' probe' : ''}`;

function load(host) {
  const dir = join(ROOT, 'runs', host);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.json') && !f.startsWith('summary')).map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));
}

function section(host, label, variant, js) {
  const modelSteps = js.flatMap((j) => j.steps.filter((s) => s.receipts.length).map((s) => ({ ...s, persona: j.persona })));
  const worst = [...modelSteps].sort((a, b) => b.ms - a.ms)[0];
  const costs = js.map((j) => j.metrics.costReceiptsUsd);
  const unknown = js.reduce((a, j) => a + j.metrics.costUnknownReceipts, 0);
  console.log(`### ${label}: correcting note ${variant} (${js.length} journey${js.length === 1 ? '' : 's'})\n`);
  console.log(`| Measure | Value |\n|---|---|`);
  console.log(`| Journeys completed of attempted | ${js.filter((j) => j.completed).length} of ${js.length} |`);
  console.log(`| Correction route | ${Object.entries(js.reduce((acc, j) => ({ ...acc, [j.route ?? (j.probeResult ? (j.probeResult.conflict ? 'conflict raised' : 'conflict missed') : 'not reached')]: (acc[j.route ?? (j.probeResult ? (j.probeResult.conflict ? 'conflict raised' : 'conflict missed') : 'not reached')] ?? 0) + 1 }), {})).map(([k, v]) => `${k}: ${v}`).join('; ')} |`);
  for (const [k, name] of KEYS) {
    const pass = js.filter((j) => j.invariants[k].pass).length; const ev = js.filter((j) => j.invariants[k].evaluable).length;
    console.log(`| Invariant ${name} | ${pass} of ${ev} evaluable${ev < js.length ? ` (${js.length - ev} not reached)` : ''} |`);
  }
  console.log(`| Median model-step latency | ${secs(median(modelSteps.map((s) => s.ms)))} over ${modelSteps.length} model steps |`);
  console.log(`| Worst model step | ${worst ? `${secs(worst.ms)} (${worst.persona}: ${worst.name})` : 'n/a'} |`);
  console.log(`| Cost per journey (sum of receipts) | median ${usd(median(costs))}, min ${usd(Math.min(...costs))}, max ${usd(Math.max(...costs))}, total ${usd(costs.reduce((a, b) => a + b, 0))}${unknown ? `; ${unknown} receipts with unknown cost` : ''} |`);
  console.log(`| Wall time per journey | median ${secs(median(js.map((j) => j.metrics.wallMs)))}, max ${secs(Math.max(...js.map((j) => j.metrics.wallMs)))} |`);
  console.log(`| Step retries (Try again) | ${js.reduce((a, j) => a + j.metrics.stepRetries, 0)} across ${js.length} journeys |`);
  console.log(`| Provider attempts / turns / tool calls | ${js.reduce((a, j) => a + j.metrics.providerAttempts, 0)} / ${js.reduce((a, j) => a + j.metrics.providerTurns, 0)} / ${js.reduce((a, j) => a + j.metrics.toolCalls, 0)} |`);
  console.log('');
  console.log(`| Persona | Style | Completed | Correction route | Invariants | Retries | Attempts | Tools | Tokens in/cached/out | Cost | Wall |\n|---|---|---|---|---|---|---|---|---|---|---|`);
  for (const j of js) {
    const failed = KEYS.filter(([k]) => j.invariants[k].evaluable && !j.invariants[k].pass).map(([k]) => KEYS.findIndex(([x]) => x === k) + 1);
    const notReached = KEYS.filter(([k]) => !j.invariants[k].evaluable).length;
    const u = j.metrics.usage;
    const route = j.route ?? (j.probeResult ? (j.probeResult.conflict ? 'conflict raised' : 'conflict missed') : 'not reached');
    console.log(`| ${j.persona}${j.tag ? ` (${j.tag})` : ''} | ${j.style} | ${j.completed ? 'yes' : `no (${j.abortedAt}: ${j.abortReason?.code})`} | ${route} | ${KEYS.filter(([k]) => j.invariants[k].pass).length}/9${failed.length ? ` (failed ${failed.join(', ')})` : ''}${notReached ? ` (${notReached} not reached)` : ''} | ${j.metrics.stepRetries} | ${j.metrics.providerAttempts} | ${j.metrics.toolCalls} | ${u.input}/${u.cached}/${u.output} | ${usd(j.metrics.costReceiptsUsd)} | ${secs(j.metrics.wallMs)} |`);
  }
  console.log('');
  const names = [...new Set(modelSteps.map((s) => s.name))];
  console.log(`| Model step | Journeys | Median | Worst | Retried | Provider attempts (sum) | Tool calls (sum) |\n|---|---|---|---|---|---|---|`);
  for (const n of names) {
    const rows = modelSteps.filter((s) => s.name === n);
    console.log(`| ${n} | ${rows.length} | ${secs(median(rows.map((s) => s.ms)))} | ${secs(Math.max(...rows.map((s) => s.ms)))} | ${rows.filter((s) => s.retries).length} | ${rows.reduce((a, s) => a + s.receipts.reduce((x, r) => x + (r.attempts ?? 0), 0), 0)} | ${rows.reduce((a, s) => a + s.receipts.reduce((x, r) => x + (r.toolCalls ?? 0), 0), 0)} |`);
  }
  console.log('');
  console.log(`#### Failures and findings, ${label}, correcting note ${variant}\n`);
  for (const j of js) {
    const lines = [];
    if (!j.completed) lines.push(`- ABORTED at step "${j.abortedAt}": \`${j.abortReason?.code}\`: ${j.abortReason?.message}`);
    for (const s of j.steps) {
      if (s.firstError) lines.push(`- step "${s.name}" failed once with \`${s.firstError.code}\` (${s.firstError.message}); the retry ${s.ok ? 'succeeded' : 'failed too'}`);
      for (const r of s.receipts.filter((r) => r.error)) lines.push(`- receipt ${r.step}${r.docId ? `/${r.docId}` : ''} in "${s.name}" recorded error \`${r.error}\` (attempts ${r.attempts}, cost ${r.costUsd === null ? 'unknown' : usd(r.costUsd)})`);
    }
    for (const f of j.findings) lines.push(`- ${f.kind}: ${f.note ?? ''}${f.question ? ` Question: "${f.question}"` : ''}${f.priorQuote ? ` Earlier: "${f.priorQuote}"` : ''}${f.proposed ? ` Proposed as facts: ${JSON.stringify(f.proposed)}` : ''}`);
    for (const [k, name] of KEYS) {
      const inv = j.invariants[k];
      if (inv.evaluable && !inv.pass) lines.push(`- invariant ${name} FAILED: ${JSON.stringify(inv.detail).slice(0, 900)}`);
    }
    if (j.skipped?.length) lines.push(`- skipped questions: ${j.skipped.map((q) => `${q.requirementId}: "${q.text}"`).join(' | ')}`);
    if (j.dropped?.length) lines.push(`- sentences the evidence check dropped at draft: ${j.dropped.map((d) => `${d.docId}: "${d.text}" (${d.reason})`).join(' | ')}`);
    const stages = j.steps.flatMap((s) => s.stages.map((x) => `${s.name}: ${x}`)).filter((x) => /Revising|asking|Keeping|left out|Adding/.test(x));
    if (stages.length) lines.push(`- loop decisions: ${stages.join(' | ')}`);
    console.log(`**${j.persona}${j.tag ? ` (${j.tag})` : ''}** (${j.style}; question answered: ${j.answered ? `${j.answered.requirementId}: "${j.answered.text}"` : 'none'})\n`);
    console.log(lines.length ? lines.join('\n') : '- clean');
    console.log('');
  }
}

for (const host of HOSTS) {
  const js = load(host);
  if (!js.length) { console.log(`## ${host}\n\nNo runs.\n`); continue; }
  const label = js[0].mode?.label ?? host;
  const ledger = Math.max(...js.map((j) => j.budgetEnd?.spentUsd ?? 0));
  console.log(`## ${label} (${host}): ledger total spent ${usd(ledger)} of cap ${usd(js[0].budgetStart?.capUsd ?? 0)}\n`);
  const variants = [...new Set(js.map(variantOf))].sort((a, b) => (a.startsWith('as written') ? -1 : b.startsWith('as written') ? 1 : a.localeCompare(b)));
  for (const v of variants) section(host, label, v, js.filter((j) => variantOf(j) === v));
}
