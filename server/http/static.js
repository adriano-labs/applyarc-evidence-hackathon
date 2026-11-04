// The built client. Files under /assets/ carry a content hash in their names, so a
// browser may keep them for a year; the page is checked on every load, so a new
// build shows at once. A missing asset is a 404: answering it with the page would
// make a browser holding an old page run HTML as its script.
import { serveStatic } from '@hono/node-server/serve-static';

// Set once the file is served: serveStatic builds its response before its onFound hook runs.
const cache = (value) => async (c, next) => {
  await next();
  if (c.res.ok) c.header('cache-control', value);
};

export function serveClient(app, root = './dist') {
  app.get('/assets/*', cache('public, max-age=31536000, immutable'), serveStatic({ root }), (c) => c.notFound());
  app.get('*', cache('no-cache'), serveStatic({ root }), serveStatic({ path: `${root}/index.html` }));
  return app;
}
