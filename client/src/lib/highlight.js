function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildPattern(quote) {
  let pattern = '';
  for (let i = 0; i < quote.length; i++) {
    const ch = quote[i];
    if (/\s/.test(ch)) {
      pattern += '\\s+';
      while (i + 1 < quote.length && /\s/.test(quote[i + 1])) {
        i++;
      }
      continue;
    } else if (ch === "'") {
      pattern += "['’]";
      continue;
    } else if (ch === '"') {
      pattern += '["“”]';
      continue;
    } else if (ch === '-') {
      pattern += '[-–—]';
      continue;
    } else if (ch === '–' || ch === '—') {
      pattern += '[-–—]';
      continue;
    } else {
      pattern += escapeRegExp(ch);
      continue;
    }
  }
  return pattern;
}

export function highlightParts(text, quotes) {
  if (!quotes || quotes.length === 0) {
    if (text === '') return [];
    return [{ text }];
  }
  if (text === '') return [];

  const matches = [];
  for (let qi = 0; qi < quotes.length; qi++) {
    const q = quotes[qi];
    const pattern = buildPattern(q.quote);
    const re = new RegExp(pattern, 'g');
    const m = re.exec(text);
    if (!m) {
      continue;
    }
    matches.push({
      index: qi,
      start: m.index,
      end: m.index + m[0].length,
      factId: q.id,
      status: q.status,
      text: m[0]
    });
  }

  // Sort by start position
  matches.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return a.index - b.index;
  });

  const taken = [];
  const selected = [];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    // check overlap with any taken
    let overlaps = false;
    for (let t = 0; t < taken.length; t++) {
      const tr = taken[t];
      if (!(m.end <= tr.start || m.start >= tr.end)) {
        overlaps = true;
        break;
      }
    }
    if (overlaps) continue;
    selected.push(m);
    taken.push(m);
  }

  // Sort selected by position
  selected.sort((a, b) => a.start - b.start);

  const parts = [];
  let pos = 0;
  for (let i = 0; i < selected.length; i++) {
    const s = selected[i];
    if (s.start > pos) {
      parts.push({ text: text.slice(pos, s.start) });
    }
    parts.push({ text: text.slice(s.start, s.end), factId: s.factId, status: s.status });
    pos = s.end;
  }
  if (pos < text.length) {
    parts.push({ text: text.slice(pos) });
  }
  return parts;
}
