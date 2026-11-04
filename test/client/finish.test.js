import { describe, expect, it } from 'vitest';
import { happenedLines, refusedCount } from '../../client/src/lib/finish.js';

const receipt = (step, extra = {}) => ({ step, provider: 'meta', isMeta: true, model: 'muse-wonder-1.0', costUsd: 0.1, totalMs: 60000, toolCalls: [{ name: 'verify_quote', note: 'verbatim' }], ...extra });
const stage = (label) => ({ kind: 'stage', flow: 'draft', label, at: '2026-11-03T10:00:00.000Z' });
const ws = (over = {}) => ({
  applicant: { facts: [{ id: 'f1', status: 'confirmed' }, { id: 'f2', status: 'confirmed' }, { id: 'f3', status: 'rejected' }] },
  application: { form: { documents: [{ id: 'answer', title: 'Project answer' }, { id: 'letter', title: 'Cover letter' }] }, documents: { answer: { revision: 2 }, letter: { revision: 2 } }, lastRepair: null, ...over },
});
const view = { approvals: { answer: 'approved', letter: 'approved' } };

describe('what just happened', () => {
  it('counts the sentences the evidence check refused from the recorded stage rows only', () => {
    expect(refusedCount([])).toBe(0);
    expect(refusedCount([stage('Revising 2 unsupported sentences'), stage('Revising 1 unsupported repair sentence'), stage('The evidence check refused 3 sentences; asking for a fix'), receipt('revise')])).toBe(3);
  });

  it('says what the state and the receipts hold, and nothing more', () => {
    const rows = [receipt('extract'), receipt('draft', { docId: 'answer' }), stage('Revising 2 unsupported sentences'), receipt('revise', { docId: 'answer', toolCalls: [] })];
    expect(happenedLines(ws({ lastRepair: { factId: 'f1', changed: 2, kept: 0, reopened: 3, untouched: 17 } }), view, rows)).toEqual([
      '2 facts confirmed.',
      'You approved version 2 of both documents.',
      '1 fact corrected: it reopened 3 sentences and left 17 untouched.',
      'Meta: 3 model steps, 2 tool calls, 3 min 0 s total model time, $0.300 estimated.',
      'Wonder’s own review refused 2 sentences and sent them back to Wonder to rewrite.',
      'Nothing has been sent.',
    ]);
  });

  it('omits correction counts an older saved state does not hold, and a rewrite no receipt records', () => {
    const lines = happenedLines(ws({ lastRepair: { factId: 'f1', changed: 1, kept: 0 } }), view, [receipt('extract'), stage('Revising 1 unsupported sentence')]);
    expect(lines).toContain('1 fact corrected.');
    expect(lines).toContain('The model review refused 1 sentence.');
    expect(lines.at(-1)).toBe('Nothing has been sent.');
  });

  it('names the fixture as the fixture, with no model time and no estimate', () => {
    const rows = [{ step: 'extract', provider: 'fixture', model: 'fixture', costUsd: 0, toolCalls: [] }, { step: 'draft-answer', provider: 'fixture', model: 'fixture', costUsd: 0, toolCalls: [] }];
    expect(happenedLines(ws(), view, rows)).toEqual(['2 facts confirmed.', 'You approved version 2 of both documents.', 'The fixture (hand-written, not a model): 2 steps, 0 tool calls, $0.00.', 'Nothing has been sent.']);
  });

  it('leaves out what is not approved or not recorded, and says when a cost is not settled', () => {
    expect(happenedLines(ws(), { approvals: {} }, [])).toEqual(['2 facts confirmed.', 'Nothing has been sent.']);
    expect(happenedLines(ws(), view, [receipt('draft', { costUsd: null })])).toContain('Meta: 1 model step, 1 tool call, 1 min 0 s total model time, cost not settled.');
  });
});
