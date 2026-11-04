// Own language: the code's rules per language. Quote matching, citations and approvals
// work on any script; number words and "I" are read only in English. In another language
// only digits count, the applicant's confirmed English meaning carries the numbers into the
// English, and who did it comes from the actor tag she confirms (probe, 3 Nov: the English
// rules deleted every number from Portuguese and Polish runs and never saw "I").
import { describe, expect, it } from 'vitest';
import { claimProblem, citedFacts, statesNewNumber } from '../server/domain/claims.js';
import { confirmFacts, coverage, isOwnWork, proposeFacts } from '../server/domain/facts.js';
import { letterContributionGap } from '../server/domain/letterQuality.js';
import { isVerbatim, numbers } from '../server/domain/text.js';
import { runTool } from '../server/agent/tools.js';
import { verifyRun } from '../server/domain/verifyRun.js';
import { addSource, createWorkspace } from '../server/domain/workspace.js';
import { workspaceWithNotes } from './helpers.js';

const form = {
  id: 'care', company: 'North Yorkshire Council', role: 'Care and Support Worker',
  documents: [
    { id: 'answer', title: 'Supporting evidence', wordLimit: 500, requirements: [{ id: 'rota', text: 'Evenings and weekends' }, { id: 'initiative', text: 'Own initiative', personal: true }] },
    { id: 'letter', title: 'Cover letter', wordLimit: 350, requirements: [{ id: 'evidence', text: 'Experience' }] },
  ],
};
const NOTES = 'Fiz três anos de noites, e também fins de semana. Faço a medication round para 18 residentes. Nós, a equipa toda, passámos o jantar para mais cedo. Eu fiz cartões com fotografias da comida.';

function anaWorkspace(proposals) {
  const ws = createWorkspace({ form: structuredClone(form), applicant: 'Ana' });
  const source = addSource(ws, { kind: 'notes', text: NOTES, language: 'pt-PT' });
  source.read = true;
  const result = proposeFacts(ws, source.id, proposals);
  return { ws, source, result };
}

const nights = { statement: 'I did three years of nights, and weekends too.', quote: 'Fiz três anos de noites, e também fins de semana.', actor: 'self', requirementIds: ['rota'] };
const round = { statement: 'I do the medication round for 18 residents.', quote: 'Faço a medication round para 18 residentes.', actor: 'self', requirementIds: ['evidence'] };
const dinner = { statement: 'We, the whole team, moved dinner earlier.', quote: 'Nós, a equipa toda, passámos o jantar para mais cedo.', actor: 'team', requirementIds: ['initiative'] };
const cards = { statement: 'I made cards with photos of the food.', quote: 'Eu fiz cartões com fotografias da comida.', actor: 'self', requirementIds: ['initiative'] };

describe('numbers, per language', () => {
  it('reads number words in English only; elsewhere digits count', () => {
    expect(numbers('three years and 18 residents')).toEqual(['3', '18']);
    expect(numbers('três anos e 18 residentes', 'pt-PT')).toEqual(['18']);
    expect(numbers('vinte e dois residentes', 'pt-PT')).toEqual([]);
  });

  it('lets the English meaning say a number the quote speaks in words, but never drop one it writes in digits', () => {
    const { ws, result } = anaWorkspace([nights, round, { ...round, quote: 'para 18 residentes', statement: 'I do the medication round for many residents.' }]);
    expect(result.accepted).toEqual(['f1', 'f2']);
    expect(result.refused).toEqual([{ quote: 'para 18 residentes', reason: 'The English meaning drops a number the quote writes in digits.' }]);
    expect(ws.applicant.facts[0]).toMatchObject({ statement: nights.statement, quote: nights.quote, language: 'pt-PT', actor: 'self' });
  });

  it('keeps the English rule for English notes: a statement may not add a number', () => {
    const { ws, source } = workspaceWithNotes('Four of us built it.');
    const { refused } = proposeFacts(ws, source.id, [{ statement: 'Five of us built it.', quote: 'Four of us built it.', requirementIds: [] }]);
    expect(refused[0].reason).toBe('The statement has a number the quote does not.');
    expect(ws.applicant.facts[0]).toBeUndefined();
  });

  it('lets an English sentence state only numbers the cited facts state, through her confirmed meaning', () => {
    const { ws } = anaWorkspace([nights, round]);
    confirmFacts(ws, ['f1', 'f2']);
    const confirmed = new Map(ws.applicant.facts.map((f) => [f.id, f]));
    const cited = citedFacts(ws, ['f1', 'f2'], confirmed);
    expect(statesNewNumber('I worked three years of nights and do the round for 18 residents.', cited)).toBe(false);
    expect(statesNewNumber('I worked four years of nights.', cited)).toBe(true);
    expect(statesNewNumber('I do the round for 80 residents.', cited)).toBe(true);
    // English quotes alone, as before: "twelve" is 12.
    expect(statesNewNumber('We had 12 nodes.', [{ quote: 'We had twelve nodes.' }])).toBe(false);
  });

  it('verifies a Portuguese run’s numbers with the same rule', () => {
    const { ws } = anaWorkspace([nights]);
    confirmFacts(ws, ['f1']);
    ws.application.documents.answer = { id: 'answer', revision: 1, segments: [{ id: 'answer-1', kind: 'claim', text: 'I did three years of nights, and weekends too.', factIds: ['f1'], author: 'draft' }] };
    expect(verifyRun(ws).find((c) => c.id === 'numbers')).toMatchObject({ pass: true, count: 1 });
    ws.application.documents.answer.segments[0].text = 'I did five years of nights.';
    expect(verifyRun(ws).find((c) => c.id === 'numbers')).toMatchObject({ pass: false, failures: ['answer-1'] });
  });
});

describe('quotes match in any script, composed or not', () => {
  it('matches a quote typed with combining accents against the same words composed (NFC)', () => {
    const composed = 'Tenho a formação da medicação.';
    const decomposed = composed.normalize('NFD');
    expect(decomposed).not.toBe(composed);
    expect(isVerbatim(decomposed, composed)).toBe(true);
    expect(isVerbatim('formação', decomposed)).toBe(true);
    expect(runTool('verify_quote', { quote: decomposed }, { sources: [composed] })).toEqual({ verbatim: true });
    expect(isVerbatim('formacao', composed)).toBe(false);
  });
});

describe('who did it, from the confirmed actor tag', () => {
  it('refuses a fact in another language that does not say who did it', () => {
    const { result } = anaWorkspace([{ ...cards, actor: undefined }, { ...cards, actor: 'me' }]);
    expect(result.refused.map((r) => r.reason)).toEqual(['Say who did it: the applicant, the team or someone else.', 'Say who did it: the applicant, the team or someone else.']);
  });

  it('covers a personal point only with her own work: actor self, never team, whatever the meaning says', () => {
    const team = anaWorkspace([{ ...dinner, statement: 'I moved dinner earlier.' }]);
    confirmFacts(team.ws, ['f1']);
    expect(coverage(team.ws).find((r) => r.id === 'initiative').covered).toBe(false);
    const own = anaWorkspace([cards]);
    confirmFacts(own.ws, ['f1']);
    expect(isOwnWork(own.ws, own.ws.applicant.facts[0])).toBe(true);
    expect(coverage(own.ws).find((r) => r.id === 'initiative').covered).toBe(true);
  });

  it('suggests her own contribution for the letter from the actor tag too', () => {
    const { ws } = anaWorkspace([cards]);
    confirmFacts(ws, ['f1']);
    const gap = letterContributionGap(ws, [], coverage(ws));
    expect(gap).toMatchObject([{ id: 'letter-personal-contribution', factIds: ['f1'] }]);
    expect(letterContributionGap(ws, [{ kind: 'claim', text: 'I made photo cards of the food.', factIds: ['f1'] }], coverage(ws))).toEqual([]);
  });

  it('reads a fact in another language through its meaning and actor in the fixture’s word check', () => {
    const { ws } = anaWorkspace([dinner, cards]);
    confirmFacts(ws, ['f1', 'f2']);
    const confirmed = new Map(ws.applicant.facts.map((f) => [f.id, f]));
    expect(claimProblem('I moved dinner earlier for the whole unit.', citedFacts(ws, ['f1'], confirmed))).toBe('a claim says "I" where its facts say "we"');
    expect(claimProblem('We, the whole team, moved dinner earlier, and I made cards with photos of the food.', citedFacts(ws, ['f1', 'f2'], confirmed))).toBeNull();
  });
});

describe('a point the form wants stated directly', () => {
  // Live, 3 Nov: Wonder linked Ana's photo-cards example to the dignity point in 2 of 2 runs,
  // so the form check asked nothing. A point marked direct is covered only by her answer to it.
  it('is never covered by an example linked from her notes, only by her answer to its question', async () => {
    const { linkFacts } = await import('../server/domain/facts.js');
    const direct = structuredClone(form);
    direct.documents[0].requirements.push({ id: 'dignity', text: 'Awareness of dignity and respect', personal: true, direct: true });
    const ws = createWorkspace({ form: direct, applicant: 'Ana' });
    const notes = addSource(ws, { kind: 'notes', text: NOTES, language: 'pt-PT' });
    proposeFacts(ws, notes.id, [{ ...cards, requirementIds: ['initiative', 'dignity'] }]);
    confirmFacts(ws, ['f1']);
    expect(ws.application.coverage).toEqual({ initiative: ['f1'] });
    expect(linkFacts(ws, [{ requirementId: 'dignity', factIds: ['f1'] }]).refused).toEqual([{ requirementId: 'dignity', factId: 'f1', reason: 'Only the applicant’s answer to its own question covers this point.' }]);
    expect(coverage(ws).find((r) => r.id === 'dignity').covered).toBe(false);
    ws.application.questions.push({ id: 'q1', requirementId: 'dignity', text: 'O que é a dignidade para si?', status: 'answered' });
    const answer = addSource(ws, { kind: 'answer', text: 'Para mim, dignidade é bater à porta antes de entrar.', questionId: 'q1', language: 'pt-PT' });
    proposeFacts(ws, answer.id, [{ statement: 'For me, dignity is knocking before going in.', quote: 'Para mim, dignidade é bater à porta antes de entrar.', actor: 'self', requirementIds: ['dignity'] }]);
    confirmFacts(ws, ['f2']);
    expect(coverage(ws).find((r) => r.id === 'dignity')).toMatchObject({ covered: true, factIds: ['f2'] });
  });
});
