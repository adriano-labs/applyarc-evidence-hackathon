// One streamed Responses API call with honest money and bounded retries.
// Every attempt reserves its worst case first. 429 and 503 mean the provider
// refused before running: released and retried. 500 may have run: kept
// charged and retried. A stall (no first event in time) may have run: kept
// charged and retried at once while the deadline leaves room for another full
// wait. Everything else is final: a 504, a network failure, a cut or malformed
// stream, or a cancel is kept charged; a refusal (400, 401, 403, 404, 422) is
// released. At most three attempts, never past the deadline.
import { createChatAccumulator, toChatBody } from './chatWire.js';
import { costOf, worstCase } from './pricing.js';
import { readEvents } from './sse.js';

export class ProviderError extends Error {
  constructor(code, message, { status = null, requestId = null, started = false } = {}) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
    this.status = status;
    this.requestId = requestId;
    this.started = started;
  }
}

const RETRYABLE = new Set([429, 500, 503]);
const TERMINAL = new Set(['response.completed', 'response.failed', 'response.incomplete']);
const MESSAGES = {
  timeout: 'The model took too long to start. Nothing was changed. Try again.',
  cancelled: 'Stopped. Nothing was changed.',
  cut: 'The answer stopped. Nothing was changed. Try again.',
  network: 'Could not reach the model service. Nothing was changed. Try again.',
  failed: 'The model could not finish this step. Nothing was changed. Try again.',
  invalid: 'The model service refused the request as invalid. Nothing was changed.',
  auth: 'The model service refused the server’s credentials. Nothing was changed.',
  'not-found': 'The model service does not know this model name. Nothing was changed.',
  provider: 'The model service returned an error. Nothing was changed.',
  billing: 'Billing is not active for this key yet. Nothing was sent.',
};

const header = (headers, name) => headers?.get?.(name) ?? null;
const numberHeader = (headers, name) => {
  const value = header(headers, name);
  return value !== null && Number.isFinite(Number(value)) ? Number(value) : null;
};

function refusalCode(status) {
  if (status === 402) return 'billing';
  if (status === 400 || status === 422) return 'invalid';
  if (status === 401 || status === 403) return 'auth';
  if (status === 404) return 'not-found';
  return 'provider';
}

function retryAfterMs(headers) {
  const value = header(headers, 'retry-after');
  if (value === null) return null;
  if (Number.isFinite(Number(value))) return Math.max(0, Number(value) * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

const tokenCount = (value) => Number.isSafeInteger(value) && value >= 0;

// Missing or malformed provider counts cannot turn a potentially billed call free.
function isValidUsage(usage) {
  if (!usage || typeof usage !== 'object' || Array.isArray(usage)) return false;
  if (!tokenCount(usage.input_tokens) || !tokenCount(usage.output_tokens)) return false;
  for (const [details, name, total] of [
    [usage.input_tokens_details, 'cached_tokens', usage.input_tokens],
    [usage.output_tokens_details, 'reasoning_tokens', usage.output_tokens],
  ]) {
    if (details === undefined) continue;
    if (!details || typeof details !== 'object' || Array.isArray(details)) return false;
    if (Object.hasOwn(details, name) && (!tokenCount(details[name]) || details[name] > total)) return false;
  }
  return true;
}

// An abort signal that follows the caller's and fires on its own when the
// first event is late or when a started stream goes quiet; the error's
// `started` flag says which.
function watchdog(signal, firstEventTimeoutMs, stallTimeoutMs) {
  const controller = new AbortController();
  const onCancel = () => controller.abort('cancelled');
  if (signal?.aborted) onCancel();
  else signal?.addEventListener('abort', onCancel, { once: true });
  let timer = setTimeout(() => controller.abort('timeout'), firstEventTimeoutMs);
  return {
    signal: controller.signal,
    reason: () => (controller.signal.aborted ? controller.signal.reason : null),
    // Every event, the first included, restarts the stall limit.
    event: () => { clearTimeout(timer); timer = setTimeout(() => controller.abort('timeout'), stallTimeoutMs); },
    done: () => { clearTimeout(timer); signal?.removeEventListener('abort', onCancel); },
  };
}

async function readStream(response, watch, onEvent, elapsed) {
  let chars = 0;
  let firstEventMs = null;
  let firstOutputMs = null;
  try {
    for await (const event of readEvents(response.body)) {
      if (firstEventMs === null) {
        firstEventMs = elapsed();
        onEvent({ type: 'first-event', ms: firstEventMs });
      }
      watch.event();
      if (watch.reason()) break;
      const type = event.data?.type ?? event.event;
      if (TERMINAL.has(type)) return { type, response: event.data.response, firstEventMs, firstOutputMs };
      if (type === 'error') break;
      if (type === 'response.output_text.delta') {
        chars += event.data.delta?.length ?? 0;
        if (firstOutputMs === null) {
          firstOutputMs = elapsed();
        }
        onEvent({ type: 'delta', chars });
      } else if (type === 'response.function_call_arguments.delta') {
        if (firstOutputMs === null) {
          firstOutputMs = elapsed();
        }
        onEvent({ type: 'delta', chars });
      }
    }
  } catch {
    // A body aborted by the watchdog or a malformed stream: classified below.
  }
  return { type: watch.reason() ?? 'cut', firstEventMs, firstOutputMs };
}

// Chat Completions streams chunks and ends with [DONE]; the accumulator turns
// them into the same terminal shapes the Responses stream gives.
async function readChatStream(response, watch, onEvent, elapsed) {
  const acc = createChatAccumulator();
  let firstEventMs = null;
  let firstOutputMs = null;
  try {
    for await (const event of readEvents(response.body)) {
      if (firstEventMs === null) {
        firstEventMs = elapsed();
        onEvent({ type: 'first-event', ms: firstEventMs });
      }
      watch.event();
      if (watch.reason() || event.data?.error) break;
      if (event.done) {
        if (!acc.finished()) break;
        const final = acc.result();
        return { type: `response.${final.status}`, response: final, firstEventMs, firstOutputMs };
      }
      const before = acc.deltaChars();
      acc.add(event.data);
      const after = acc.deltaChars();
      if (after !== before) {
        if (firstOutputMs === null) {
          firstOutputMs = elapsed();
        }
        onEvent({ type: 'delta', chars: after });
      }
    }
  } catch {
    // Classified below, as for the Responses stream.
  }
  return { type: watch.reason() ?? 'cut', firstEventMs, firstOutputMs };
}

export function createTransport({
  provider, fetch = globalThis.fetch, ledger, sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  now = () => Date.now(), random = Math.random, maxAttempts = 3, deadlineMs = 120000, firstEventTimeoutMs = 45000, stallTimeoutMs = 60000,
}) {
  const fail = (code, extra) => new ProviderError(code, MESSAGES[code], extra);
  const chat = provider.wire === 'chat';
  const priced = provider.priceModel ?? provider.model;

  // The provider's reason goes to the server log only (redacted), never to the client.
  async function logRefusal(response, requestId) {
    const text = await response.text().catch(() => '');
    const safe = text.slice(0, 400).replace(/(bearer\s+|api[-_]?key["':=\s]+)[\w.\-]+/gi, '$1[redacted]');
    console.warn(`Model service refused: ${response.status} ${requestId ?? ''} ${safe}`);
  }

  async function closeRefused(id, response, requestId, markUnknown) {
    const { status } = response;
    if (status >= 400 && status < 500 && status !== 429) await logRefusal(response, requestId);
    else response.body?.cancel?.().catch(() => {});
    if (RETRYABLE.has(status)) {
      if (status === 500) {
        markUnknown(id);
      } else {
        ledger.release(id);
      }
      return { retry: true, status, headers: response.headers };
    }
    if (status === 504) {
      markUnknown(id);
      throw fail('timeout', { status, requestId });
    }
    ledger.release(id);
    throw fail(refusalCode(status), { status, requestId });
  }

  function finish(id, read, response, requestId, onEvent, markUnknown) {
    const final = read.response ?? {};
    const knownUsage = !final.usageMissing && isValidUsage(final.usage);
    if (!TERMINAL.has(read.type) || !knownUsage) {
      markUnknown(id);
    } else {
      ledger.settle(id, costOf(priced, final.usage));
    }
    const ids = { requestId: requestId ?? final.id ?? null };
    const result = {
      response: final,
      usage: knownUsage ? final.usage : {},
      costUsd: knownUsage ? costOf(priced, final.usage) : null,
      model: final.model ?? provider.model,
      requestId: ids.requestId,
      firstEventMs: read.firstEventMs,
      firstOutputMs: read.firstOutputMs,
      rateLimit: { remainingRequests: numberHeader(response.headers, 'x-ratelimit-remaining-requests'), remainingTokens: numberHeader(response.headers, 'x-ratelimit-remaining-tokens') },
    };
    // A failed or cut-short answer was still billed: its turn goes with the error to the receipt.
    if (read.type === 'response.failed') throw Object.assign(fail('failed', ids), { turn: result });
    if (read.type === 'response.incomplete') {
      const reason = final.incomplete_details?.reason ?? 'unknown';
      throw Object.assign(new ProviderError('incomplete', `The answer was cut short (${reason}). Nothing was changed.`, ids), { turn: result });
    }
    if (read.type !== 'response.completed') throw fail(read.type, { ...ids, started: read.firstEventMs !== null });
    onEvent({ type: 'completed' });
    return result;
  }

  async function attempt(id, body, signal, onEvent, markUnknown) {
    const watch = watchdog(signal, firstEventTimeoutMs, stallTimeoutMs);
    const sentAt = now();
    try {
      let response;
      try {
        response = await fetch(`${provider.baseUrl}/${chat ? 'chat/completions' : 'responses'}`, {
          method: 'POST', signal: watch.signal,
          headers: { 'content-type': 'application/json', accept: 'text/event-stream', ...provider.headers() },
          body: JSON.stringify(chat ? toChatBody(body, provider.model, { structured: Boolean(provider.structured) }) : { ...body, model: provider.model, stream: true }),
        });
      } catch {
        markUnknown(id);
        throw fail(watch.reason() ?? 'network');
      }
      const requestId = header(response.headers, 'x-request-id') ?? header(response.headers, 'apim-request-id');
      if (response.status !== 200) return await closeRefused(id, response, requestId, markUnknown);
      const read = await (chat ? readChatStream : readStream)(response, watch, onEvent, () => now() - sentAt);
      return finish(id, read, response, requestId, onEvent, markUnknown);
    } finally {
      watch.done();
    }
  }

  async function respond(body, { callId, onEvent = () => {}, signal } = {}) {
    const start = now();
    const worst = worstCase(priced, { inputTokens: Math.ceil(JSON.stringify(body).length / 3), maxOutputTokens: body.max_output_tokens ?? 4096 });
    let status = null;
    // Attempts left "unknown" in the ledger (they may have run) and demo-injected faults, for the receipt.
    let unsettled = 0;
    let injectedFaults = 0;
    const markUnknown = (id) => { ledger.unknown(id); unsettled += 1; };
    const turn = ({ firstEventMs, firstOutputMs, ...result }, attempts) => ({ ...result, attempts, unsettled, injectedFaults, timings: { firstEventMs, firstOutputMs: firstOutputMs ?? null, totalMs: now() - start } });
    const failWith = (error, n) => Object.assign(error, { unsettled }, error.turn ? { turn: turn(error.turn, n) } : {});
    for (let n = 1; n <= maxAttempts; n += 1) {
      const id = `${callId}-a${n}`;
      ledger.reserve(id, worst);
      onEvent({ type: 'attempt', attempt: n });
      try {
        const outcome = await attempt(id, body, signal, onEvent, markUnknown);
        if (!outcome.retry) return turn(outcome, n);
        status = outcome.status;
        const injected = Boolean(header(outcome.headers, 'x-demo-fault'));
        if (injected) injectedFaults += 1;
        const waitMs = retryAfterMs(outcome.headers) ?? 1000 * 2 ** (n - 1) + Math.floor(random() * 250);
        if (n === maxAttempts || now() - start + waitMs > deadlineMs) break;
        onEvent({ type: 'retry', attempt: n, status, waitMs, ...(injected ? { injected: true } : {}) });
        await sleep(waitMs);
      } catch (err) {
        // A stall: the watchdog fired before the first event (a 504 carries its status).
        const stall = err instanceof ProviderError && err.code === 'timeout' && err.status === null && !err.started;
        if (!stall || n === maxAttempts || now() - start + firstEventTimeoutMs > deadlineMs) throw err instanceof ProviderError ? failWith(err, n) : err;
        onEvent({ type: 'retry', attempt: n, status: null, reason: 'stall', waitMs: 0 });
      }
    }
    throw failWith(new ProviderError('busy', `${provider.label ?? 'The model service'} is busy. Nothing was changed. Try again in a minute.`, { status }));
  }

  return { respond };
}
