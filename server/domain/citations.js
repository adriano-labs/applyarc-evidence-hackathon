// Citation numbers in order of first use across both documents, the way a
// paper numbers its references.
import { DOC_IDS, findFact, findSource } from './workspace.js';

export function citationNumbers(ws) {
  const numbers = {};
  let next = 1;
  for (const docId of DOC_IDS) {
    for (const s of ws.application.documents[docId]?.segments ?? []) {
      for (const id of s.factIds ?? []) numbers[id] ??= next++;
    }
  }
  return numbers;
}

export function referencesFor(ws, doc, numbers) {
  const ids = [...new Set((doc.segments ?? []).flatMap((s) => s.factIds ?? []))];
  return ids
    .map((id) => ({ n: numbers[id], fact: findFact(ws, id) }))
    .sort((a, b) => a.n - b.n)
    .map(({ n, fact }) => {
      const source = findSource(ws, fact.sourceId);
      return { n, factId: fact.id, statement: fact.statement, quote: fact.quote, from: source?.kind };
    });
}
