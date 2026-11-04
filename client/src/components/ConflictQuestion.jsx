import './QuestionCard.css';

// Two accounts that may not agree. A note in another language brings the model's question in her
// language with its English beneath, and the English meaning of her new words.
export function ConflictQuestion({ question, showHelp = true }) {
  const priorQuote = question?.priorQuote;
  const quote = question?.quote;
  const english = question?.english;

  return (
    <div className="conflict-question">
      <p className="question-text" lang={english ? question?.language : undefined}>{english ? question.text : 'These details may not agree. What should I use?'}</p>
      {english ? <p className="question-english">In English: {english}</p> : null}
      <div>
        <p className="question-why">Earlier words</p>
        <p lang={question?.language}>{priorQuote != null ? priorQuote : ''}</p>
      </div>
      <div>
        <p className="question-why">New words</p>
        <p lang={question?.language}>{quote != null ? quote : ''}</p>
        {question?.meaning ? <p className="question-english">In English: {question.meaning}</p> : null}
      </div>
      {showHelp ? <p className="question-why">Your saved work is unchanged. Check the two accounts before continuing.</p> : null}
    </div>
  );
}
