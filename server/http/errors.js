// Map refusals to HTTP. Every message is safe to show the applicant.
import { DomainError } from '../domain/errors.js';

const STATUS = {
  stale: 409, 'not-ready': 409, 'would-overwrite': 409, 'repair-open': 409, undecided: 409,
  'not-approved': 409, cap: 409, invalid: 422, 'over-limit': 422, 'invalid-draft': 502,
  'not-found': 404,
  // Model service failures (ProviderError): every message is a fixed, safe sentence.
  provider: 502, busy: 503, timeout: 504, cut: 502, cancelled: 499, failed: 502, incomplete: 502,
  refused: 422, 'invalid-output': 502, network: 502, auth: 502, billing: 503,
  limit: 429,
};

export function toHttpError(error) {
  const code = error?.code;
  if (error instanceof DomainError || (code && STATUS[code] && error.expose !== false)) {
    const message = code === 'invalid-draft' ? 'The draft did not pass the evidence check. Nothing was changed. Try again.' : error.message;
    return { status: STATUS[code] ?? 422, body: { error: { code, message, details: error.details } } };
  }
  return { status: 500, body: { error: { code: 'internal', message: 'Something went wrong. Nothing was changed.' } } };
}
