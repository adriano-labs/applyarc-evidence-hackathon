// The receipts log: one JSON line per model step, kept even when the step
// failed, so "What Meta did" never forgets a call that cost money.
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

export function createReceiptLog(file) {
  return {
    append(entry) {
      mkdirSync(dirname(file), { recursive: true });
      appendFileSync(file, `${JSON.stringify(entry)}\n`);
    },
    list() {
      if (!existsSync(file)) return [];
      return readFileSync(file, 'utf8').split('\n').flatMap((l) => { try { return l ? [JSON.parse(l)] : []; } catch { return []; } });
    },
  };
}
