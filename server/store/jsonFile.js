// One JSON file per applicant workspace. Writes are serialised and atomic
// (write a temporary file, then rename), and a write against an older
// revision than the one on disk is refused.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { refuse } from '../domain/errors.js';

export function writeJsonAtomic(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(tmp, file);
}

export function createStore({ file, seed, now = () => new Date().toISOString() }) {
  let queue = Promise.resolve();
  let pendingCount = 0;

  const read = () => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : seed());

  const working = () => pendingCount > 0;

  // `mutate` changes the workspace in place and may be async (a model call).
  // Nothing is written if it throws.
  function update(expectedRevision, mutate) {
    pendingCount += 1;
    const run = queue.then(async () => {
      try {
        const ws = read();
        if (expectedRevision !== ws.revision) {
          refuse('stale', 'This changed in another tab. Showing the latest.', { revision: ws.revision });
        }
        const result = await mutate(ws);
        ws.revision += 1;
        ws.updatedAt = now();
        writeJsonAtomic(file, ws);
        return { ws, result };
      } finally {
        pendingCount -= 1;
      }
    });
    queue = run.catch(() => {});
    return run;
  }

  // A fresh workspace, or one made another way (a prepared state), written as this applicant's.
  function reset(make = seed) {
    pendingCount += 1;
    const run = queue.then(() => {
      try {
        const ws = make();
        writeJsonAtomic(file, ws);
        return ws;
      } finally {
        pendingCount -= 1;
      }
    });
    queue = run.catch(() => {});
    return run;
  }

  // Save a new workspace once, so its start time (and what Meta did since) stays fixed.
  const ensure = () => {
    if (!existsSync(file)) writeJsonAtomic(file, seed());
    return read();
  };

  return { read, update, reset, ensure, working };
}
