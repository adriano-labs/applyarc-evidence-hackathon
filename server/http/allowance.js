// A hosted visitor's live allowance. The model is chosen once per workspace and
// never changes half-way through a journey: the fixture's facts and ids would not
// match the ones Meta produced, so a later draft would break.
export const UNKNOWN_COST_USD = 0.10;
export const JOURNEY_USD = 0.5; // about one Meta journey, with margin

export function workspaceMode({ receipts = [], createdAt, capUsd, ledgerLeftUsd }) {
  const mine = receipts.filter((r) => r.at >= createdAt);
  if (mine.length) return mine[0].provider === 'fixture' ? 'fixture' : 'model';
  if (Number.isFinite(ledgerLeftUsd) && ledgerLeftUsd < JOURNEY_USD) return 'fixture';
  if (!Number.isFinite(capUsd)) return 'model';
  const spent = receipts.reduce((sum, r) => sum + (Number.isFinite(r.costUsd) ? r.costUsd : UNKNOWN_COST_USD), 0);
  return spent >= capUsd ? 'fixture' : 'model';
}
