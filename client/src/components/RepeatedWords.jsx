// Under words Voice Transcribe wrote down: the words it repeated, said once, and removed only when
// she taps "Remove the repeats". Never shown for a written note, and never applied silently.
import { dropRepeats, repeatedWords } from '../lib/repeats.js';
import { family, plural } from '../lib/trail.js';

export function RepeatedWords({ text, reply, disabled, onChange }) {
  const repeats = reply ? repeatedWords(text) : [];
  if (!repeats.length) return null;
  const by = reply.model ? family(reply.model).name : 'Muse Voice Transcribe';
  return (
    <p className="sample-note repeated-words">
      {by} wrote {plural(repeats.length, 'repeat', 'repeats')}: {repeats.map((r) => `“${r}”`).join(', ')}.{' '}
      <button type="button" className="btn link small" disabled={disabled} onClick={() => onChange(dropRepeats(text))}>Remove the repeats</button>
      {' '}· or fix them yourself above.
    </p>
  );
}
