// Start the server and serve the built client.
import { serve } from '@hono/node-server';
import { buildApp } from './build.js';
import { serveClient } from './http/static.js';

const app = serveClient(buildApp());

const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOST ?? '127.0.0.1';
serve({ fetch: app.fetch, port, hostname }, () => console.log(`ApplyArc Evidence on http://${hostname}:${port}`));
