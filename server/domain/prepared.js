// A workspace a real model run saved, loaded for a new visitor. The facts, documents and
// approvals are exactly as saved; the marker says what prepared them and when it was loaded.
// createdAt becomes this visit's own start, so the visitor's allowance and "What Meta did"
// count only what runs from here: the saved run's receipts are never theirs.
export function preparedWorkspace(saved, now = new Date().toISOString()) {
  const { prepared, ...ws } = structuredClone(saved);
  return { ...ws, createdAt: now, prepared: { ...prepared, loadedAt: now } };
}
