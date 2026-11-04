import { describe, expect, it } from 'vitest';
import { actorOf, approvalRow, codeRows, decisionRows, docTitles, drafter, family, formatAudio, groupRuns, readSource, repairProvenance, runFigures, runTitle, stepSentence, summaryLine, tallyLine, toolTally, trailRuns } from '../../client/src/lib/trail.js';

const at = (minutes) => new Date(Date.UTC(2026, 10, 3, 10, minutes)).toISOString();
const receipt = (step, flow, extra = {}) => ({ step, flow, provider: 'meta', isMeta: true, model: 'muse-wonder-1.0', costUsd: 0.01, totalMs: 1000, toolCalls: [], ...extra });

describe('the evidence trail', () => {
  it('groups consecutive receipts of one flow into numbered runs, splitting at a long pause', () => {
    const runs = groupRuns([
      receipt('extract', 'read', { at: at(0) }), receipt('clarify', 'check', { at: at(1) }),
      receipt('draft', 'draft', { at: at(2) }), { kind: 'stage', flow: 'draft', label: 'Revising 1 unsupported sentence', at: at(2) }, receipt('revise', 'draft', { at: at(3) }),
      receipt('draft', 'draft', { at: at(20) }),
    ]);
    expect(runs.map((r) => [r.n, r.flow, r.rows.length, r.receipts.length])).toEqual([[1, 'read', 1, 1], [2, 'check', 1, 1], [3, 'draft', 3, 2], [4, 'draft', 1, 1]]);
    expect(runs[2]).toMatchObject({ totalMs: 2000, costUsd: 0.02, costComplete: true, timed: true, failed: false, host: null });
  });

  it('falls back to the step to name a flow, and sums what is there', () => {
    const runs = groupRuns([{ step: 'draft', provider: 'meta', model: 'muse-spark-1.3', costUsd: null, toolCalls: [], error: 'cut' }, { step: 'transcribe', provider: 'meta', model: 'muse-voice-transcribe-1.0', costUsd: 0.0002, totalMs: 1800, host: 'api.meta.ai' }]);
    expect(runs.map((r) => r.flow)).toEqual(['draft', 'voice']);
    expect(runFigures(runs[0])).toBe('cost not settled');
    expect(runs[0].failed).toBe(true);
    expect(runFigures(runs[1])).toBe('1.8 s · $0.0002');
    expect(runs[1].host).toBe('api.meta.ai');
    expect(runFigures(groupRuns([{ step: 'extract', provider: 'fixture', model: 'fixture', costUsd: 0, toolCalls: [] }])[0])).toBe('$0.00');
  });

  it('writes one sentence per recorded step, naming the document when the receipt does', () => {
    expect(stepSentence(receipt('extract', 'read'))).toBe('Read your words');
    expect(stepSentence(receipt('clarify', 'check'))).toBe('Compared your facts with what the form asks for');
    expect(stepSentence(receipt('draft', 'draft', { docId: 'answer' }))).toBe('Drafted “Project answer”');
    expect(stepSentence(receipt('draft', 'draft', { docId: 'letter' }))).toBe('Drafted “Cover letter”');
    expect(stepSentence(receipt('draft', 'draft'))).toBe('Drafted a document');
    expect(stepSentence({ step: 'draft-letter', flow: 'draft', provider: 'fixture' })).toBe('Drafted “Cover letter”');
    // The form names the documents (Marcus's answer is "Why this role").
    const titles = docTitles({ application: { form: { documents: [{ id: 'answer', title: 'Why this role' }, { id: 'letter' }] } } });
    expect(titles).toEqual({ answer: 'Why this role', letter: 'Cover letter' });
    expect(stepSentence(receipt('draft', 'draft', { docId: 'answer' }), titles)).toBe('Drafted “Why this role”');
    expect(stepSentence(receipt('review', 'draft'))).toBe('Reviewed the cited sentences against their facts');
    expect(stepSentence(receipt('review', 'repair'))).toBe('Reviewed the proposed sentences against the facts they cite');
    expect(stepSentence(receipt('review', 'strengthen'))).toBe('Reviewed the suggestion against the facts it cites');
    expect(stepSentence(receipt('revise', 'draft'))).toBe('Rewrote only the sentences the check refused');
    expect(stepSentence(receipt('repair', 'repair'))).toBe('Proposed new wording for the sentences that cite the corrected fact');
    expect(stepSentence(receipt('transcribe', 'voice', { audioMs: 6400 }))).toBe('Turned 6 s of speech into text');
    expect(stepSentence(receipt('transcribe', 'voice'))).toBe('Turned your speech into text');
    expect(stepSentence(receipt('strengthen', 'strengthen'))).toBe('Looked for a stronger sentence your facts support');
    expect(stepSentence(receipt('something-new', 'read'))).toBe('something-new');
  });

  it('turns the app’s own tool results into rows, in the order they were first called', () => {
    const calls = [
      { name: 'form_requirements', ok: true, note: 'read' },
      { name: 'verify_quote', ok: true, note: 'verbatim' }, { name: 'verify_quote', ok: true, note: 'verbatim' }, { name: 'verify_quote', ok: true, note: 'not verbatim' },
      { name: 'word_count', ok: true, note: '198 of 300' }, { name: 'word_count', ok: true, note: '204 of 300' },
    ];
    expect(codeRows(calls)).toEqual(['Read the form', 'Checked 3 quotes against your words: 2 word for word · 1 not word for word', 'Counted the words: 198 of 300 · 204 of 300']);
    expect(codeRows([{ name: 'verify_quote', note: 'verbatim' }])).toEqual(['Checked 1 quote against your words: 1 word for word']);
    expect(codeRows([])).toEqual([]);
    expect(codeRows(undefined)).toEqual([]);
    expect(toolTally(calls)).toBe('form_requirements: read ×1 · verify_quote: verbatim ×2 · verify_quote: not verbatim ×1 · word_count: 198 of 300 ×1 · word_count: 204 of 300 ×1');
    expect(toolTally([])).toBe('');
  });

  it('tallies a running step from the counts streamed so far, and says nothing without them', () => {
    expect(tallyLine(undefined)).toBeNull();
    expect(tallyLine({})).toBeNull();
    expect(tallyLine({ verify_quote: 1, verbatim: 1 })).toBe('Checked 1 quote word for word so far');
    expect(tallyLine({ verify_quote: 7, verbatim: 6, form_requirements: 1 })).toBe('Checked 7 quotes against your words: 6 word for word so far · Read the form');
    expect(tallyLine({ word_count: 2, words: '198 of 300' })).toBe('Counted the words: 198 of 300');
  });

  it('names each run and maps the k-th read run to the k-th source the applicant gave', () => {
    const workspace = { applicant: { sources: [{ id: 's1', kind: 'notes' }, { id: 'c1', kind: 'correction' }, { id: 's2', kind: 'answer' }], facts: [] } };
    expect(readSource(workspace, 0)).toMatchObject({ id: 's1' });
    expect(readSource(workspace, 1)).toMatchObject({ id: 's2' });
    expect(readSource(workspace, 2)).toBeNull();
    expect(readSource(null, 0)).toBeNull();
    // A prepared workspace: its saved sources were read before this visit and get no run here.
    const prepared = { prepared: { loadedAt: '2026-11-03T17:00:00Z' }, applicant: { sources: [
      { id: 's1', kind: 'notes', at: '2026-11-03T16:03:00Z' }, { id: 's2', kind: 'answer', at: '2026-11-03T16:04:00Z' },
      { id: 's3', kind: 'notes', at: '2026-11-03T17:00:05Z' }], facts: [] } };
    expect(readSource(prepared, 0)).toMatchObject({ id: 's3' });
    expect(readSource(prepared, 1)).toBeNull();
    expect(runTitle('read', readSource(workspace, 0))).toBe('Read your notes');
    expect(runTitle('read', readSource(workspace, 1))).toBe('Read your answer');
    expect(runTitle('read', null)).toBe('Read your words');
    expect(['check', 'draft', 'repair', 'strengthen', 'voice', undefined].map((flow) => runTitle(flow))).toEqual(['Checked the form', 'Wrote both documents', 'Proposed changes after your correction', 'Looked for a stronger sentence', 'Heard your words', 'Model steps']);
  });

  it('reads the applicant’s decisions from saved state only, and shows none when it is absent', () => {
    const workspace = {
      applicant: { sources: [{ id: 's1', kind: 'notes' }, { id: 'c1', kind: 'correction' }], facts: [{ id: 'f1', sourceId: 's1', status: 'confirmed' }, { id: 'f2', sourceId: 's1', status: 'proposed' }, { id: 'f3', sourceId: 'c1', status: 'confirmed', history: [{ sourceId: 's1' }] }] },
      application: {
        form: { documents: [{ id: 'answer', title: 'Project answer' }, { id: 'letter', title: 'Cover letter' }] },
        documents: { answer: { revision: 3 }, letter: { revision: 2 } },
        questions: [{ status: 'answered' }, { status: 'skipped' }, { status: 'open' }, { kind: 'source-conflict', status: 'answered' }],
        lastRepair: { changed: 1, at: at(30) },
      },
    };
    const source = readSource(workspace, 0);
    // A fact corrected later still counts for the notes it was read from.
    expect(decisionRows({ flow: 'read', source }, workspace, {})).toEqual(['You confirmed 2 facts']);
    expect(decisionRows({ flow: 'read', source: null }, workspace, {})).toEqual([]);
    // Only the check that asked closes with the answers; a settled source conflict is a correction, not an answer.
    expect(decisionRows({ flow: 'check', askRun: true }, workspace, {})).toEqual(['You answered the question', 'You skipped the question', 'A question is waiting for your answer']);
    expect(decisionRows({ flow: 'check' }, workspace, {})).toEqual([]);
    expect(decisionRows({ flow: 'draft', lastDocRun: true }, workspace, { approvals: { answer: 'approved', letter: 'approved' } })).toEqual(['You approved version 3 of “Project answer” and version 2 of “Cover letter”']);
    expect(decisionRows({ flow: 'draft', lastDocRun: true }, workspace, { approvals: { answer: 'approved' } })).toEqual(['You approved version 3 of “Project answer”']);
    expect(decisionRows({ flow: 'draft', lastDocRun: false }, workspace, { approvals: { answer: 'approved', letter: 'approved' } })).toEqual([]);
    // The apply belongs to the repair run it followed, never to a later one still waiting or undone.
    expect(decisionRows({ flow: 'repair', lastRepairRun: true, lastDocRun: true, endAt: at(20) }, workspace, { approvals: {} })).toEqual(['You applied 1 change']);
    expect(decisionRows({ flow: 'repair', lastRepairRun: true, endAt: at(40) }, workspace, {})).toEqual([]);
    expect(decisionRows({ flow: 'repair', lastRepairRun: false }, workspace, {})).toEqual([]);
    expect(decisionRows({ flow: 'voice' }, workspace, {})).toEqual([]);
    expect(decisionRows({ flow: 'check', askRun: true }, null, null)).toEqual([]);
  });

  it('titles each run by what happened, and closes only the asking check and the followed repair', () => {
    const workspace = {
      applicant: { sources: [{ id: 's1', kind: 'notes' }], facts: [] },
      application: { form: { documents: [] }, documents: {}, questions: [{ status: 'answered' }], lastRepair: { changed: 2, at: at(50) } },
    };
    const rows = [
      receipt('extract', 'read', { at: at(0) }), receipt('clarify', 'check', { at: at(1) }), receipt('extract', 'read', { at: at(12) }), receipt('clarify', 'check', { at: at(13) }),
      receipt('draft', 'draft', { at: at(20), docId: 'answer' }), receipt('draft', 'draft', { at: at(21), docId: 'letter', error: 'timeout' }), receipt('review', 'draft', { at: at(22) }),
      receipt('repair', 'repair', { at: at(40) }), receipt('repair', 'repair', { at: at(60), error: 'cut' }),
    ];
    // The draft's letter timed out while the answer's review went on: nothing was saved.
    expect(trailRuns(rows, workspace, {}).map((g) => [g.title, g.decisions])).toEqual([
      ['Read your notes', []], ['Checked the form', ['You answered the question']], ['Read your words', []], ['Checked the form', []],
      ['Did not finish', []], ['Proposed changes after your correction', []], ['Did not finish', []],
    ]);
    // Tried again within the run and saved: the run finished, with the failed step still in it.
    const saved = { ...workspace, application: { ...workspace.application, documents: { answer: { revision: 1 }, letter: { revision: 1 } } } };
    expect(trailRuns(rows.slice(4, 7), saved, {}).map((g) => g.title)).toEqual(['Wrote both documents']);
    expect(trailRuns(rows.slice(7, 8), workspace, {}).map((g) => g.decisions)).toEqual([['You applied 2 changes']]);
  });

  it('sums the closed line from the model steps alone', () => {
    expect(summaryLine([], 0)).toEqual({ line: 'No model calls yet', notSettled: 0 });
    const rows = [receipt('extract', 'read', { toolCalls: [{ name: 'verify_quote', note: 'verbatim' }] }), { kind: 'stage', flow: 'read', label: 'Reading' }, receipt('draft', 'draft', { costUsd: null })];
    expect(summaryLine(rows, 2)).toEqual({ line: 'muse-wonder-1.0 · 2 runs · 2 steps · 1 tool call · 2.0 s total model time · $0.010 + 1 not settled', notSettled: 1 });
  });

  it('tags rows by the recorded model, never by styling, and names the proposer of a repair', () => {
    expect(actorOf({ provider: 'fixture', model: 'fixture' })).toBe('Fixture');
    expect(actorOf({ provider: 'meta', isMeta: true, model: 'muse-wonder-1.0' })).toBe('Wonder');
    expect(actorOf({ provider: 'compatible', isMeta: true, model: 'meta-models/Muse-Spark-Open-816B-A42B' })).toBe('Spark Open');
    expect(actorOf({ provider: 'meta', isMeta: true, model: 'muse-spark-1.3' })).toBe('Spark');
    expect(actorOf({ provider: 'meta', isMeta: true, model: 'muse-voice-transcribe-1.0' })).toBe('Voice');
    expect(actorOf({ provider: 'other', isMeta: false, model: 'other-model' })).toBe('Model');
    expect(family('other-model', false)).toEqual({ tag: 'Model', name: 'other-model' });
    expect(family(undefined, true)).toEqual({ tag: 'Model', name: 'The model' });
    const repair = receipt('repair', 'repair');
    expect(repairProvenance([repair, receipt('review', 'repair')])).toBe('Proposed by Muse Wonder, then reviewed by the same model against the facts each sentence cites');
    expect(repairProvenance([repair, receipt('review', 'draft')])).toBe('Proposed by Muse Wonder');
    expect(repairProvenance([{ ...repair, provider: 'fixture', model: 'fixture' }])).toBeNull();
    expect(repairProvenance([])).toBeNull();
  });

  it('formats speech length in whole seconds', () => {
    expect(formatAudio(6400)).toBe('6 s');
    expect(formatAudio(200)).toBe('1 s');
    expect(formatAudio(61000)).toBe('1 min 1 s');
    expect(formatAudio(undefined)).toBeNull();
    expect(formatAudio(NaN)).toBeNull();
  });
});

describe('naming what drafted and what was approved', () => {
  it('names what drafted the documents from the latest draft step', () => {
    expect(drafter([])).toBeNull();
    expect(drafter([receipt('extract', 'read'), receipt('draft', 'draft', { docId: 'answer' })])).toBe('Wonder');
    expect(drafter([receipt('draft', 'draft', { model: 'muse-spark-1.3' })])).toBe('Spark');
    expect(drafter([{ step: 'draft-letter', provider: 'fixture', model: 'fixture' }])).toBe('The fixture');
    expect(drafter([receipt('draft', 'draft', { isMeta: false, model: 'other-model' })])).toBe('The model');
  });

  it('reads the approved versions from saved state', () => {
    const workspace = { application: { form: { documents: [{ id: 'answer', title: 'Project answer' }, { id: 'letter', title: 'Cover letter' }] }, documents: { answer: { revision: 2 }, letter: { revision: 1 } } } };
    expect(approvalRow(workspace, { approvals: {} })).toBeNull();
    expect(approvalRow(workspace, { approvals: { answer: 'approved', letter: 'approved' } })).toBe('You approved version 2 of “Project answer” and version 1 of “Cover letter”');
    workspace.application.documents.letter.revision = 2;
    expect(approvalRow(workspace, { approvals: { answer: 'approved', letter: 'approved' } })).toBe('You approved version 2 of both documents');
  });
});
