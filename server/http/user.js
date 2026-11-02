// Who is asking. Behind Azure Easy Auth the platform sets the principal id
// header. On the hosted demo a judge needs no sign-in: a random visitor id
// lives in a cookie. Otherwise (locally) everyone is "local".
import { getCookie } from 'hono/cookie';
import { randomUUID } from 'node:crypto';

const SAFE_ID = /^[A-Za-z0-9-]{1,64}$/;
const VISITOR_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const VISITOR_COOKIE = 'ae_visitor';

// { id, isNew }: isNew means this response must set the visitor cookie; a null id means "sign in".
export function identify(c, { trustEasyAuth = false, visitorCookie = false } = {}) {
  const principal = trustEasyAuth ? c.req.header('x-ms-client-principal-id') : null;
  if (principal && SAFE_ID.test(principal)) return { id: principal, isNew: false };
  if (visitorCookie) {
    const cookie = getCookie(c, VISITOR_COOKIE) ?? '';
    return VISITOR_ID.test(cookie) ? { id: cookie, isNew: false } : { id: randomUUID(), isNew: true };
  }
  return { id: trustEasyAuth ? null : 'local', isNew: false };
}
