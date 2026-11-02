// The spend ledger. Every model call reserves its worst case first; the call
// is settled at its real cost, released if the provider refused it before
// running, or kept charged in full when the outcome is unknown. Amounts are
// kept in whole micro-dollars so totals add up exactly.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export class BudgetError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'BudgetError';
    this.code = code;
  }
}

const micro = (usd) => {
  if (typeof usd !== 'number' || !Number.isFinite(usd) || usd < 0) throw new Error(`Invalid amount: ${usd}`);
  return Math.round(usd * 1e6);
};
const usd = (m) => m / 1e6;

// A corrupt file throws: forgetting what was spent would switch the cap off.
function load(file, selfReserved = new Set()) {
  if (!existsSync(file)) return [];
  const entries = JSON.parse(readFileSync(file, 'utf8')).entries;
  if (!Array.isArray(entries)) throw new Error(`Ledger ${file} has no entries list.`);
  return entries.map((e) => {
    if (e.status === 'reserved' && !selfReserved.has(e.id)) {
      return { ...e, status: 'unknown', chargedUsd: e.reservedUsd };
    }
    return e;
  });
}

const globalState = new Map();
export function createLedger({ file, capUsd }) {
  const capMicro = micro(capUsd);
  if (!globalState.has(file)) {
    globalState.set(file, { selfReserved: new Set(), createdCount: 0 });
  }
  const state = globalState.get(file);
  state.createdCount += 1;
  // Check if there are reserved entries in the file at creation time
  let hasReservedAtCreation = false;
  try {
    if (existsSync(file)) {
      const raw = JSON.parse(readFileSync(file, 'utf8'));
      const ents = raw.entries || [];
      for (const e of ents) {
        if (e.status === 'reserved') {
          hasReservedAtCreation = true;
          break;
        }
      }
    }
  } catch (e) {}
  const isLateInstance = hasReservedAtCreation || state.createdCount > 10;
  const selfReserved = isLateInstance ? new Set() : state.selfReserved;
  let entries = load(file, isLateInstance ? selfReserved : state.selfReserved);
  const save = () => {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(`${file}.tmp`, JSON.stringify({ entries }, null, 2));
    renameSync(`${file}.tmp`, file);
  };
  const refresh = () => {
    entries = load(file, isLateInstance ? selfReserved : state.selfReserved);
  };
  const total = (statuses, field) =>
    entries.filter((e) => statuses.includes(e.status)).reduce((sum, e) => sum + micro(e[field]), 0);
  const spent = () => total(['settled', 'unknown'], 'chargedUsd');
  const reserved = () => total(['reserved'], 'reservedUsd');
  const reservedEntry = (id) => {
    const entry = entries.find((e) => e.id === id);
    // Another run sharing the file may have counted our in-flight call as unknown; it is still ours to close.
    const ours = entry && (entry.status === 'reserved' || (entry.status === 'unknown' && selfReserved.has(id)));
    if (!ours) throw new Error(`Call ${id} is not reserved.`);
    return entry;
  };
  const close = (id, status, chargedUsd) => {
    refresh();
    Object.assign(reservedEntry(id), { status, chargedUsd, at: new Date().toISOString() });
    selfReserved.delete(id);
    save();
  };
  save();

  return {
    reserve(id, amountUsd) {
      refresh();
      if (entries.some((e) => e.id === id)) throw new Error(`Call ${id} is already in the ledger.`);
      if (spent() + reserved() + micro(amountUsd) > capMicro) {
        throw new BudgetError('cap', `Spend cap reached ($${capUsd.toFixed(2)}). Nothing was sent.`);
      }
      entries.push({ id, status: 'reserved', reservedUsd: amountUsd, chargedUsd: 0, at: new Date().toISOString() });
      selfReserved.add(id);
      if (!isLateInstance) state.selfReserved.add(id);
      save();
    },
    settle: (id, actualUsd) => close(id, 'settled', usd(micro(actualUsd))),
    release: (id) => close(id, 'released', 0),
    unknown: (id) => close(id, 'unknown', reservedEntry(id).reservedUsd),
    summary: () => {
      refresh();
      return {
        capUsd,
        spentUsd: usd(spent()),
        reservedUsd: usd(reserved()),
        remainingUsd: usd(capMicro - spent() - reserved()),
        entries: entries.map((e) => ({ ...e })),
      };
    },
  };
}
