// A hosted visitor's live allowance. The model is chosen once per workspace and
// never changes half-way through a journey: the fixture's facts and ids would not
// match the ones Meta produced, so a later draft would break.
export const UNKNOWN_COST_USD = 0.10;
export const JOURNEY_USD = 0.5; // about one Meta journey, with margin

// Everything a visitor spent, in every workspace they started (the receipts log keeps them all).
export const spentUsd = (receipts) => receipts.reduce((sum, r) => sum + (Number.isFinite(r.costUsd) ? r.costUsd : UNKNOWN_COST_USD), 0);

// The hard ceiling: past twice the allowance a visit stops spending, even half-way through a journey.
export const overCeiling = (receipts, capUsd) => Number.isFinite(capUsd) && spentUsd(receipts) >= 2 * capUsd;

export function workspaceMode({ receipts = [], createdAt, capUsd, ledgerLeftUsd }) {
  const mine = receipts.filter((r) => r.at >= createdAt);
  if (mine.length) return mine[0].provider === 'fixture' ? 'fixture' : 'model';
  // A new workspace starts live only while the demo's budget still covers a whole visitor allowance, so journeys in flight can finish.
  const floor = Number.isFinite(capUsd) ? Math.max(JOURNEY_USD, capUsd) : JOURNEY_USD;
  if (Number.isFinite(ledgerLeftUsd) && ledgerLeftUsd < floor) return 'fixture';
  if (!Number.isFinite(capUsd)) return 'model';
  return spentUsd(receipts) >= capUsd ? 'fixture' : 'model';
}
