import { create } from 'zustand';
import { getPosSession, getToken, getPosShift } from './pos-session';

// ─── Manager overlay (spec Part 10) ──────────────────────────────────────
//
// A temporary elevated session a manager runs ON a cashier's terminal to
// approve something (a void, an over-limit discount, a table override, an
// orphan adoption, a stock correction, a waiter reassignment, force-closing
// another shift). The cashier's session, shift and cart are NEVER touched.
//
// While it is active, event-log.ts stamps `overrideById/overrideByName/
// overrideReason` on EVERY event, so revenue stays attributed to the cashier
// and the authorisation is attributed to the manager — permanently, in
// ManagerOverride (server) and the local event log.
//
// It ends: manually, after `managerOverlayIdleMinutes` of no activity, after
// a single action in one-shot mode, if the tab is backgrounded for 60s, or
// if the manager navigates toward taking a payment.

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const LS_KEY = 'pos_manager_overlay';
const BACKGROUND_GRACE_MS = 60_000;

export type OverlayExitReason = 'MANUAL' | 'IDLE' | 'ONE_SHOT' | 'BACKGROUNDED' | 'NAV_PAYMENT' | 'SHIFT_CLOSED';

export interface OverlayState {
  overrideId: string;
  managerId: string;
  managerName: string;
  cashierName: string;
  reason: string;
  oneShot: boolean;
  startedAt: number; // ms epoch
  lastActivityAt: number;
  actionCount: number;
}

// Actions the overlay is allowed to authorise. Everything else (create an
// order, take a payment, close the cashier's shift, change tenant settings)
// is NOT — those stay the cashier's job or belong in the console.
export const OVERLAY_ALLOWED_ACTIONS = [
  'VOID_ITEM', 'VOID_ORDER', 'DISCOUNT_OVERRIDE', 'REMOVE_DISCOUNT', 'REOPEN_ORDER',
  'REFUND', 'TABLE_OVERRIDE', 'ADOPT_ORPHAN', 'FORCE_CLOSE_SHIFT', 'STOCK_CORRECTION',
  'REASSIGN_WAITER', 'WALK_OUT',
] as const;
export type OverlayAction = (typeof OVERLAY_ALLOWED_ACTIONS)[number];

function idleWindowMs(): number {
  try {
    const b = JSON.parse(localStorage.getItem('pos_branding') ?? '{}');
    const p = { ...(b.pos ?? {}), ...b };
    const mins = Number(p.managerOverlayIdleMinutes);
    return (Number.isFinite(mins) && mins > 0 ? mins : 5) * 60_000;
  } catch {
    return 5 * 60_000;
  }
}

function authHeaders() {
  const t = getToken();
  return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

interface Store {
  overlay: OverlayState | null;
  hydrate: () => void;
  start: (mgr: { overrideId: string; managerId: string; managerName: string }, opts: { reason: string; oneShot: boolean }) => void;
  bump: () => void;
  recordAction: (action: OverlayAction, targetId?: string, meta?: unknown) => Promise<void>;
  exit: (reason: OverlayExitReason) => void;
  remainingSec: () => number;
  isActive: () => boolean;
  approverId: () => string | undefined;
}

let idleTimer: ReturnType<typeof setTimeout> | null = null;
let bgTimer: ReturnType<typeof setTimeout> | null = null;
let visHandler: (() => void) | null = null;

function clearTimers() {
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
  if (bgTimer) { clearTimeout(bgTimer); bgTimer = null; }
  if (visHandler) { document.removeEventListener('visibilitychange', visHandler); visHandler = null; }
}

function persist(s: OverlayState | null) {
  try {
    if (s) localStorage.setItem(LS_KEY, JSON.stringify(s));
    else localStorage.removeItem(LS_KEY);
  } catch { /* ignore */ }
}

export const useManagerOverlay = create<Store>((set, get) => {
  const armTimers = () => {
    clearTimers();
    const s = get().overlay;
    if (!s) return;
    const left = idleWindowMs() - (Date.now() - s.lastActivityAt);
    idleTimer = setTimeout(() => get().exit('IDLE'), Math.max(1000, left));

    visHandler = () => {
      if (document.visibilityState === 'hidden') {
        bgTimer = setTimeout(() => get().exit('BACKGROUNDED'), BACKGROUND_GRACE_MS);
      } else if (bgTimer) {
        clearTimeout(bgTimer); bgTimer = null;
      }
    };
    document.addEventListener('visibilitychange', visHandler);
  };

  return {
    overlay: null,

    hydrate: () => {
      let raw: string | null = null;
      try { raw = localStorage.getItem(LS_KEY); } catch { /* ignore */ }
      if (!raw) return;
      try {
        const s = JSON.parse(raw) as OverlayState;
        if (Date.now() - s.lastActivityAt > idleWindowMs()) {
          // Went stale while the tab was closed — end it (best-effort) and drop.
          fetch(`${API_URL}/api/pos/manager-override/${s.overrideId}/end`, {
            method: 'POST', headers: authHeaders(), body: JSON.stringify({ exitReason: 'IDLE' }),
          }).catch(() => {});
          persist(null);
          return;
        }
        set({ overlay: s });
        armTimers();
      } catch {
        persist(null);
      }
    },

    start: (mgr, opts) => {
      const s: OverlayState = {
        overrideId: mgr.overrideId,
        managerId: mgr.managerId,
        managerName: mgr.managerName,
        cashierName: getPosSession()?.name ?? 'the cashier',
        reason: opts.reason,
        oneShot: opts.oneShot,
        startedAt: Date.now(),
        lastActivityAt: Date.now(),
        actionCount: 0,
      };
      set({ overlay: s });
      persist(s);
      armTimers();
    },

    bump: () => {
      const s = get().overlay;
      if (!s) return;
      const next = { ...s, lastActivityAt: Date.now() };
      set({ overlay: next });
      persist(next);
      armTimers();
    },

    recordAction: async (action, targetId, meta) => {
      const s = get().overlay;
      if (!s) return;
      const next = { ...s, actionCount: s.actionCount + 1, lastActivityAt: Date.now() };
      set({ overlay: next });
      persist(next);
      fetch(`${API_URL}/api/pos/manager-override/${s.overrideId}/action`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ action, targetId, meta }),
      }).catch(() => { /* offline — the local event log still carries the override stamp */ });
      if (s.oneShot) get().exit('ONE_SHOT');
      else armTimers();
    },

    exit: (reason) => {
      const s = get().overlay;
      clearTimers();
      set({ overlay: null });
      persist(null);
      if (!s) return;
      fetch(`${API_URL}/api/pos/manager-override/${s.overrideId}/end`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ exitReason: reason }),
      }).catch(() => {});
    },

    remainingSec: () => {
      const s = get().overlay;
      if (!s) return 0;
      return Math.max(0, Math.round((idleWindowMs() - (Date.now() - s.lastActivityAt)) / 1000));
    },

    isActive: () => !!get().overlay,
    approverId: () => get().overlay?.managerId,
  };
});

// Read the current override attribution WITHOUT subscribing (event-log.ts).
export function readOverlayAttribution(): { overrideById: string | null; overrideByName: string | null; overrideReason: string | null } {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { overrideById: null, overrideByName: null, overrideReason: null };
    const s = JSON.parse(raw) as OverlayState;
    return { overrideById: s.managerId, overrideByName: s.managerName, overrideReason: s.reason || null };
  } catch {
    return { overrideById: null, overrideByName: null, overrideReason: null };
  }
}

export { getPosShift };
