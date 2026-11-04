// "9 of 10 form requirements covered · 1 needs review · Cover letter check: 1 of 1 met": the employer's own
// requirements are counted apart from ApplyArc's optional cover-letter check, on the guided screens.
export function CoverageLine({ view }) {
  const coverage = view?.coverage ?? [];
  if (!coverage.length) return null;
  const form = coverage.filter((r) => r.docId !== 'letter');
  const letter = coverage.filter((r) => r.docId === 'letter');
  const covered = form.filter((r) => r.covered).length;
  const review = form.filter((r) => r.needsReview).length;
  const letterReview = letter.filter((r) => r.needsReview).length;
  const parts = [`${covered} of ${form.length} form requirements covered`];
  if (review) parts.push(`${review} needs review: a fact it relied on changed`);
  if (letter.length) parts.push(`Cover letter check: ${letter.filter((r) => r.covered).length} of ${letter.length} met${letterReview ? `, ${letterReview} needs review` : ''}`);
  return <p className="guided-coverage">{parts.join(' · ')}</p>;
}
