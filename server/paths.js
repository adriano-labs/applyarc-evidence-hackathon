import { join } from 'node:path';

export const ROOT = process.env.APP_ROOT ?? process.cwd();
export const fromRoot = (...parts) => join(ROOT, ...parts);
