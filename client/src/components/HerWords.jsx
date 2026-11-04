// A fact in another language: her exact words first, in the mark that only ever shows her words,
// then the English meaning she confirmed. `base` keeps each place's own look (fact-, peek-, ref-).
import './HerWords.css';

export function HerWords({ fact, base }) {
  return (
    <>
      <p className={`${base}-quote her-words`} lang={fact.language}>“<mark>{fact.quote}</mark>”</p>
      <p className="her-meaning">In English (working translation): {fact.statement}</p>
    </>
  );
}
