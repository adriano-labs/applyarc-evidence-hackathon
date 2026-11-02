// Word-level changes between two versions of a sentence, as two lines: `was`
// (the old sentence) and `now` (the new one). Each is a list of { text, changed }
// runs that joins back to its sentence exactly, spaces included.
const WORD = /\S/;

export function diffLines(before, after) {
  const a = before.match(/\s+|\S+/g) ?? [];
  const b = after.match(/\s+|\S+/g) ?? [];
  const same = (i, j) => a[i] === b[j] && WORD.test(a[i]);
  // lcs[i][j]: how many words a[i..] and b[j..] share, in order.
  const lcs = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = same(i, j) ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const keptA = new Set();
  const keptB = new Set();
  for (let i = 0, j = 0; i < a.length && j < b.length;) {
    if (same(i, j)) { keptA.add(i++); keptB.add(j++); }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) i++;
    else j++;
  }
  return { was: runs(a, keptA), now: runs(b, keptB) };
}

// A word is changed when it was not kept; a space only when the words on both
// sides of it changed, so a changed phrase reads as one mark.
function runs(tokens, kept) {
  const changedAt = (i) => i >= 0 && i < tokens.length && WORD.test(tokens[i]) && !kept.has(i);
  const out = [];
  tokens.forEach((text, i) => {
    const changed = WORD.test(text) ? !kept.has(i) : changedAt(i - 1) && changedAt(i + 1);
    if (out.at(-1)?.changed === changed) out.at(-1).text += text;
    else out.push({ text, changed });
  });
  return out;
}
