// "I'll speak or write in…": the language of the words that follow. It goes with them to the
// server, and to Meta Voice Transcribe as a hint when she speaks. English unless she chooses.
import { languageName } from '../lib/language.js';

export function LanguageChoice({ id, languages, value, onChange, disabled }) {
  if (!Array.isArray(languages) || languages.length < 2) return null;
  return (
    <div className="language-choice">
      <label htmlFor={id}>I’ll speak or write in</label>
      <select id={id} value={value ?? 'en'} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        {languages.map((l) => <option key={l.code} value={l.code}>{l.code === 'en' ? 'English' : `${l.native} (${languageName(l.code)})`}</option>)}
      </select>
    </div>
  );
}
