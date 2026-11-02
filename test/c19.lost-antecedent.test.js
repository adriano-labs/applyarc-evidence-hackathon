import { describe, expect, it } from 'vitest';
import { reviewKey } from '../server/agent/evidenceReview.js';
import { draftProblems } from '../server/domain/documents.js';
import { decideFact, proposeFacts } from '../server/domain/facts.js';
import { workspaceWithNotes } from './helpers.js';

// Seen in set 4 (warehouse to learning support): "I asked them to…" was about one
// learner in the notes, but the letter put it straight after "I supported four
// learners…", so "them" read as the whole group.
const notes = [
  'I supported four learners with saving and finding documents during that session; six people attended altogether.',
  'One learner kept losing their file because they clicked through the save window too quickly. I asked them to choose a short filename, wrote down the folder location and let them repeat the steps on their own.',
].join('\n\n');
const four = 'I supported four learners with saving and finding documents during that session; six people attended altogether.';
const one = 'One learner kept losing their file because they clicked through the save window too quickly.';
const them = 'I asked them to choose a short filename, wrote down the folder location and let them repeat the steps on their own.';

function ws3() {
  const { ws, source } = workspaceWithNotes(notes);
  proposeFacts(ws, source.id, [four, one, them].map((quote) => ({ statement: quote, quote, requirementIds: ['evidence'] })));
  for (const f of ws.applicant.facts) decideFact(ws, f.id, 'confirm');
  return ws;
}
const claim = (text, factIds) => ({ kind: 'claim', text, factIds });
const problemsFor = (ws, segments) => new Map(draftProblems(ws, segments, new Map(segments.map((s) => [reviewKey(ws, s), null]))));

describe('a "them" sentence never turns one person into a group', () => {
  it('refuses a "them" sentence placed after a different group', () => {
    const ws = ws3();
    const problems = problemsFor(ws, [claim(four, ['f1']), claim(them, ['f3'])]);
    expect(problems.get(1)).toMatch(/^turns one learner into several/);
  });

  it('accepts it right after the sentence that says who they are', () => {
    const ws = ws3();
    expect(problemsFor(ws, [claim(four, ['f1']), claim(one, ['f2']), claim(them, ['f3'])]).size).toBe(0);
  });

  it('refuses the same slip inside one sentence', () => {
    const ws = ws3();
    const merged = claim('I supported four learners with saving documents and asked them to choose a short filename.', ['f1', 'f3']);
    expect(problemsFor(ws, [merged]).get(0)).toMatch(/^turns one learner into several/);
  });

  it('accepts a sentence that names the learner itself', () => {
    const ws = ws3();
    const named = claim('I asked the learner who kept losing their file to choose a short filename and let them repeat the steps.', ['f3']);
    expect(problemsFor(ws, [claim(four, ['f1']), named]).size).toBe(0);
  });

  it('accepts one sentence that cites both', () => {
    const ws = ws3();
    expect(problemsFor(ws, [claim('One learner kept losing their file, so I asked them to choose a short filename and let them repeat the steps.', ['f2', 'f3'])]).size).toBe(0);
  });
});

// Seen in review: the quote says who "them" is itself, and an earlier fact only
// mentions "a session" while the sentence before says "sessions".
describe('a quote that names its own person', () => {
  it('is never read as one session turned into several', () => {
    const quotes = ['I have taught digital skills sessions since 2024', 'I ran a session for four learners on saving documents',
      'One learner kept losing their file, so I asked them to choose a short filename'];
    const { ws, source } = workspaceWithNotes(`${quotes.join('. ')}.`);
    proposeFacts(ws, source.id, quotes.map((quote) => ({ statement: quote, quote, requirementIds: ['evidence'] })));
    for (const f of ws.applicant.facts) decideFact(ws, f.id, 'confirm');
    expect(problemsFor(ws, [claim('I have taught digital skills sessions since 2024.', ['f1']), claim(`${quotes[2]}.`, ['f3'])]).size).toBe(0);
  });
});

// Seen in re-review: "a week" before "them" was taken for the quote naming its own
// person, and a merged sentence citing a self-naming quote slipped through.
describe('only "one …" in the quote names its own person', () => {
  const quotes = ['I supported four learners with saving documents.', 'One learner kept losing their file.', 'After a week I asked them to choose a short filename.'];
  function ws4() {
    const { ws, source } = workspaceWithNotes(quotes.join(' '));
    proposeFacts(ws, source.id, quotes.map((quote) => ({ statement: quote, quote, requirementIds: ['evidence'] })));
    for (const f of ws.applicant.facts) decideFact(ws, f.id, 'confirm');
    return ws;
  }

  it('still refuses "After a week I asked them…" after the group', () => {
    expect(problemsFor(ws4(), [claim(quotes[0], ['f1']), claim(quotes[2], ['f3'])]).get(1)).toMatch(/^turns one learner into several/);
  });

  it('refuses a merged sentence that drops the one learner a self-naming quote names', () => {
    const own = 'One learner kept losing their file, so I asked them to choose a short filename.';
    const { ws, source } = workspaceWithNotes(`I supported four learners with saving documents. ${own}`);
    proposeFacts(ws, source.id, [quotes[0], own].map((quote) => ({ statement: quote, quote, requirementIds: ['evidence'] })));
    for (const f of ws.applicant.facts) decideFact(ws, f.id, 'confirm');
    const merged = claim('I supported four learners with saving documents and asked them to choose a short filename.', ['f1', 'f2']);
    expect(problemsFor(ws, [merged]).get(0)).toMatch(/^turns one learner into several/);
  });
});

