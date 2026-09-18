// Signing in with no connection.
//
// The PIN is checked by the server (POST /api/pos/auth/pin-login), so a tablet
// that lost its connection could not sign anyone in: the staff list would not
// load and the PIN had nowhere to go. That is exactly when a cashier hands over
// or comes back from a break, and it locked them out of a terminal that could
// otherwise keep taking orders offline.
//
// What this keeps on the tablet:
//   - the branch's staff list, refreshed on every successful load;
//   - for each person who has signed in ONLINE on this terminal in the last
//     OFFLINE_LOGIN_MAX_AGE_MS, a PBKDF2 verifier of their PIN (random salt,
//     OFFLINE_PIN_ITERATIONS rounds), their profile, and the session token
//     the server gave them. Never the PIN itself.
//
// After an offline sign-in, the server has not seen this PIN today, and the
// saved token may have expired. So the terminal re-checks the PIN with the
// server as soon as it can reach it and swaps in the fresh token, which is
// what lets the orders queued meanwhile actually sync. That needs the PIN's
// SHA-256 (what pin-login takes), which is held in sessionStorage for this tab
// only, until that one check completes: offline, every screen change is a full
// page load, so memory alone would lose it on the first tap.
//
// A 4-digit PIN cannot be made strong, and anyone holding the tablet could
// brute-force a verifier given time. The salt and rounds keep that from being
// instant; the 7-day window and pruning of staff removed from the roster keep
// it from being forever. The server already stores these PINs as unsalted
// SHA-256, so none of this is weaker than what is there.

import { API_URL } from '@/lib/api';
import { useCartStore } from '@/lib/store';

export const OFFLINE_LOGIN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const OFFLINE_PIN_ITERATIONS = 300_000;
const MAX_WRONG_OFFLINE_ATTEMPTS = 5;

const ROSTER_KEY = 'pos_staff_roster';
const LOGINS_KEY = 'pos_offline_logins';
const REAUTH_KEY = 'pos_reauth';
const PENDING_BREAK_END_KEY = 'pos_pending_break_end';

export interface RosterStaff {
  id: string;
  name: string;
  role: string;
  avatarColor?: string | null;
}

export interface OfflineUser {
  id: string;
  name: string;
  role: string;
  tenantId: string;
  branchId: string;
  avatarColor?: string | null;
}

interface OfflineLogin {
  user: OfflineUser;
  salt: string;
  verifier: string;
  iterations: number;
  token: string;
  savedAt: number;
}

// ─── Storage helpers ─────────────────────────────────────────────────────

function read<T>(storage: Storage | undefined, key: string): T | null {
  try {
    const raw = storage?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(storage: Storage | undefined, key: string, value: unknown): void {
  try {
    if (value === null) storage?.removeItem(key);
    else storage?.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: offline sign-in simply won't be available.
  }
}

const local = () => (typeof window === 'undefined' ? undefined : window.localStorage);
const session = () => (typeof window === 'undefined' ? undefined : window.sessionStorage);

// ─── Staff roster ────────────────────────────────────────────────────────

export function saveRoster(branchId: string, branchName: string, staff: RosterStaff[]): void {
  write(local(), ROSTER_KEY, { branchId, branchName, staff, savedAt: Date.now() });
  // Someone taken off the branch loses offline sign-in the next time the
  // roster loads, not a week later.
  const logins = readLogins();
  const onRoster = new Set(staff.map((s) => s.id));
  let changed = false;
  for (const [id, login] of Object.entries(logins)) {
    if (login.user.branchId === branchId && !onRoster.has(id)) {
      delete logins[id];
      changed = true;
    }
  }
  if (changed) write(local(), LOGINS_KEY, logins);
}

export function readRoster(branchId: string): { branchName: string; staff: RosterStaff[] } | null {
  const r = read<{ branchId: string; branchName: string; staff: RosterStaff[] }>(local(), ROSTER_KEY);
  return r && r.branchId === branchId ? { branchName: r.branchName, staff: r.staff } : null;
}

// ─── Verifiers ───────────────────────────────────────────────────────────

function readLogins(): Record<string, OfflineLogin> {
  return read<Record<string, OfflineLogin>>(local(), LOGINS_KEY) ?? {};
}

const toHex = (buf: ArrayBuffer | Uint8Array) =>
  Array.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');

const fromHex = (hex: string) => new Uint8Array((hex.match(/../g) ?? []).map((h) => parseInt(h, 16)));

async function derive(pin: string, saltHex: string, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations },
    key,
    256,
  );
  return toHex(bits);
}

function sameHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function isFresh(login: OfflineLogin | undefined, branchId: string): login is OfflineLogin {
  return !!login && login.user.branchId === branchId && Date.now() - login.savedAt < OFFLINE_LOGIN_MAX_AGE_MS;
}

/** Called after every successful ONLINE sign-in. */
export async function rememberLogin(pin: string, user: OfflineUser, token: string): Promise<void> {
  if (!globalThis.crypto?.subtle) return;
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  const verifier = await derive(pin, salt, OFFLINE_PIN_ITERATIONS);
  const logins = readLogins();
  logins[user.id] = { user, salt, verifier, iterations: OFFLINE_PIN_ITERATIONS, token, savedAt: Date.now() };
  write(local(), LOGINS_KEY, logins);
}

export function forgetLogin(userId: string): void {
  const logins = readLogins();
  if (!logins[userId]) return;
  delete logins[userId];
  write(local(), LOGINS_KEY, logins);
}

/** The last server token this terminal holds for someone, if any. */
export function savedTokenFor(userId: string): string | null {
  return readLogins()[userId]?.token ?? null;
}

export function canSignInOffline(userId: string, branchId: string): boolean {
  return isFresh(readLogins()[userId], branchId);
}

export type OfflineCheck =
  | { ok: true; user: OfflineUser; token: string }
  | { ok: false; reason: 'unknown' | 'wrong-pin' | 'locked'; attemptsLeft?: number; lockedForSeconds?: number };

const LOCKOUT_SECONDS = 60;

/**
 * Check a PIN against this terminal's saved verifier. Wrong attempts share the
 * login screen's own counter and lockout keys, so going offline doesn't hand
 * out a fresh set of guesses.
 */
export async function checkPinOffline(userId: string, branchId: string, pin: string): Promise<OfflineCheck> {
  const login = readLogins()[userId];
  if (!isFresh(login, branchId) || !globalThis.crypto?.subtle) return { ok: false, reason: 'unknown' };

  const lockedUntil = Number(local()?.getItem('pos_lockout_until') ?? 0);
  if (lockedUntil > Date.now()) {
    return { ok: false, reason: 'locked', lockedForSeconds: Math.ceil((lockedUntil - Date.now()) / 1000) };
  }

  const candidate = await derive(pin, login.salt, login.iterations);
  if (sameHex(candidate, login.verifier)) {
    local()?.removeItem('pos_wrong_attempts');
    return { ok: true, user: login.user, token: login.token };
  }

  const used = Number(local()?.getItem('pos_wrong_attempts') ?? 0) + 1;
  if (used >= MAX_WRONG_OFFLINE_ATTEMPTS) {
    local()?.setItem('pos_lockout_until', String(Date.now() + LOCKOUT_SECONDS * 1000));
    local()?.removeItem('pos_wrong_attempts');
    return { ok: false, reason: 'locked', lockedForSeconds: LOCKOUT_SECONDS };
  }
  local()?.setItem('pos_wrong_attempts', String(used));
  return { ok: false, reason: 'wrong-pin', attemptsLeft: MAX_WRONG_OFFLINE_ATTEMPTS - used };
}

// ─── After an offline sign-in: confirm with the server ───────────────────

interface PendingReauth {
  staffId: string;
  branchId: string;
  hashedPin: string;
  name: string;
}

interface PendingBreakEnd {
  shiftId: string;
  endedAt: string;
}

export function queueServerReauth(p: PendingReauth): void {
  write(session(), REAUTH_KEY, p);
  resumeOfflineFollowUps();
}

/** An online sign-in supersedes any re-check left by an earlier offline one. */
export function clearServerReauth(): void {
  write(session(), REAUTH_KEY, null);
}

/** A break that ended while offline: reported, with its real time, on reconnect. */
export function queueBreakEnd(shiftId: string, endedAt: string): void {
  write(local(), PENDING_BREAK_END_KEY, { shiftId, endedAt });
  resumeOfflineFollowUps();
}

const RETRY_MS = 15_000;
const REQUEST_TIMEOUT_MS = 8_000;
let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let listening = false;

/**
 * Picks up whatever an offline sign-in left to do. Safe to call from every
 * screen mount: one runner per tab, and it stops itself once there is nothing
 * pending.
 */
export function resumeOfflineFollowUps(): void {
  if (typeof window === 'undefined') return;
  if (!read(session(), REAUTH_KEY) && !read(local(), PENDING_BREAK_END_KEY)) return;
  if (!listening) {
    listening = true;
    window.addEventListener('online', () => schedule(0));
  }
  schedule(0);
}

function schedule(ms: number) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; void run(); }, ms);
}

async function post(path: string, body: unknown, token?: string): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(t);
  }
}

async function run(): Promise<void> {
  if (running) return;
  running = true;
  let retry = false;
  try {
    if (navigator.onLine === false) { retry = true; return; }

    const reauth = read<PendingReauth>(session(), REAUTH_KEY);
    if (reauth) {
      const outcome = await confirmWithServer(reauth);
      if (outcome === 'retry') { retry = true; return; }
    }

    const breakEnd = read<PendingBreakEnd>(local(), PENDING_BREAK_END_KEY);
    // A break end waits for a token the server accepts: while a re-check is
    // still pending, the saved one may be stale.
    if (breakEnd && !read(session(), REAUTH_KEY)) {
      const outcome = await reportBreakEnd(breakEnd);
      if (outcome === 'retry') retry = true;
    }
  } finally {
    running = false;
    if (retry) schedule(RETRY_MS);
  }
}

async function confirmWithServer(p: PendingReauth): Promise<'done' | 'retry'> {
  // Someone else has signed in since: this re-check is theirs no longer, and
  // its token must not replace the current person's.
  const current = read<{ userId?: string }>(local(), 'pos_session');
  if (current?.userId !== p.staffId) {
    write(session(), REAUTH_KEY, null);
    return 'done';
  }

  let res: Response;
  try {
    res = await post('/api/pos/auth/pin-login', { staffId: p.staffId, hashedPin: p.hashedPin, branchId: p.branchId });
  } catch {
    return 'retry';
  }
  if (res.status >= 500 || res.status === 429) return 'retry';

  write(session(), REAUTH_KEY, null);

  if (!res.ok) {
    // The server no longer accepts this PIN: changed, or the account removed.
    // The offline verifier is out of date too, so it goes. The cashier's work
    // is safe in the queue; it syncs once they sign in again.
    forgetLogin(p.staffId);
    const { toast } = await import('sonner');
    toast.error(`${p.name}'s PIN was changed. Sign out and sign in again so your orders can sync.`, { duration: Infinity });
    return 'done';
  }

  const data = await res.json().catch(() => null);
  const token: string | undefined = data?.token;
  if (!token) return 'done';

  // Swap in the fresh token everywhere it is read from.
  local()?.setItem('pos_token', token);
  const stored = read<Record<string, unknown>>(local(), 'pos_session');
  if (stored) {
    const { signedInOffline: _dropped, ...rest } = stored;
    write(local(), 'pos_session', { ...rest, token });
  }
  const cur = useCartStore.getState().session;
  useCartStore.setState({ session: { ...cur, token } });

  // Keep the offline verifier's token current as well.
  const logins = readLogins();
  if (logins[p.staffId]) {
    logins[p.staffId] = { ...logins[p.staffId], token };
    write(local(), LOGINS_KEY, logins);
  }

  try {
    const { forceSyncNow } = await import('@/lib/core/outbox');
    forceSyncNow();
  } catch { /* the outbox picks the new token up on its next cycle anyway */ }
  return 'done';
}

async function reportBreakEnd(b: PendingBreakEnd): Promise<'done' | 'retry'> {
  const token = local()?.getItem('pos_token') ?? undefined;
  let res: Response;
  try {
    res = await post(`/api/shifts/${b.shiftId}/break/end`, { endedAt: b.endedAt }, token);
  } catch {
    return 'retry';
  }
  if (res.status >= 500 || res.status === 401 || res.status === 429) return 'retry';
  write(local(), PENDING_BREAK_END_KEY, null);
  if (res.ok) {
    try {
      const { endBreak } = await import('@/lib/core/commands');
      endBreak(b.shiftId).catch(() => {});
    } catch { /* audit-trail only */ }
  }
  return 'done';
}
