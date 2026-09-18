import { getToken } from '@/lib/pos-session';

// ─── The one place the terminal learns how to reach the API ────────────────
//
// Every call site used to inline
//   process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
// in 40+ files. `3001` is **this app's own dev port** — the API listens on
// 4000 (apps/api/src/server.ts). So a terminal built without
// NEXT_PUBLIC_API_URL didn't fall back to anything useful: it pointed every
// request at the POS's own Next server, which answers `POST /api/orders`
// with a 404. The outbox classified 404 as a permanent rejection, poisoned
// the CREATE_ORDER event, and cascade-poisoned every dependent event for
// that order. A single missing env var silently ate orders with no error a
// cashier could see.
//
// Resolution order, most-specific first. There is deliberately no
// same-origin fallback — that IS the bug above.

const RAW = (process.env.NEXT_PUBLIC_API_URL ?? '').trim();

/** Dev convenience only: a terminal served from localhost talks to the local API. */
const LOCAL_DEV_API = 'http://localhost:4000';

function isLocalHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

function resolve(): { url: string; configured: boolean } {
  if (RAW) return { url: RAW.replace(/\/+$/, ''), configured: true };
  if (typeof window !== 'undefined' && isLocalHost(window.location.hostname)) {
    return { url: LOCAL_DEV_API, configured: true };
  }
  return { url: '', configured: false };
}

const resolved = resolve();

/**
 * Base URL for the Dineiz API, with no trailing slash.
 *
 * Empty string when unconfigured — callers that matter check
 * `isApiConfigured()` first. Kept as a plain string (rather than throwing on
 * read) so importing this module can never break a screen that only needs
 * local data.
 */
export const API_URL: string = resolved.url;

/**
 * False when NEXT_PUBLIC_API_URL is missing on a non-localhost terminal.
 *
 * The outbox checks this before draining: with no API address, the right
 * behaviour is to leave every event QUEUED and show the operator a stuck
 * sync state — never to ship at a wrong address and poison the queue.
 */
export function isApiConfigured(): boolean {
  return resolved.configured;
}

export const API_NOT_CONFIGURED =
  'This terminal has no API address configured (NEXT_PUBLIC_API_URL). Nothing will sync until it is set.';

if (typeof window !== 'undefined' && !resolved.configured) {
  console.error(`[api] ${API_NOT_CONFIGURED}`);
}

/**
 * Socket.IO origin. Separate from `API_URL` because a deployment can put the
 * realtime server behind a different hostname (a sticky-session LB) — the env
 * var already exists in `.env.local` but nothing read it, so a split setup
 * would have silently connected sockets to the REST host.
 */
export const SOCKET_URL: string =
  (process.env.NEXT_PUBLIC_SOCKET_URL ?? '').trim().replace(/\/+$/, '') || API_URL;

/** Absolute URL for an API path. `path` may be given with or without a leading slash. */
export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

// ─── Errors ────────────────────────────────────────────────────────────────

/**
 * A request that reached the server and came back non-2xx, or never reached
 * it at all (`status: 0`).
 *
 * `status` is what callers branch on. `body` carries the parsed error payload
 * when the server sent one, so a screen can show the server's own message
 * instead of "Something went wrong".
 */
export class ApiError extends Error {
  readonly status: number;
  readonly body: any;
  readonly url: string;

  constructor(message: string, status: number, url: string, body?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.url = url;
    this.body = body;
  }

  /** No response at all: offline, DNS failure, timeout, or an aborted request. */
  get isNetwork(): boolean {
    return this.status === 0;
  }

  /** The signed-in cashier's token is gone or expired. */
  get isAuthExpired(): boolean {
    return this.status === 401;
  }
}

export interface ApiRequestInit extends Omit<RequestInit, 'body'> {
  /** Serialised as JSON unless it's already a string/FormData/Blob. */
  body?: unknown;
  /** Hard abort after this many ms. Default 8000, matching the outbox budget. */
  timeoutMs?: number;
  /** Sent as `X-Idempotency-Key` so a retry can't double-apply a write. */
  idempotencyKey?: string;
  /** Skip the Authorization header (only the PIN-login call needs this). */
  anonymous?: boolean;
}

export const DEFAULT_TIMEOUT_MS = 8000;

function buildHeaders(init: ApiRequestInit, hasJsonBody: boolean): Headers {
  const headers = new Headers(init.headers ?? {});
  if (hasJsonBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (!init.anonymous && !headers.has('Authorization')) {
    const token = getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  if (init.idempotencyKey && !headers.has('X-Idempotency-Key')) {
    headers.set('X-Idempotency-Key', init.idempotencyKey);
  }
  return headers;
}

/**
 * `fetch` against the API: absolute URL, bearer token, JSON encoding, and a
 * bounded timeout — the four things all 92 hand-rolled call sites got
 * inconsistently right. Returns the raw Response; use `api.*` below when you
 * just want the parsed body.
 *
 * Throws `ApiError` only for network/timeout failures. A non-2xx response
 * comes back as a Response, so callers that inspect `res.status` themselves
 * (the outbox does) keep working unchanged.
 */
export async function apiFetch(path: string, init: ApiRequestInit = {}): Promise<Response> {
  const url = apiUrl(path);
  if (!resolved.configured) {
    throw new ApiError(API_NOT_CONFIGURED, 0, url);
  }

  const { body, timeoutMs, idempotencyKey, anonymous, signal, ...rest } = init;

  const isRawBody =
    typeof body === 'string' ||
    (typeof FormData !== 'undefined' && body instanceof FormData) ||
    (typeof Blob !== 'undefined' && body instanceof Blob);
  const hasJsonBody = body !== undefined && !isRawBody;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs ?? DEFAULT_TIMEOUT_MS);
  // Honour a caller's own signal as well as our timeout — whichever fires first.
  const onCallerAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', onCallerAbort);

  try {
    return await fetch(url, {
      ...rest,
      headers: buildHeaders(init, hasJsonBody),
      body: body === undefined ? undefined : isRawBody ? (body as BodyInit) : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err: any) {
    const aborted = err?.name === 'AbortError';
    throw new ApiError(
      aborted ? `Request timed out after ${timeoutMs ?? DEFAULT_TIMEOUT_MS}ms` : (err?.message ?? 'Network request failed'),
      0,
      url,
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onCallerAbort);
  }
}

async function readError(res: Response, url: string): Promise<ApiError> {
  let body: any;
  let message = `HTTP ${res.status}`;
  try {
    const text = await res.text();
    if (text) {
      try {
        body = JSON.parse(text);
        message = body?.error ?? body?.message ?? message;
      } catch {
        body = text;
        message = text.slice(0, 200);
      }
    }
  } catch {
    /* body already consumed or unreadable — the status is enough */
  }
  return new ApiError(message, res.status, url, body);
}

/** `apiFetch` + parse, throwing `ApiError` on any non-2xx. */
export async function apiRequest<T = any>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) throw await readError(res, apiUrl(path));
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

function withQuery(path: string, query?: Record<string, string | number | boolean | null | undefined>): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === null || v === undefined || v === '') continue;
    params.set(k, String(v));
  }
  const qs = params.toString();
  if (!qs) return path;
  return `${path}${path.includes('?') ? '&' : '?'}${qs}`;
}

export const api = {
  get: <T = any>(path: string, query?: Record<string, any>, init?: ApiRequestInit) =>
    apiRequest<T>(withQuery(path, query), { ...init, method: 'GET' }),
  post: <T = any>(path: string, body?: unknown, init?: ApiRequestInit) =>
    apiRequest<T>(path, { ...init, method: 'POST', body }),
  put: <T = any>(path: string, body?: unknown, init?: ApiRequestInit) =>
    apiRequest<T>(path, { ...init, method: 'PUT', body }),
  patch: <T = any>(path: string, body?: unknown, init?: ApiRequestInit) =>
    apiRequest<T>(path, { ...init, method: 'PATCH', body }),
  del: <T = any>(path: string, init?: ApiRequestInit) =>
    apiRequest<T>(path, { ...init, method: 'DELETE' }),
};

/**
 * Best-effort GET that returns `null` instead of throwing.
 *
 * For the many screens whose correct offline behaviour is "carry on with
 * what's already on screen" — they previously each wrapped a bare fetch in
 * `.catch(() => {})`, which also swallowed real errors silently.
 */
export async function apiTry<T = any>(path: string, query?: Record<string, any>, init?: ApiRequestInit): Promise<T | null> {
  try {
    return await api.get<T>(path, query, init);
  } catch {
    return null;
  }
}
