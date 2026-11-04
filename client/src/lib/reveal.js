// Bring things into view after the next render: a sentence (scrolled to the middle and flashed for
// a moment), or a step's own control (focused), as "Show in the …" and "Show me" ask.
export function revealSegment(segmentId, setFlashSegmentId) {
  setTimeout(() => {
    const el = document.querySelector(`[data-segment="${segmentId}"]`);
    if (el && typeof el.scrollIntoView === 'function') {
      try {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      } catch {
        el.scrollIntoView();
      }
    }
    setFlashSegmentId(segmentId);
    setTimeout(() => setFlashSegmentId((current) => (current === segmentId ? null : current)), 1200);
  }, 50);
}

export function revealStep(show) {
  setTimeout(() => {
    const target = document.querySelector({ facts: '.facts-review', question: '.question-card textarea', decide: '.conflict-card button', repair: '.queue' }[show]);
    target?.focus?.();
    target?.scrollIntoView?.({ block: 'nearest' });
  }, 0);
}
