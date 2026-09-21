// In the browser, calls go through this app's own /api/* rewrite (see
// next.config.ts) so the backend's session cookie lands same-origin. On the
// server there's no "current origin" to resolve a relative URL against, so
// server-side fetches (Server Components) hit the backend directly.
const API_URL =
  typeof window !== 'undefined' ? '' : (process.env.POS_PORTAL_API_ORIGIN ?? 'http://localhost:4010');

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    // Only claim a JSON body when one is actually being sent — Fastify's
    // strict body parser 400s on Content-Type: application/json with an
    // empty body (e.g. a bodyless POST like sign-out).
    headers: init?.body ? { 'Content-Type': 'application/json', ...init?.headers } : init?.headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    // A 401 here means the session cookie is missing or no longer valid
    // server-side (expired, or the user/session row is gone — e.g. after a
    // database reset in dev). Bounce to login instead of leaving every panel
    // stuck showing empty/zero data with no explanation. Skip this on the
    // auth endpoints themselves — a failed *login* attempt is not "your
    // session expired," it's just wrong credentials, and redirecting there
    // would wipe out the error message before the user ever saw it.
    if (res.status === 401 && typeof window !== 'undefined' && !path.startsWith('/api/auth/')) {
      window.location.href = '/login';
    }
    throw new ApiError(body.error ?? 'Request failed', res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export { API_URL };
