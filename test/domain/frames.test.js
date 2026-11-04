import { describe, expect, it } from 'vitest';
import { setDraft } from '../../server/domain/documents.js';
import { frameOptions } from '../../server/domain/frames.js';
import { draftedWorkspace } from '../helpers.js';

const problems = (ws, frame) => {
  try {
    setDraft(ws, 'answer', [{ kind: 'frame', text: frame }, { kind: 'claim', text: 'We chose Kubernetes Jobs.', factIds: ['f1'] }]);
    return [];
  } catch (error) {
    return error.details?.problems ?? [error.message];
  }
};

describe('frame sentences', () => {
  it('refuses claims smuggled after a greeting or inside a closing', async () => {
    const ws = await draftedWorkspace();
    expect(problems(ws, 'Dear Graphcore team, I deployed Kubernetes to production.')).not.toEqual([]);
    expect(problems(ws, 'Thank you for considering my award-winning work.')).not.toEqual([]);
  });
  async function blank() {
    const ws = await draftedWorkspace();
    ws.application.documents.answer = null;
    return ws;
  }

  it('accepts a greeting and a role line that uses the exact role title', async () => {
    const ws = await blank();
    expect(problems(ws, 'Dear Graphcore hiring team,')).toEqual([]);
    ws.application.documents.answer = null;
    expect(problems(ws, 'I am applying for the Graduate Cloud Platform Engineer 2027 role.')).toEqual([]);
  });

  // Live, 3 Nov: every applicant's letter was signed "Ellie", the sample's name.
  it('signs a letter off without a name when none is known, never with the sample’s', async () => {
    const ws = await draftedWorkspace();
    ws.applicant.name = null;
    const letter = (signOff) => {
      ws.application.documents.letter = null;
      try {
        setDraft(ws, 'letter', [{ kind: 'claim', text: 'We chose Kubernetes Jobs.', factIds: ['f1'] }, { kind: 'frame', text: signOff, startsParagraph: true }]);
        return [];
      } catch (error) {
        return error.details?.problems ?? [error.message];
      }
    };
    expect(frameOptions({ company: 'Graphcore', applicant: null }).closings.slice(-2)).toEqual(['Yours sincerely,', 'Kind regards,']);
    expect(letter('Kind regards,')).toEqual([]);
    expect(letter('Kind regards, Ellie')).not.toEqual([]);
  });

  it('refuses a frame that names the role by any other title', async () => {
    const ws = await blank();
    expect(problems(ws, 'I am applying for the Software Engineer role.')).toEqual([[0, 'a sentence that names the role must use its exact title']]);
    ws.application.documents.answer = null;
    expect(problems(ws, 'I would love this position.')).toEqual([[0, 'a sentence that names the role must use its exact title']]);
  });

  it('refuses a frame that states a number, which would be an unchecked claim', async () => {
    const ws = await blank();
    expect(problems(ws, 'I have 5 years of experience.')).toEqual([[0, 'a greeting or sign-off states no numbers']]);
  });
});
