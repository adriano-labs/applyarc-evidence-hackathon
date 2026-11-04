// The server API. Plain actions return JSON; model steps stream NDJSON
// progress events and end with a "done" or "error" event.
async function json(response) {
  const data = await response.json().catch(() => ({ error: { code: 'internal', message: 'The server sent an unreadable reply.' } }));
  if (!response.ok) throw Object.assign(new Error(data.error?.message ?? 'Something went wrong.'), { code: data.error?.code, details: data.error?.details });
  return data;
}

const post = (path, body) => fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

export const getState = () => fetch('/api/state').then(json);
export const getSample = () => fetch('/api/sample').then(json);
export const getReceipts = () => fetch('/api/receipts').then(json);
export const getForms = () => fetch('/api/forms').then(json);
export const getVerification = () => fetch('/api/verify').then(json);
export const reset = () => post('/api/reset', {}).then(json);
export const act = (name, body) => post(`/api/actions/${name}`, body).then(json);

export async function run(name, body, onEvent) {
  const response = await post(`/api/run/${name}`, body);
  if (!response.ok || !response.body) return json(response);
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value;
    let end;
    while ((end = buffer.indexOf('\n')) !== -1) {
      const event = JSON.parse(buffer.slice(0, end));
      buffer = buffer.slice(end + 1);
      if (event.type === 'done') return event;
      if (event.type === 'error') throw Object.assign(new Error(event.error.message), { code: event.error.code, details: event.error.details });
      onEvent(event);
    }
  }
  throw Object.assign(new Error('The connection closed before the step finished.'), { code: 'cut' });
}

// language: the applicant's chosen language, sent to Meta as a hint. sample: the sample whose
// bundled clip this is, so the server adds its keywords; an own recording names none. A voice call
// adds its receipt outside any action, so the page is told when one ends (heard in useAppState.js).
export function transcribe(bytes, language, sample) {
  const params = new URLSearchParams();
  if (language && language !== 'en') params.set('language', language);
  if (sample) params.set('sample', sample);
  const query = params.toString() ? `?${params}` : '';
  return fetch(`/api/voice${query}`, { method: 'POST', headers: { 'content-type': 'audio/wav' }, body: bytes }).then(json)
    .finally(() => window.dispatchEvent(new Event('ae-voice-call')));
}
