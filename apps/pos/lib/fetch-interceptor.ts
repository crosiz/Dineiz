import { API_URL } from '@/lib/api';

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
    if (input instanceof Request) return originalFetch(input, init);

    const options: RequestInit = { ...(init ?? {}) };
    const headers = new Headers(options.headers ?? {});
    if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
    options.headers = headers;

    return originalFetch(input as any, options);
  };
}
