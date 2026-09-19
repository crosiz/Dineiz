// Keeping the server sign-in alive for as long as the terminal is in use.
//
// A PIN sign-in gets a server session that lasts 12 hours (pin-login's
// SESSION_TTL_SECONDS). The terminal never renewed it, and a POS is left
// signed in across a whole day, often overnight. Once it lapsed, every request
// came back 401 and each screen failed in its own way: Close Shift said
// "Couldn't load this shift's totals", queued orders stopped syncing behind a
// toast, lists went quiet. Signing out and back in fixed it, which nobody knew
// to do.
//
// Now any 401 from our API (fetch-interceptor.ts), a failed sync (outbox.ts)
// or the clock (POSLayout) marks the session expired, and SessionExpiredDialog
// asks the same person for their PIN, renews the token in place and lets the
// screen that was waiting retry. Nothing on screen is lost, and queued work
// syncs as soon as the new token is in.

import { create } from 'zustand';
import { API_URL } from '@/lib/api';
import { getPosSession } from '@/lib/pos-session';
import { useCartStore } from '@/lib/store';

// Matches the server's pin-login SESSION_TTL_SECONDS.
const SESSION_HOURS = 12;

interface SessionGuard {
  expired: boolean;
  /** Bumps on every renewal, so a screen waiting on one can retry. */
  renewedAt: number;
  markExpired: () => void;
  markRenewed: () => void;
}

export const useSessionGuard = create<SessionGuard>((set) => ({
  expired: false,
  renewedAt: 0,
  markExpired: () => set({ expired: true }),
  markRenewed: () => set({ expired: false, renewedAt: Date.now() }),
}));

export function markSessionExpired(): void {
  if (typeof window === 'undefined' || !getPosSession()) return;
  // Signed in offline and the server hasn't re-checked the PIN yet: that
  // re-check swaps in a fresh token by itself (offline-auth.ts), so asking
  // for the PIN again would be asking twice.
  try {
    if (sessionStorage.getItem('pos_reauth')) {
      import('@/lib/offline-auth').then((m) => m.resumeOfflineFollowUps()).catch(() => {});
      return;
    }
  } catch { /* storage blocked: fall through and ask */ }
  if (!useSessionGuard.getState().expired) useSessionGuard.getState().markExpired();
}

/** The local copy of the session's expiry has passed. */
export function sessionLooksExpired(): boolean {
  const expiresAt = getPosSession()?.expiresAt;
  if (!expiresAt) return false;
  const t = Date.parse(expiresAt);
  return Number.isFinite(t) && t < Date.now();
}

async function hashPin(pin: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export type RenewResult =
  | { ok: true }
  | { ok: false; reason: 'wrong-pin'; attemptsLeft?: number }
  | { ok: false; reason: 'locked'; retryAfter: number }
  | { ok: false; reason: 'offline' }
  | { ok: false; reason: 'failed' };

/** Sign the current person in again with their PIN, keeping everything else. */
export async function renewSession(pin: string): Promise<RenewResult> {
  const session = getPosSession();
  if (!session) return { ok: false, reason: 'failed' };

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/pos/auth/pin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffId: session.userId, hashedPin: await hashPin(pin), branchId: session.branchId }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return { ok: false, reason: 'offline' };
  }

  if (res.status === 401) {
    const body = await res.json().catch(() => ({}));
    return { ok: false, reason: 'wrong-pin', attemptsLeft: body.attemptsLeft };
  }
  if (res.status === 429) {
    const body = await res.json().catch(() => ({}));
    return { ok: false, reason: 'locked', retryAfter: Number(body.retryAfter) || 60 };
  }
  if (res.status >= 500) return { ok: false, reason: 'offline' };
  if (!res.ok) return { ok: false, reason: 'failed' };

  const data = await res.json().catch(() => null);
  const token: string | undefined = data?.token;
  if (!token) return { ok: false, reason: 'failed' };

  // Swap the token in everywhere it is read from.
  localStorage.setItem('pos_token', token);
  const { signedInOffline: _dropped, ...rest } = session as typeof session & { signedInOffline?: boolean };
  localStorage.setItem('pos_session', JSON.stringify({
    ...rest,
    token,
    expiresAt: new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString(),
  }));
  const cur = useCartStore.getState().session;
  useCartStore.setState({ session: { ...cur, token } });

  try {
    const auth = await import('@/lib/offline-auth');
    auth.clearServerReauth();
    const user = data.user ?? {};
    void auth.rememberLogin(pin, {
      id: session.userId,
      name: user.name ?? session.name,
      role: user.role ?? session.role,
      tenantId: user.tenantId ?? session.tenantId,
      branchId: session.branchId,
      avatarColor: user.avatarColor ?? session.avatarColor ?? null,
    }, token).catch(() => {});
  } catch { /* the offline verifier just stays on the old token */ }

  useSessionGuard.getState().markRenewed();
  try {
    const { forceSyncNow } = await import('@/lib/core/outbox');
    forceSyncNow();
  } catch { /* the outbox picks the new token up on its next cycle */ }
  return { ok: true };
}
