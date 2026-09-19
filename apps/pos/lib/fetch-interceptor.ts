import { API_URL } from '@/lib/api';
import { markSessionExpired } from '@/lib/session-guard';

// Attaches the POS bearer token to calls that go to OUR API and don't already
// carry an Authorization header.
//
// This is transitional. The real fix is `lib/api.ts`'s `apiFetch`, which does
// this (plus timeouts and typed errors) without patching a global; call sites
// are being moved over screen by screen. Until then this keeps the remaining
// raw `fetch()` sites authenticated.
//
// It used to match on `url.includes('/api/')` — which is true of plenty of
// third-party URLs — so the cashier's token was attached to requests leaving
// for other origins entirely. Scoped to the configured API origin now, and
// same-origin `/api/...` paths, nothing else.
//
// It also watches the answers: a 401 from the auth middleware means the
// server session has lapsed (lib/session-guard.ts). Only that one — a wrong
// manager PIN is a 401 too, with its own message, and must not ask the
// cashier to sign in again.

if (typeof window !== 'undefined') {
  const originalFetch = window.fetch;

  const apiOrigin = (() => {
    try {
      return API_URL ? new URL(API_URL).origin : null;
    } catch {
      return null;
    }
  })();

  const targetsOurApi = (raw: string): boolean => {
    if (!raw) return false;
    // Relative path on this origin, e.g. '/api/foo'.
    if (raw.startsWith('/')) return raw.startsWith('/api/');
    try {
      const u = new URL(raw, window.location.href);
      if (apiOrigin && u.origin === apiOrigin) return true;
      return u.origin === window.location.origin && u.pathname.startsWith('/api/');
    } catch {
      return false;
    }
  };

  const watch = async (res: Response): Promise<Response> => {
    if (res.status !== 401) return res;
    try {
      const body = await res.clone().json();
      if (typeof body?.error === 'string' && body.error.startsWith('Unauthorized')) markSessionExpired();
    } catch { /* not the middleware's JSON */ }
    return res;
  };

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string' ? input
      : input instanceof URL ? input.toString()
      : input instanceof Request ? input.url
      : '';

    if (!targetsOurApi(url)) return originalFetch(input as any, init);

    const token = localStorage.getItem('pos_token');
    if (!token) return originalFetch(input as any, init);

    // A Request object carries its own headers; don't rebuild it — just skip,
    // since every Request-based caller in this app sets its own auth.
    if (input instanceof Request) return watch(await originalFetch(input, init));

    const options: RequestInit = { ...(init ?? {}) };
    const headers = new Headers(options.headers ?? {});
    if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
    options.headers = headers;

    return watch(await originalFetch(input as any, options));
  };
}
