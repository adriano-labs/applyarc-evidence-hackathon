// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QuestionCard } from '../../client/src/components/QuestionCard.jsx';
import { SourceCorrectionCard } from '../../client/src/components/SourceCorrectionCard.jsx';

afterEach(cleanup);
const prompt = 'These details may not agree. What should I use?';
const priorQuote = 'We added a stock check to the shop spreadsheet.';
const quote = 'I wrote the duplicate-item check.';
const fullText = `${quote} Priya tested it during the stock count.`;
const inventedWhy = 'The earlier notes say you only watched on a different project.';
const questionFor = (text) => ({ id: 'q8', kind: 'source-conflict', text, why: inventedWhy, priorQuote, quote });
const offer = { questionId: 'q8', sourceId: 's4', factId: 'f3', before: 'The team added the complete stock check.', text: fullText };
const badQuestions = [
  'Did you only watch while the team wrote it?',
  'Was your own code for a different project?',
];
const quoteChecks = () => {
  expect(screen.getByText(prompt)).toBeTruthy();
  expect(screen.getByText('Earlier words')).toBeTruthy();
  expect(screen.getByText('New words')).toBeTruthy();
  expect(screen.getByText(priorQuote, { exact: true })).toBeTruthy();
  expect(screen.getByText(quote, { exact: true })).toBeTruthy();
  expect(screen.queryByText(inventedWhy)).toBeNull();
};

describe.each(badQuestions)('conflict question presentation: %s', (badQuestion) => {
  it('shows exact source quotes with neutral copy in the answer path', () => {
    const onAnswer = vi.fn(); const onSkip = vi.fn();
    render(<QuestionCard question={questionFor(badQuestion)} onAnswer={onAnswer} onSkip={onSkip} busy={false} />);
    quoteChecks();
    expect(screen.queryByText(badQuestion)).toBeNull();
    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: '  I wrote one check; Priya wrote the other.  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Answer' }));
    expect(onAnswer).toHaveBeenCalledWith('I wrote one check; Priya wrote the other.');
    fireEvent.click(screen.getByRole('button', { name: 'Skip: leave it out' }));
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it('keeps the exact replacement fact and full editable correction in the correction path', async () => {
    const onResolve = vi.fn(async () => ({ ok: true })); const onSkip = vi.fn();
    render(<SourceCorrectionCard question={questionFor(badQuestion)} offer={offer} onResolve={onResolve} onSkip={onSkip} busy={false} />);
    quoteChecks();
    expect(screen.queryByText(badQuestion)).toBeNull();
    expect(screen.getByText(offer.before, { exact: true })).toBeTruthy();
    expect(screen.getByText(/^Confirmed fact to replace:/)).toBeTruthy();
    expect(screen.getByLabelText('Your correction').value).toBe(fullText);
    const edited = 'I wrote the duplicate-item check.\nPriya tested it with me.';
    fireEvent.change(screen.getByLabelText('Your correction'), { target: { value: edited } });
    fireEvent.click(screen.getByRole('button', { name: 'Use this correction' }));
    await waitFor(() => expect(onResolve).toHaveBeenCalledWith({ questionId: 'q8', sourceId: 's4', factId: 'f3', text: edited }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Keep the earlier account' }).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Keep the earlier account' }));
    expect(onSkip).toHaveBeenCalledOnce();
  });
});

it('keeps useful normal clarification wording and its reason unchanged', () => {
  const question = { id: 'q1', text: 'Which stock check did you write yourself?', why: 'The form asks for your own contribution.' };
  render(<QuestionCard question={question} onAnswer={vi.fn()} onSkip={vi.fn()} busy={false} />);
  expect(screen.getByText(question.text)).toBeTruthy();
  expect(screen.getByText(question.why)).toBeTruthy();
  expect(screen.queryByText(prompt)).toBeNull();
});

it('explains without losing the edited correction or changing answer and skip callbacks', () => {
  const onAnswer = vi.fn(); const onSkip = vi.fn();
  render(<SourceCorrectionCard question={questionFor(badQuestions[0])} offer={offer} onResolve={vi.fn()} onAnswer={onAnswer} onSkip={onSkip} busy={false} />);
  const edited = `${fullText} I also checked three examples.`;
  fireEvent.change(screen.getByLabelText('Your correction'), { target: { value: edited } });
  fireEvent.click(screen.getByRole('button', { name: 'Explain instead' }));
  quoteChecks();
  expect(screen.queryByText(badQuestions[0])).toBeNull();
  fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: 'We worked on different checks in the same sheet.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Answer' }));
  expect(onAnswer).toHaveBeenCalledWith('We worked on different checks in the same sheet.');
  fireEvent.click(screen.getByRole('button', { name: 'Skip: leave it out' }));
  expect(onSkip).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Back to correction' }));
  expect(screen.getByLabelText('Your correction').value).toBe(edited);
});
