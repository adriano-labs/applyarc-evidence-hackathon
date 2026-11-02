import { describe, expect, it, vi } from 'vitest';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { changedUntouchedSegments, exactFact, scoreRun, pairCases, protocolLabel, segmentsCiting, scopeAccounting } from '../scripts/workflow-comparison/shared.mjs';
import { baselineBody, runBaselineCase } from '../scripts/workflow-comparison/baseline.mjs';
import { runAppCase } from '../scripts/workflow-comparison/app.mjs';
import { liveOptions, scopedTransport } from '../scripts/workflow-comparison/runtime.mjs';
import { prepareOwnApplication } from '../server/domain/ownForm.js';

const corpus = JSON.parse(readFileSync(new URL('../fixtures/workflow-comparison.json', import.meta.url)));

describe('frozen workflow comparison', () => {
  it('uses 12 distinct authored cases with separate expectations and truthful edits', () => {
    expect(corpus.cases).toHaveLength(12);
    expect(new Set(corpus.cases.map((c) => c.id)).size).toBe(12);
    for (const c of corpus.cases) {
      expect(c.input.notes).toContain(c.manual.source);
      expect(c.clarificationAnswer).toContain(c.correction.anchor);
      expect(c.correction.after).not.toBe(c.correction.before);
      expect(c.input.requirements.some((r) => r.personal)).toBe(true);
    }
  });
  it('refuses missing or ambiguous evidence rather than guessing a nearby fact', () => {
    const f = { id: 'f1', status: 'confirmed', quote: 'I wrote the checklist.' };
    expect(exactFact([f], 'wrote the checklist')).toEqual(f);
    expect(() => exactFact([f], 'wrote the report')).toThrow(/target/);
    expect(() => exactFact([f, { ...f, id: 'f2' }], 'wrote the checklist')).toThrow(/target/);
    expect(segmentsCiting({ segments: [] }, 'f1')).toEqual([]);
  });
  it('does not turn missing output or untested preservation into successful completion', () => {
    const c = corpus.cases[0];
    const missing = scoreRun(c, { status: 'failed', final: null });
    expect(missing.usableExport).toBe(false);
    expect(missing.semanticQuality).toBe('NOT GRADED');
    const final = { answer: c.correction.after, letter: c.correction.after };
    const scored = scoreRun(c, { status: 'completed', final, explicitConflictDecision: true });
    expect(scored.untouchedOriginalSegmentsPreserved).toBe(false);
    expect(scored.unrelatedManualWordingPreservation).toBe('NOT TESTED IN V3');
    expect(scored.correctedMarkersInAllAffectedDocuments).toBeNull();
  });
  it('gives the baseline full data but no expected labels or app writing instructions', () => {
    const c = corpus.cases[0];
    const body = baselineBody({ model: 'same', reasoning: true }, 'draft', { input: c.input, clarificationAnswer: c.clarificationAnswer });
    expect(body.instructions).not.toContain('inside ApplyArc Evidence');
    expect(body.input[0].content).toContain(c.clarificationAnswer);
    expect(body.input[0].content).not.toContain('correctedMarkers');
    expect(body.reasoning.effort).toBe('medium');
    expect(body.store).toBe(false);
  });
  it('v3 gives the assistant the actual app document requirements without a both-documents mandate', () => {
    const c = corpus.cases[0];
    const body = baselineBody({ model: 'offline' }, 'draft', { input: c.input, clarificationAnswer: c.clarificationAnswer });
    expect(body.instructions).not.toContain('Include the relevant individual contribution in both documents');
    const sent = JSON.parse(body.input[0].content.slice(body.input[0].content.indexOf('\n') + 1));
    const actual = prepareOwnApplication({ ...c.input, synthetic: true, requirementsConfirmed: true }, { liveModel: true }).form.documents;
    expect(sent.documentSpecs).toEqual(actual);
  });
  it('counterbalances order and includes failed runs without retrying a better case', async () => {
    const calls = [];
    const run = (method) => async (c) => { calls.push(`${method}:${c.id}`); if (c.id === 'a') throw new Error('private payload'); return { status: 'completed' }; };
    const save = vi.fn();
    const report = await pairCases([{ ...corpus.cases[0], id: 'a' }, { ...corpus.cases[1], id: 'b' }], { app: run('app'), baseline: run('baseline') }, save);
    expect(calls).toEqual(['baseline:a', 'app:a', 'app:b', 'baseline:b']);
    expect(report.runs).toHaveLength(4);
    expect(report.protocol).toBe('paired-full-workflow-v3');
    expect(report.caseStatus).toBe('SEEN DIAGNOSTIC CASES; NOT HOLDOUT');
    expect(report.scopeAccounting.app.retainedArms + report.scopeAccounting.baseline.retainedArms).toBe(4);
    expect(report.runs[0]).toMatchObject({ status: 'failed', failure: 'comparison-failed' });
    expect(JSON.stringify(report)).not.toContain('private payload');
    expect(save).toHaveBeenCalledTimes(4);
  });
  it('runs the actual app HTTP flow through two reviewed repaired documents and a new export', async () => {
    for (const c of corpus.cases) {
      const result = await runAppCase(c, {
      dataDir: mkdtempSync(join(tmpdir(), 'evidence-workflow-test-')), agent: offlineAgent(c),
    });
    expect(result.failure).toBeUndefined();
    expect(result.status).toBe('completed');
    expect(result.proposal.items).toHaveLength(2);
    expect(result.edited.answer).toContain('For clarity:');
    expect(result.final.answer).toContain(c.correction.after);
    expect(result.final.letter).toContain(c.manual.source);
    expect(result.trace.some((step) => step.action === 'decideChange')).toBe(true);
    expect(scoreRun(c, result)).toMatchObject({ usableExport: true, correctedMarkersInAllAffectedDocuments: true,
      untouchedOriginalSegmentsPreserved: true, explicitConflictDecision: true });
    }
  });
  it('keeps baseline proposals and edited documents for independent semantic review', async () => {
    const c = corpus.cases[0];
    const provider = { model: 'offline', reasoning: true, effort: 'medium' };
    const result = await runBaselineCase(c, { provider, transport: offlineAssistant(c) });
    expect(result.status).toBe('completed');
    expect(result.trace).toHaveLength(3);
    expect(result.final.letter).toContain(c.manual.source);
    expect(result.explicitConflictDecision).toBe(true);
  });
  it('v2 accepts the retained lab atomic motivation quotes without manufacturing a union citation', async () => {
    const c = corpus.cases.find((item) => item.id === 'lab-dilution');
    const result = await runAppCase(c, { dataDir: mkdtempSync(join(tmpdir(), 'evidence-v2-lab-')), agent: atomicAgent(c) });
    expect(result.failure).toBeUndefined();
    expect(result.status).toBe('completed');
    expect(result.facts.some((fact) => fact.quote.includes(c.manual.source))).toBe(false);
    expect(result.final.letter).toContain('I want to join Cobalt Lab');
    expect(result.final.letter).toContain('I enjoy checking procedures carefully');
    expect(result.untouchedChanges).toEqual([]);
    expect(result.trace.filter((step) => step.action === 'edit')).toHaveLength(1);
  });
  it('v3 leaves a letter without the correction fact unchanged rather than requiring a new contribution', async () => {
    const c = corpus.cases.find((item) => item.id === 'library-catalogue');
    const result = await runAppCase(c, { dataDir: mkdtempSync(join(tmpdir(), 'evidence-v2-library-')), agent: atomicAgent(c, true) });
    expect(result.status).toBe('completed');
    expect(result.failure).toBeUndefined();
    expect(result.original.answer).toContain(c.correction.before);
    expect(result.original.letter).not.toContain(c.correction.before);
    expect(result.final.letter).toBe(result.original.letter);
    expect(result.affectedDocuments).toEqual(['answer']);
    expect(result.originalCompleteness.status).toBe('NOT GRADED');
    expect(scoreRun(c, result).crossDocumentRepairExercised).toBe(false);
  });
  it('v3 repairs all citations while editing only the first affected segment deterministically', async () => {
    const c = corpus.cases[0];
    const base = offlineAgent(c);
    const agent = { ...base, draft: async (args) => {
      const result = await base.draft(args);
      if (args.doc.id === 'answer') {
        const target = result.segments.find((s) => s.text === c.correction.before);
        result.segments.push({ ...target, text: `For this project, ${target.text}` });
      }
      return result;
    } };
    const result = await runAppCase(c, { dataDir: mkdtempSync(join(tmpdir(), 'evidence-v3-multiple-')), agent });
    expect(result.status).toBe('completed');
    expect(result.affectedSegments.answer).toHaveLength(2);
    expect(result.proposal.items).toHaveLength(3);
    expect(result.untouchedChanges).toEqual([]);
    const assistant = await runBaselineCase(c, { provider: { model: 'offline' }, transport: offlineAssistant(c, { multipleAnswer: true }) });
    expect(assistant.status).toBe('completed');
    expect(assistant.affectedSegments.answer).toHaveLength(2);
    expect(assistant.proposal.changes).toHaveLength(3);
  });
  it('v3 records unexercised repair without injecting an absent contribution or claiming subset success', async () => {
    const c = corpus.cases[0];
    const result = await runBaselineCase(c, { provider: { model: 'offline' }, transport: offlineAssistant(c, true) });
    expect(result.status).toBe('completed');
    expect(result.trace).toHaveLength(2);
    expect(result.affectedDocuments).toEqual([]);
    expect(result.final).toEqual(result.original);
    expect(result.originalCompleteness.status).toBe('NOT GRADED');
    expect(scoreRun(c, result).correctedMarkersInAllAffectedDocuments).toBeNull();
    expect(scoreRun(c, result).crossDocumentRepairExercised).toBe(false);
  });
  it('v3 can correct only a letter and keeps original answer completeness ungraded', async () => {
    const c = corpus.cases[0];
    const result = await runBaselineCase(c, { provider: { model: 'offline' }, transport: offlineAssistant(c, { omitTargetAnswer: true }) });
    expect(result.status).toBe('completed');
    expect(result.affectedDocuments).toEqual(['letter']);
    expect(result.affectedManualEdit.docId).toBe('letter');
    expect(result.explicitConflictDecision).toBe(true);
    expect(result.final.answer).toBe(result.original.answer);
    expect(result.final.letter).toContain(c.correction.after);
    expect(scoreRun(c, result).originalCompleteness).toBe('NOT GRADED');
  });
  it('v3 updates app evidence but does not claim repair when neither document cites it', async () => {
    const c = corpus.cases[0];
    const base = offlineAgent(c);
    const agent = { ...base, draft: async (args) => {
      const result = await base.draft(args);
      result.segments = result.segments.filter((s) => s.text !== c.correction.before);
      return result;
    } };
    const result = await runAppCase(c, { dataDir: mkdtempSync(join(tmpdir(), 'evidence-v3-no-dependency-')), agent });
    expect(result.status).toBe('completed');
    expect(result.affectedDocuments).toEqual([]);
    expect(result.correctionAppliedToEvidence).toBe(true);
    expect(result.final).toEqual(result.original);
    expect(result.trace.some((step) => step.action === 'repair' || step.action === 'edit')).toBe(false);
    expect(scoreRun(c, result).explicitConflictDecision).toBeNull();
  });
  it('v3 accounts for all failed and unexercised arms, never just a favorable repair subset', () => {
    const summary = scopeAccounting([
      { method: 'app', status: 'failed' }, { method: 'app', status: 'completed', affectedDocuments: [] },
      { method: 'app', status: 'completed', affectedDocuments: ['answer'] },
      { method: 'app', status: 'failed', affectedDocuments: ['answer', 'letter'] },
    ]);
    expect(summary.app).toEqual({ retainedArms: 4, completedTechnicalWorkflows: 2, failedArms: 2,
      scopeNotReached: 1, noAffectedDocument: 1, oneAffectedDocument: 1, bothDocumentsAffected: 1 });
  });
  it('records removal and wording changes to untouched segments instead of accepting semantic similarity', () => {
    const originals = [{ docId: 'letter', segmentId: 'l1', text: 'I want this role.' },
      { docId: 'answer', segmentId: 'a1', text: 'We tested it.' }];
    const changes = changedUntouchedSegments({ letter: [{ id: 'l1', text: 'I like this role.' }], answer: [] }, originals);
    expect(changes).toEqual([{ ...originals[0], after: 'I like this role.' }, { ...originals[1], after: null }]);
  });
  it('does not permit unreviewed live cases or implicit spend settings', () => {
    expect(liveOptions({}, [], 'sha')).toBeNull();
    expect(() => liveOptions({}, ['--run-live'], 'sha')).toThrow('corpus-review-required');
    expect(() => liveOptions({ WORKFLOW_REVIEWED_CORPUS_SHA256: 'sha' }, ['--run-live'], 'sha')).toThrow('explicit-live-options-required');
  });
  it('serializes calls sharing a ledger and stops before an over-budget attempt', async () => {
    let active = 0; let peak = 0;
    const transport = { respond: vi.fn(async () => {
      active += 1; peak = Math.max(peak, active);
      await Promise.resolve(); active -= 1;
      return { usage: {}, costUsd: 0.001 };
    }) };
    const options = { transport, ledger: { summary: () => ({ spentUsd: 0 }) },
      provider: { model: 'muse-spark-1.3' }, armCapUsd: 1 };
    const scope = scopedTransport(options);
    await Promise.all([scope.respond({ max_output_tokens: 10 }), scope.respond({ max_output_tokens: 10 })]);
    expect(peak).toBe(1);
    const tiny = scopedTransport({ ...options, armCapUsd: 0.000001 });
    await expect(tiny.respond({ max_output_tokens: 100 })).rejects.toThrow('arm-budget-cap');
    expect(transport.respond).toHaveBeenCalledTimes(2);
  });
});

function offlineAgent(c) {
  return {
    provider: { id: 'test', model: 'offline', isMeta: false },
    extract: async ({ source }) => ({ facts: source.text.split('\n').map((text, i) => ({
      statement: text, quote: text, requirementIds: source.text === c.clarificationAnswer ? ['own-answer-1']
        : i === 0 ? ['own-answer-2', 'own-evidence'] : i === 1 ? ['own-answer-3'] : ['own-motivation'],
    })) }),
    clarify: async () => ({ coverage: [], questions: [{ requirementId: 'own-answer-1', question: 'What did you personally do?', why: 'Team work is not individual work.' }] }),
    draft: async ({ facts }) => ({ segments: facts.map((f) => ({ kind: 'claim', text: f.quote, factIds: [f.id], startsParagraph: true })) }),
    review: async ({ claims }) => ({ decisions: claims.map((claim) => ({ id: claim.id, verdict: 'supported', reason: 'offline test double' })) }),
    repair: async ({ fact, items }) => ({ rewrites: items.map((item) => ({ segmentId: item.segmentId, text: fact.quote, factIds: [fact.id] })) }),
  };
}

// Exact atomic quotes observed in the interrupted first trial run. The controlled
// draft double reproduces the library omission; no real model is called.
function atomicAgent(c, omitContributionLetter = false) {
  const quotes = c.id === 'library-catalogue'
    ? ['I like Aster Library', 'the role combines careful records with helping readers.']
    : ['I want to join Cobalt Lab', 'I enjoy checking procedures carefully'];
  const base = offlineAgent(c);
  return { ...base,
    extract: async (args) => {
      const result = await base.extract(args);
      return { facts: result.facts.flatMap((fact) => fact.quote === c.manual.source
        ? quotes.map((quote) => ({ statement: quote, quote, requirementIds: ['own-motivation'] })) : [fact]) };
    },
    draft: async (args) => {
      const result = await base.draft(args);
      if (omitContributionLetter && args.doc.id === 'letter') {
        const target = args.facts.find((fact) => fact.quote === c.correction.anchor);
        result.segments = result.segments.filter((segment) => !segment.factIds.includes(target.id));
      }
      return result;
    },
  };
}

function offlineAssistant(c, options = {}) {
  const omitTarget = options === true;
  let phase = 0;
  const doc = (id) => [
    { id: `${id}-motivation`, text: c.manual.source, evidenceQuotes: [c.manual.source] },
    ...(omitTarget || options.omitTargetLetter && id === 'letter' || options.omitTargetAnswer && id === 'answer'
      ? [] : [{ id: `${id}-contribution`, text: c.correction.before, evidenceQuotes: [c.correction.before] }]),
    ...(options.multipleAnswer && id === 'answer' ? [{ id: `${id}-context`, text: `For this project, ${c.correction.before}`, evidenceQuotes: [c.correction.before] }] : []),
  ];
  return { respond: async (body) => {
    phase += 1;
    let data = { questions: [], missing: [], answer: [], letter: [], changes: [] };
    if (phase === 1) data.questions = ['What did you personally do?'];
    else if (phase === 2) Object.assign(data, { answer: doc('answer'), letter: doc('letter') });
    else {
      const input = JSON.parse(body.input[0].content.slice(body.input[0].content.indexOf('\n') + 1));
      data = structuredClone(input.currentDocuments);
      for (const id of ['answer', 'letter']) {
        for (const target of data[id].filter((s) => s.evidenceQuotes.includes(c.correction.before))) {
          data.changes.push({ docId: id, segmentId: target.id, before: target.text, after: c.correction.after,
            needsReview: input.manualEdits.some((edit) => edit.docId === id && edit.segmentId === target.id) });
          target.text = c.correction.after; target.evidenceQuotes = [c.correction.after];
        }
      }
    }
    return { response: { output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(data) }] }] }, usage: {}, costUsd: 0 };
  } };
}

// v4: each arm gets one chance to ask about a conflict after the packet, and an arm
// that asks gets the same predeclared answer: the case's own correction, written
// before any run. Catching the inflated claim before drafting is recorded, not hidden.
describe('protocol v4: one predeclared answer to a post-packet question', () => {
  it('labels a held-out corpus as held out, never as seen cases', () => {
    const label = protocolLabel(true, true);
    expect(label.caseStatus).toMatch(/^HELD-OUT CASES/);
    expect(label.protocolChanges.join(' ')).not.toMatch(/already been seen|seen diagnostic cases/);
    expect(label.protocolChanges.at(-1)).toMatch(/^HELD-OUT CASES/);
    expect(protocolLabel(true).protocolChanges.join(' ')).toMatch(/already been seen/);
  });

  it('saves a v4 run as v4: the paired report carries the label the run chose', async () => {
    const done = async () => ({ status: 'completed' });
    const label = protocolLabel(true);
    const report = await pairCases([{ ...corpus.cases[0], id: 'a' }], { app: done, baseline: done }, async () => {}, label);
    expect({ ...label, ...report }).toMatchObject({ protocol: 'paired-full-workflow-v4', protocolChanges: label.protocolChanges });
    expect(label.protocolChanges.length).toBeGreaterThan(protocolLabel().protocolChanges.length);
  });

  const c = corpus.cases[0];
  const conflictAgent = () => ({
    ...offlineAgent(c),
    extract: async (args) => {
      if (args.source.text !== c.clarificationAnswer) return offlineAgent(c).extract(args);
      const notes = args.evidence.find((s) => s.kind !== 'answer' && s.id !== args.source.id);
      return { facts: [], conflicts: [{ quote: c.clarificationAnswer, priorSourceId: notes.id, priorQuote: notes.text.slice(0, 20), question: 'Was this practice work or real work?' }] };
    },
  });

  it('without v4 the app stops honestly at its own question, as in v3', async () => {
    const result = await runAppCase(c, { dataDir: mkdtempSync(join(tmpdir(), 'evidence-v4-off-')), agent: conflictAgent() });
    expect(result.status).toBe('failed');
    expect(result.continuation).toBeUndefined();
  });

  it('with v4 the app answers its open question with the case correction and records that it caught the claim early', async () => {
    const result = await runAppCase(c, { dataDir: mkdtempSync(join(tmpdir(), 'evidence-v4-on-')), agent: conflictAgent(), continuation: true });
    expect(result.failure).toBeUndefined();
    expect(result.status).toBe('completed');
    expect(result.continuation).toEqual({ question: 'Was this practice work or real work?', answer: c.correction.after });
    expect(result.correctionCaughtEarly).toBe(true);
    expect(Object.values(result.original).join(' ')).not.toContain(c.correction.before);
  });

  it('with v4 the baseline gets one reconcile question and, if it asks, the same answer before drafting', async () => {
    let phase = 0;
    const bodies = [];
    const transport = { respond: async (body) => {
      phase += 1;
      bodies.push(body);
      const data = { questions: [], missing: [], answer: [], letter: [], changes: [] };
      if (phase === 2) data.questions = ['Was this practice work or real work?'];
      if (phase === 3) Object.assign(data, { answer: [{ id: 'a1', text: c.correction.after, evidenceQuotes: [c.correction.after] }], letter: [{ id: 'l1', text: c.manual.source, evidenceQuotes: [c.manual.source] }] });
      return { response: { output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(data) }] }] }, usage: {}, costUsd: 0, requestId: `r${phase}`, timings: {} };
    } };
    const result = await runBaselineCase(c, { provider: { model: 'offline', reasoning: true, effort: 'medium' }, transport, continuation: true });
    expect(bodies[1].input[0].content).toContain('compare it with the notes');
    expect(result.continuation).toEqual({ questions: ['Was this practice work or real work?'], answer: c.correction.after });
    expect(bodies[2].input[0].content).toContain(JSON.stringify(c.correction.after).slice(1, -1));
  });
});

describe('finding the corrected fact', () => {
  it('matches the anchor at a word boundary, never inside another word', () => {
    const fact = (quote) => ({ id: quote, status: 'confirmed', quote });
    expect(exactFact([fact('Ravi designed the catalogue checklist.'), fact('I designed the catalogue checklist.')], 'I designed the catalogue checklist.').id).toBe('I designed the catalogue checklist.');
    expect(() => exactFact([fact('Ravi designed the catalogue checklist.')], 'I designed the catalogue checklist.')).toThrow();
  });
});

// Protocol v5 (29 Oct): under v4 the harness answered only a question on own-answer-1,
// so when the app asked its contribution question on another requirement the fixed
// answer arrived as unlinked notes. Seen corpus, requirements reordered; no model call.
describe('protocol v5 routing', () => {
  const reordered = (c) => ({ ...c, input: { ...c.input, requirements: [c.input.requirements[1], c.input.requirements[0], c.input.requirements[2]] } });
  const asksTwo = (c) => ({ ...offlineAgent(c),
    extract: async ({ source }) => ({ facts: source.text.split('\n').filter(Boolean).map((text) => ({ statement: text, quote: text, requirementIds: [] })) }),
    clarify: async () => ({ coverage: [], questions: [
      { requirementId: 'own-answer-1', question: 'What was the outcome?', why: 'The form asks for it.' },
      { requirementId: 'own-answer-2', question: 'What did you personally do?', why: 'Team work is not individual work.' }] }) });

  it('answers the question on the first requirement that asks what the applicant did, and records each skip', async () => {
    const c = reordered(corpus.cases[0]);
    const result = await runAppCase(c, { dataDir: mkdtempSync(join(tmpdir(), 'evidence-v5-')), agent: asksTwo(c), routing: 'personal' });
    expect(result.clarificationMode).toBe('answered-question');
    expect(result.answeredRequirement).toBe('own-answer-2');
    expect(result.skippedQuestions).toEqual(['own-answer-1', 'own-answer-3']);
  });

  it('keeps the v4 routing for the runs already recorded, and now records its skips too', async () => {
    const c = reordered(corpus.cases[0]);
    const result = await runAppCase(c, { dataDir: mkdtempSync(join(tmpdir(), 'evidence-v4-')), agent: asksTwo(c) });
    expect(result.answeredRequirement).toBe('own-answer-1');
    expect(result.skippedQuestions).toEqual(['own-answer-2', 'own-answer-3']);
  });

  it('labels a v5 report with every v3, v4 and v5 change', () => {
    const label = protocolLabel('v5', true);
    expect(label.protocol).toBe('paired-full-workflow-v5');
    expect(label.protocolChanges.join(' ')).toContain('first requirement the form marks as asking what the applicant did themselves');
    expect(protocolLabel(true).protocol).toBe('paired-full-workflow-v4');
  });
});

// Set 3B (ACCEPTANCE-SET3B.md): the applicant's own unrelated sentence is placed in
// both arms before the correction and must survive the repair character for character.
describe('the set 3B harness', () => {
  // A baseline double that rewrites the hand-edited sentence in its own words during the repair.
  const rewritesHandEdit = (c) => {
    const inner = offlineAssistant(c);
    let phase = 0;
    return { respond: async (body) => {
      const reply = await inner.respond(body);
      phase += 1;
      if (phase < 3) return reply;
      const content = reply.response.output[0].content[0];
      const data = JSON.parse(content.text);
      data.letter = data.letter.map((s) => (s.id === 'letter-motivation' ? { ...s, text: 'I would like to join a team that values careful work.' } : s));
      content.text = JSON.stringify(data);
      return reply;
    } };
  };

  it('keeps the applicant\'s own sentence through the app\'s repair and scores it', async () => {
    const c = corpus.cases[0];
    const result = await runAppCase(c, { dataDir: mkdtempSync(join(tmpdir(), 'evidence-3b-app-')), agent: offlineAgent(c), unrelatedEdit: true });
    expect(result.failure).toBeUndefined();
    expect(result.unrelatedEdit.docId).toBe('letter');
    expect(result.final.letter).toContain(result.unrelatedEdit.text);
    expect(scoreRun(c, result)).toMatchObject({ unrelatedManualWordingPreservation: true, untouchedOriginalSegmentsPreserved: true });
  });

  it('gives the baseline the same hand edit as a manual edit, and scores a lost one as lost', async () => {
    const c = corpus.cases[0];
    const provider = { model: 'offline' };
    const kept = await runBaselineCase(c, { provider, transport: offlineAssistant(c), unrelatedEdit: true });
    expect(kept.unrelatedEdit).toMatchObject({ docId: 'letter', segmentId: 'letter-motivation', text: c.manual.replacement });
    expect(scoreRun(c, kept).unrelatedManualWordingPreservation).toBe(true);
    const lost = await runBaselineCase(c, { provider, transport: rewritesHandEdit(c), unrelatedEdit: true });
    expect(scoreRun(c, lost)).toMatchObject({ unrelatedManualWordingPreservation: false, untouchedOriginalSegmentsPreserved: false });
  });

  it('leaves the check marked untested outside set 3B', async () => {
    const c = corpus.cases[0];
    const result = await runBaselineCase(c, { provider: { model: 'offline' }, transport: offlineAssistant(c) });
    expect(scoreRun(c, result).unrelatedManualWordingPreservation).toBe('NOT TESTED IN V3');
  });
});
