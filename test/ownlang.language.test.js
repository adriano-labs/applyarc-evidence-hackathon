// Own language: each source records the language the applicant spoke or wrote (none means
// English), and a correction in another language keeps its English meaning and actor.
import { describe, expect, it } from 'vitest';
import { actions } from '../server/flows.js';
import { changeFact, confirmFacts, proposeFacts } from '../server/domain/facts.js';
import { holdSourceConflict } from '../server/domain/sourceConflicts.js';
import { resolveSourceConflict, sourceCorrections } from '../server/domain/sourceConflictCorrection.js';
import { addSource, createWorkspace } from '../server/domain/workspace.js';
import { form } from './helpers.js';

const fresh = () => createWorkspace({ form: structuredClone(form) });
const NIGHTS = 'Fiz três anos de noites, e também fins de semana.';
const CORRECTION = 'Correção: os turnos da noite foram dois anos, não três; no último ano passei a fazer dias.';

function withNightsFact() {
  const ws = fresh();
  const source = actions.notes(ws, { text: NIGHTS, language: 'pt-PT' });
  source.read = true;
  proposeFacts(ws, source.id, [{ statement: 'I did three years of nights, and weekends too.', quote: NIGHTS, actor: 'self', requirementIds: ['contribution'] }]);
  confirmFacts(ws, ['f1']);
  return ws;
}

describe('the language of each source', () => {
  it('records the chosen language, and records nothing for English', () => {
    const ws = fresh();
    expect(actions.notes(ws, { text: 'We built a GPU job runner.' })).not.toHaveProperty('language');
    const other = fresh();
    expect(actions.notes(other, { text: NIGHTS, language: 'pt-PT' }).language).toBe('pt-PT');
    expect(() => actions.notes(fresh(), { text: 'x y z', language: 'xx-XX' })).toThrow('Choose English or one of the languages offered.');
  });

  it('gives a later note and an answer the language of her latest words unless she says otherwise', () => {
    const ws = fresh();
    actions.notes(ws, { text: NIGHTS, language: 'pt-PT' });
    expect(actions.notes(ws, { text: 'Trabalho em Leeds.' }).language).toBe('pt-PT');
    ws.application.questions.push({ id: 'q1', requirementId: 'contribution', text: 'O que fez?', status: 'open' });
    expect(actions.answer(ws, { questionId: 'q1', text: 'Eu fiz os cartões.' }).source.language).toBe('pt-PT');
    expect(actions.notes(ws, { text: 'I also did weekends.', language: 'en' })).not.toHaveProperty('language');
  });

  it('starts Ana’s sample in Portuguese, and her own example in the language she chose', () => {
    const ana = { id: 'ana', name: 'Ana', form, notes: NIGHTS, language: 'pt-PT', liveOnly: false, clips: { notes: '/samples/a.wav' } };
    const ws = fresh();
    actions.startSample(ws, { sampleId: 'ana' }, { samples: [ana] });
    expect(ws.applicant.sources[0]).toMatchObject({ kind: 'notes', text: NIGHTS, language: 'pt-PT' });
    // Live, the sample starts from the words Voice Transcribe heard in its clip, as she checked them.
    const live = fresh();
    actions.startSample(live, { sampleId: 'ana', text: 'Fiz três anos de noites.' }, { samples: [ana], liveModel: true });
    expect(live.applicant.sources[0].text).toBe('Fiz três anos de noites.');
    const own = fresh();
    actions.startOwnApplication(own, { synthetic: true, requirementsConfirmed: true, applicant: 'Ana', company: 'C', role: 'R', notes: NIGHTS, question: 'Q?', requirements: [{ text: 'Nights' }], language: 'pt-PT' }, { liveModel: true });
    expect(own.applicant.sources[0].language).toBe('pt-PT');
  });
});

describe('a correction in another language', () => {
  it('needs her English meaning and who did it, and keeps both', () => {
    const ws = withNightsFact();
    expect(() => changeFact(ws, 'f1', CORRECTION)).toThrow('Give the English meaning of your correction, under 280 characters.');
    expect(() => changeFact(ws, 'f1', CORRECTION, undefined, { meaning: 'Nights were two years, not three.' })).toThrow('Say who did it: you, your team or someone else.');
    const fact = changeFact(ws, 'f1', CORRECTION, undefined, { meaning: 'Correction: the night shifts were two years, not three; in the last year I moved to days.', actor: 'self' });
    expect(fact).toMatchObject({ quote: CORRECTION, statement: 'Correction: the night shifts were two years, not three; in the last year I moved to days.', actor: 'self', language: 'pt-PT' });
    expect(fact.history[0]).toMatchObject({ quote: NIGHTS, statement: 'I did three years of nights, and weekends too.', actor: 'self' });
    expect(ws.applicant.sources.at(-1)).toMatchObject({ kind: 'correction', text: CORRECTION, language: 'pt-PT' });
  });

  it('gives back the earlier meaning and actor when the correction is undone', async () => {
    const { setDraft } = await import('../server/domain/documents.js');
    const { cancelRepair, startRepair } = await import('../server/domain/repair.js');
    const ws = withNightsFact();
    setDraft(ws, 'answer', [{ kind: 'claim', text: 'I did three years of nights, and weekends too.', factIds: ['f1'] }]);
    changeFact(ws, 'f1', 'Eles fizeram as noites.', undefined, { meaning: 'They did the nights.', actor: 'other' });
    startRepair(ws, 'f1');
    expect(cancelRepair(ws)).toMatchObject({ quote: NIGHTS, statement: 'I did three years of nights, and weekends too.', actor: 'self' });
  });

  it('holds a spoken correction with its question in her language, the English beneath, and her meaning', () => {
    const ws = withNightsFact();
    const note = addSource(ws, { kind: 'notes', text: CORRECTION, language: 'pt-PT' });
    const conflict = { quote: 'os turnos da noite foram dois anos, não três', priorSourceId: 's1', priorQuote: NIGHTS, question: 'Fez turnos da noite durante dois anos ou três?' };
    expect(() => holdSourceConflict(ws, note, [conflict])).toThrow('The source check could not ground its question in your words.');
    const glossed = { ...conflict, english: 'Did you work night shifts for two years or three?', meaning: 'The night shifts were two years, not three; in the last year I moved to days.', actor: 'self' };
    holdSourceConflict(ws, note, [glossed]);
    expect(ws.application.questions[0]).toMatchObject({ text: conflict.question, language: 'pt-PT', english: glossed.english, meaning: glossed.meaning, actor: 'self' });
    const [offer] = sourceCorrections(ws);
    expect(offer).toMatchObject({ factId: 'f1', meaning: glossed.meaning, actor: 'self' });
    const { fact, repair } = resolveSourceConflict(ws, offer);
    expect(fact).toMatchObject({ quote: CORRECTION, statement: glossed.meaning, actor: 'self', language: 'pt-PT' });
    expect(repair).toBeNull(); // nothing drafted yet, so nothing reopens
  });
});
