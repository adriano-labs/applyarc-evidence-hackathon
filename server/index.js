// Start the server and serve the built client.
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { buildApp } from './build.js';

const app = buildApp();
app.use('/*', serveStatic({ root: './dist' }));
app.get('*', serveStatic({ path: './dist/index.html' }));

const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOST ?? '127.0.0.1';
serve({ fetch: app.fetch, port, hostname }, () => console.log(`ApplyArc Evidence on http://${hostname}:${port}`));
