// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QuestionCard } from '../../client/src/components/QuestionCard.jsx';
import { QuestionPanel } from '../../client/src/components/StepPanels.jsx';

afterEach(cleanup);

const question = { id: 'q1', requirementId: 'contribution', text: 'What did you do yourself when the jobs failed?', why: 'The form asks what you did yourself; your notes only describe the team.' };
const base = { question, requirementText: 'Your individual contribution', onAnswer: vi.fn(), onSkip: vi.fn(), busy: false, sample: null };
const view = (props = {}) => render(<QuestionCard {...base} {...props} />);

describe('QuestionCard', () => {
  it('shows one question, why it is asked and which requirement it serves', () => {
    view();
    expect(screen.getByRole('heading', { name: 'One question' })).toBeTruthy();
    expect(screen.getByText('What did you do yourself when the jobs failed?')).toBeTruthy();
    expect(screen.getByText('The form asks what you did yourself; your notes only describe the team.')).toBeTruthy();
    expect(screen.getByText('For: Your individual contribution')).toBeTruthy();
  });

  it('sends the answer in the applicant’s words', () => {
    const onAnswer = vi.fn();
    view({ onAnswer });
    const box = screen.getByLabelText('Your answer');
    expect(screen.getByRole('button', { name: 'Answer' }).disabled).toBe(true);
    fireEvent.change(box, { target: { value: 'I read dmesg and found it.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Answer' }));
    expect(onAnswer).toHaveBeenCalledWith('I read dmesg and found it.');
  });

  it('sends with Ctrl or Cmd + Enter', () => {
    const onAnswer = vi.fn();
    view({ onAnswer });
    const box = screen.getByLabelText('Your answer');
    fireEvent.change(box, { target: { value: 'My part was the Helm chart.' } });
    fireEvent.keyDown(box, { key: 'Enter', ctrlKey: true });
    expect(onAnswer).toHaveBeenCalledWith('My part was the Helm chart.');
  });

  it('lets the applicant skip without making anything up', () => {
    const onSkip = vi.fn();
    view({ onSkip });
    fireEvent.click(screen.getByRole('button', { name: 'Skip: leave it out' }));
    expect(onSkip).toHaveBeenCalled();
    expect(screen.getByText('Your words become a fact you confirm. Skipping leaves this part out of the drafts.')).toBeTruthy();
  });

  it('offers the sample answer when there is one', () => {
    view({ sample: 'I found the /dev/shm problem.', sampleName: 'Ellie' });
    fireEvent.click(screen.getByRole('button', { name: 'Use Ellie’s sample answer' }));
    expect(screen.getByLabelText('Your answer').value).toBe('I found the /dev/shm problem.');
  });

  it('shows a conflict without an unrelated sample answer or empty form label', () => {
    view({ question: { ...question, kind: 'source-conflict', requirementId: undefined }, requirementText: '', sample: 'Unrelated sample answer.', sampleName: 'Ellie' });
    expect(screen.queryByRole('button', { name: 'Use Ellie’s sample answer' })).toBeNull();
    expect(screen.queryByText(/^For:/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Skip: leave it out' })).toBeTruthy();
  });

  it('offers Marcus his own answer to the question actually asked', () => {
    const workspace = { application: { form: { id: 'harbourline' }, questions: [{ id: 'q1', requirementId: 'motivation', status: 'open', text: 'Why Harbourline?', why: 'The letter asks why this company.' }] } };
    const sample = { name: 'Marcus', answer: 'I rang eight local suppliers.', answerFor: { motivation: 'I want to stay in Leeds.' } };
    render(<QuestionPanel workspace={workspace} view={{ coverage: [{ id: 'motivation', text: 'Why this role and this company' }] }} sample={sample} busy={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Use Marcus’s sample answer' }));
    expect(screen.getByLabelText('Your answer').value).toBe('I want to stay in Leeds.');
  });
});
