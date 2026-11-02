// The container the hosted demo runs in: Node 24, a reproducible install, only
// what the server needs at run time, listening on all interfaces, not as root.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fromRoot } from '../server/paths.js';

const dockerfile = readFileSync(fromRoot('Dockerfile'), 'utf8');
const ignore = readFileSync(fromRoot('.dockerignore'), 'utf8').split('\n').map((l) => l.trim());
const stages = dockerfile.split(/^FROM /m).slice(1);

describe('the hosted demo container', () => {
  it('builds the client in one Node 24 stage and runs the server in another', () => {
    expect(stages).toHaveLength(2);
    for (const stage of stages) expect(stage).toMatch(/^node:24-slim\b/);
    expect(stages[0]).toMatch(/corepack prepare pnpm@10\.33\.1 --activate/);
    expect(stages[0]).toMatch(/pnpm install --frozen-lockfile\n/);
    expect(stages[0]).toMatch(/NODE_ENV=production pnpm exec vite build/);
    // The client is everything Vite reads (its root and index.html are client/).
    expect([...stages[0].matchAll(/^COPY (.+)$/gm)].map((m) => m[1])).toEqual(['package.json pnpm-lock.yaml ./', 'client ./client', 'vite.config.js ./']);
  });

  it('uses only plain Dockerfile instructions: no shell operators inside COPY', () => {
    for (const line of dockerfile.split('\n').filter((l) => l.startsWith('COPY '))) expect(line).not.toMatch(/\|\||&&|2>|\*/);
  });

  it('installs only the run-time packages and copies only the server, the fixtures and the built client', () => {
    const run = stages[1];
    expect(run).toMatch(/pnpm install --frozen-lockfile --prod/);
    const copies = [...run.matchAll(/^COPY (.+)$/gm)].map((m) => m[1]);
    expect(copies).toEqual(['package.json pnpm-lock.yaml ./', 'server ./server', 'fixtures ./fixtures', '--from=build /app/dist ./dist']);
  });

  it('listens on all interfaces on port 3000, as the unprivileged node user', () => {
    const run = stages[1];
    expect(run).toMatch(/ENV NODE_ENV=production HOST=0\.0\.0\.0 PORT=3000/);
    expect(run).toMatch(/^EXPOSE 3000$/m);
    expect(run).toMatch(/^USER node$/m);
    expect(run.trim().split('\n').at(-1)).toBe('CMD ["node", "server/index.js"]');
  });

  it('keeps local state, secrets and tooling out of the build context', () => {
    for (const entry of ['node_modules', 'dist', 'data', '.git', '.env', '.claude', 'test']) expect(ignore).toContain(entry);
  });
});
