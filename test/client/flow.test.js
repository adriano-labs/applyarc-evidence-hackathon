import { describe, expect, it } from 'vitest';
import { autoStep, defaultTab, factRequirements, packMarkdown, primaryAction, sourceKinds, unreadSource } from '../../client/src/flow.js';

const ws = (over = {}) => ({
  applicant: { sources: [{ id: 's1', kind: 'notes', text: 'n', read: true }, { id: 's2', kind: 'answer', text: 'a', read: false }], facts: [] },
  application: {
    form: { documents: [{ id: 'answer', title: 'Project answer' }, { id: 'letter', title: 'Cover letter' }] },
    coverage: { goal: ['f1', 'f2'], tech: ['f2'] },
    questions: [], documents: { answer: null, letter: null }, repair: null,
  },
  ...over,
});

describe('flow', () => {
  it('finds the first source that has not been read yet', () => {
    expect(unreadSource(ws()).id).toBe('s2');
  });

  it('names the main action for each step, or none when the rail holds the step', () => {
    expect(primaryAction({ next: 'read' }, ws())).toEqual({ id: 'read', label: 'Read my answer' });
    expect(primaryAction({ next: 'check' }, ws())).toEqual({ id: 'check', label: 'Check what the form still needs' });
    expect(primaryAction({ next: 'draft' }, ws())).toEqual({ id: 'draft', label: 'Write both documents' });
    expect(primaryAction({ next: 'export' }, ws())).toEqual({ id: 'export', label: 'Preview the export' });
    expect(primaryAction({ next: 'repair-proposal' }, ws())).toEqual({ id: 'repair', label: 'Propose the changes' });
    expect(primaryAction({ next: 'facts' }, ws())).toEqual({ id: null, hint: 'Now: confirm or reject each fact.', show: 'facts' });
    expect(primaryAction({ next: 'question' }, ws())).toEqual({ id: null, hint: 'Now: answer one question, or skip it.', show: 'question' });
    expect(primaryAction({ next: 'repair' }, ws())).toEqual({ id: null, hint: 'Now: review the proposed changes, then apply them.', show: 'repair' });
    expect(primaryAction({ next: 'notes' }, ws())).toBeNull();
  });

  it('offers the next application once this one has been exported', () => {
    const done = ws();
    done.application.exports = [{ id: 'e1' }];
    expect(primaryAction({ next: 'export' }, done)).toEqual({ id: 'next-application', label: 'Start your next application', secondary: { id: 'export', label: 'Open your pack' } });
  });

  it('points approval at the first document that still needs it', () => {
    const view = { next: 'approve', approvals: { answer: 'approved', letter: 'stale' } };
    expect(primaryAction(view, ws())).toEqual({ id: 'goto:letter', label: 'Review and approve the cover letter' });
  });

  it('approves the document on screen directly, naming its exact version', () => {
    const drafted = ws();
    drafted.application.documents = { answer: { id: 'answer', revision: 2, segments: [] }, letter: { id: 'letter', revision: 1, segments: [] } };
    const view = { next: 'approve', approvals: { answer: 'none', letter: 'none' }, stats: { answer: { words: 217, wordLimit: 300, overLimit: false }, letter: { words: 311, wordLimit: 300, overLimit: true } } };
    expect(primaryAction(view, drafted, 'answer')).toEqual({ id: 'approve:answer', label: 'Approve the project answer, version 2', docId: 'answer', docRevision: 2 });
    expect(primaryAction(view, drafted, 'notes')).toEqual({ id: 'goto:answer', label: 'Review and approve the project answer' });
    const letterNext = { ...view, approvals: { answer: 'approved', letter: 'none' } };
    expect(primaryAction(letterNext, drafted, 'letter')).toEqual({ id: null, hint: 'The cover letter is 311 words: shorten it to 300 before you approve it.' });
  });

  it('runs the cheap follow-up steps on its own, never the drafting', () => {
    expect(autoStep({ next: 'read' })).toBe('read');
    expect(autoStep({ next: 'check' })).toBe('check');
    expect(autoStep({ next: 'repair-proposal' })).toBe('repair');
    expect(autoStep({ next: 'draft' })).toBeNull();
    expect(autoStep({ next: 'facts' })).toBeNull();
  });

  it('opens the right tab for the step', () => {
    expect(defaultTab({ next: 'facts' }, ws())).toBe('notes');
    expect(defaultTab({ next: 'approve' }, ws())).toBe('answer');
    const repairing = ws();
    repairing.application.repair = { items: [{ docId: 'letter' }] };
    expect(defaultTab({ next: 'repair' }, repairing)).toBe('letter');
  });

  it('maps facts to the requirements they cover, and sources to their kinds', () => {
    expect(factRequirements(ws())).toEqual({ f1: ['goal'], f2: ['goal', 'tech'] });
    expect(sourceKinds(ws())).toEqual({ s1: 'notes', s2: 'answer' });
  });

  it('writes the export pack as Markdown that says NOT SUBMITTED first', () => {
    const md = packMarkdown({
      status: 'NOT SUBMITTED', notice: 'Nothing has been submitted.', createdAt: '2026-10-27T10:00:00.000Z',
      application: { company: 'Graphcore', role: 'Graduate Cloud Platform Engineer 2027', url: 'https://example.test/job', snapshotFetchedAt: '2026-10-26T22:41:53Z' },
      documents: [{ id: 'answer', title: 'Project answer', revision: 3, words: 212, wordLimit: 300, text: 'Para one.\n\nPara two.', references: [{ n: 1, statement: 'Four of us.', quote: 'four of us' }] }],
      portalTasks: ['Resume/CV'],
    });
    expect(md.split('\n')[0]).toBe('# NOT SUBMITTED: Graphcore · Graduate Cloud Platform Engineer 2027');
    expect(md).toContain('Nothing has been submitted.');
    expect(md).toContain('## Project answer (version 3, 212 of 300 words)');
    expect(md).toContain('Para one.\n\nPara two.');
    expect(md).toContain('1. Four of us. (your words: “four of us”)');
    expect(md).toContain('- [ ] Resume/CV');
    expect(md).toContain('Form: https://example.test/job (snapshot of 26 Oct 2026)');
  });
});
