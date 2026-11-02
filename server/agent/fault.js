export function faultyFetch(fetch, name) {
  if (name === undefined || name === null || name === '') {
    return fetch;
  }
  if (name === '429-once') {
    let used = false;
    return async function (...args) {
      if (!used) {
        used = true;
        return new Response(JSON.stringify({ error: { message: 'Injected for the demo: busy' } }), {
          status: 429,
          headers: {
            'content-type': 'application/json',
            'retry-after': '2',
            'x-demo-fault': '429-once'
          }
        });
      }
      return fetch(...args);
    };
  }
  throw new Error(`Unknown DEMO_FAULT ${name}: use 429-once.`);
}
