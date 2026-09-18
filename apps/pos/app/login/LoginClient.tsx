'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCartStore } from '@/lib/store';
import { toast } from 'sonner';
import { DineizLogo } from '@/components/ui/DineizLogo';
import { getPosBreak, clearPosBreak, getPosShift } from '@/lib/pos-session';
import { API_URL } from '@/lib/api';
import {
  canSignInOffline, checkPinOffline, clearServerReauth, queueBreakEnd, queueServerReauth, readRoster, rememberLogin, saveRoster,
  type OfflineUser,
} from '@/lib/offline-auth';
import { ArrowLeft, Banknote, BatteryCharging, Bike, ChefHat, ChevronRight, CircleUser, Delete, Loader2, LogIn, Pencil, UserCog, Utensils, Wifi, WifiOff, type LucideIcon } from 'lucide-react';

const PIN_LENGTH = 4;

// Long enough for a cold API, short enough that a connection which is up but
// passing nothing (café wifi with no internet) doesn't strand the cashier on a
// spinner: past this, the login falls back to this terminal's offline check.
const LOGIN_TIMEOUT_MS = 8000;
const STAFF_TIMEOUT_MS = 6000;

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

const NUMPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'backspace', '0', 'confirm'];

interface Props {
  branchId: string;
  branchName: string;
}

interface Staff {
  id: string;
  name: string;
  role: string;
  avatarColor?: string | null;
}

// Client-side SHA-256 hash (unsalted to match existing DB records)
async function hashPinClient(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function LoginClient({ branchId: defaultBranchId, branchName: defaultBranchName }: Props) {
  const router = useRouter();
  const setSession = useCartStore((s) => s.setSession);

  const [activeBranchId, setActiveBranchId] = useState<string>('');
  const [activeBranchName, setActiveBranchName] = useState<string>(defaultBranchName);

  const [timeStr, setTimeStr] = useState('00:00');
  const [greeting, setGreeting] = useState('Good morning');

  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [hasActiveShift, setHasActiveShift] = useState(false);
  const [isShiftLoading, setIsShiftLoading] = useState(true);
  // The API couldn't be reached and the staff list came from this terminal's
  // copy. Sign-in then goes through the offline check.
  const [offline, setOffline] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // Replaces "Incorrect PIN" when the problem is something else, e.g. no
  // connection and no saved sign-in for this person.
  const [pinNote, setPinNote] = useState<string | null>(null);

  const availableRoles = useMemo(() => {
    const roles = new Set(staffList.map((s) => s.role));
    return Array.from(roles).map((roleId) => {
      let label = roleId.replace(/_/g, ' ');
      label = label.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

      let Icon: LucideIcon = CircleUser;
      if (roleId === 'BRANCH_MANAGER' || roleId === 'MANAGER') Icon = UserCog;
      else if (roleId === 'HEAD_CASHIER' || roleId === 'CASHIER') Icon = Banknote;
      else if (roleId === 'KITCHEN_STAFF') Icon = ChefHat;
      else if (roleId === 'RIDER' || roleId === 'DELIVERY') Icon = Bike;
      else if (roleId === 'WAITER') Icon = Utensils;

      return { id: roleId, label, Icon };
    });
  }, [staffList]);

  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [pin, setPin] = useState<string>('');
  const [pinStatus, setPinStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [shake, setShake] = useState(false);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [lockoutTimer, setLockoutTimer] = useState(0);

  // Break mode state
  const searchParams = useSearchParams();
  const isBreakMode = searchParams.get('reason') === 'break';

  // Tick counter — forces re-render every minute so elapsed recalculates
  const [breakTick, setBreakTick] = useState(0);
  useEffect(() => {
    if (!isBreakMode) return;
    const id = setInterval(() => setBreakTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, [isBreakMode]);

  // Compute elapsed on every render (driven by breakTick)
  const breakElapsed = (() => {
    if (!isBreakMode) return '';
    const posBreak = getPosBreak();
    if (!posBreak?.startedAt) return '';
    const ms = Date.now() - new Date(posBreak.startedAt).getTime();
    if (ms < 60_000) return '< 1 min';
    const totalMin = Math.floor(ms / 60_000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  })();

  // Initialize Branch ID and Theme from LocalStorage
  useEffect(() => {
    const storedBranchId = localStorage.getItem('pos_branch_id');
    const branchToUse = storedBranchId || defaultBranchId;
    setActiveBranchId(branchToUse);

    if (!storedBranchId) {
      localStorage.setItem('pos_branch_id', defaultBranchId);
    }

    const brandingStr = localStorage.getItem('pos_branding');
    if (brandingStr) {
      try {
        const branding = JSON.parse(brandingStr);
        if (branding.primaryColor) {
          document.documentElement.style.setProperty('--pos-primary', branding.primaryColor);
        }
      } catch (e) { }
    } else {
      document.documentElement.style.setProperty('--pos-primary', '#F59E0B');
    }
  }, [defaultBranchId]);

  // Warm the two routes every successful PIN entry lands on next, before the
  // cashier ever taps a key. POSLayout (apps/pos/app/pos/POSLayout.tsx)
  // already prefetches the main POS tabs, but only after first mounting
  // under /pos — which means the very first hop out of /login (to either
  // /pos/shift/open or /pos/home) is always a cold Next.js dev-mode route
  // compile with nothing warming it in advance. This is the one navigation
  // every cashier hits daily that the existing prefetch never reaches.
  useEffect(() => {
    router.prefetch('/pos/shift/open');
    router.prefetch('/pos/home');
  }, [router]);

  // Fetch Staff and Shift status
  useEffect(() => {
    if (!activeBranchId) return;

    const fetchStaff = async () => {
      try {
        const res = await fetchWithTimeout(`${API_URL}/api/pos/staff?branchId=${activeBranchId}`, { credentials: 'include' }, STAFF_TIMEOUT_MS);
        if (res.ok) {
          const data = await res.json();
          if (data.staff) {
            setStaffList(data.staff);
            saveRoster(activeBranchId, data.branchName ?? '', data.staff);
          }
          if (data.branchName) setActiveBranchName(data.branchName);
          setOffline(false);
          return;
        }
        if (res.status === 404) {
          setActiveBranchName('Branch Not Found');
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      } catch (e) {
        console.warn('Staff list unavailable, using this terminal’s copy', e);
        setOffline(true);
        const cached = readRoster(activeBranchId);
        if (cached) {
          setStaffList(cached.staff);
          if (cached.branchName) setActiveBranchName(cached.branchName);
        }
      }
    };

    const fetchShiftStatus = async () => {
      try {
        const res = await fetchWithTimeout(`${API_URL}/api/pos/shifts/active?branchId=${activeBranchId}`, { credentials: 'include' }, STAFF_TIMEOUT_MS);
        if (res.ok) {
          const data = await res.json();
          setHasActiveShift(!!data.hasActiveShift);
        }
      } catch (e) {
        // Offline: this terminal's own record of its open shift is the best
        // answer there is, and it is what the POS itself will go by.
        setHasActiveShift(!!getPosShift());
      } finally {
        setIsShiftLoading(false);
      }
    };

    void fetchStaff();
    void fetchShiftStatus();
  }, [activeBranchId, reloadKey]);

  // Back online: reload the live staff list so newly added staff appear and
  // sign-in goes to the server again.
  useEffect(() => {
    const onOnline = () => setReloadKey((k) => k + 1);
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  // Clock & Greeting
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      setTimeStr(`${hours}:${minutes}`);

      const h = now.getHours();
      if (h < 12) setGreeting('Good morning');
      else if (h < 17) setGreeting('Good afternoon');
      else setGreeting('Good evening');
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Lockout Timer & State Restoration
  useEffect(() => {
    const lockoutUntil = localStorage.getItem('pos_lockout_until');
    if (lockoutUntil) {
      const remaining = Math.ceil((parseInt(lockoutUntil) - Date.now()) / 1000);
      if (remaining > 0) {
        setLockoutTimer(remaining);
      } else {
        localStorage.removeItem('pos_lockout_until');
      }
    }
    const attempts = localStorage.getItem('pos_wrong_attempts');
    if (attempts) {
      setWrongAttempts(parseInt(attempts, 10));
    }
  }, []);

  useEffect(() => {
    if (lockoutTimer > 0) {
      const timer = setTimeout(() => setLockoutTimer(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    } else if (lockoutTimer === 0) {
      const lockoutUntil = localStorage.getItem('pos_lockout_until');
      if (lockoutUntil && parseInt(lockoutUntil) <= Date.now()) {
        localStorage.removeItem('pos_lockout_until');
      }
    }
  }, [lockoutTimer]);

  const handleKey = useCallback(
    (key: string) => {
      if (pinStatus === 'loading' || pinStatus === 'success' || lockoutTimer > 0) return;

      setPinNote(null);

      if (key === 'backspace') {
        setPin((p) => p.slice(0, -1));
        setPinStatus('idle');
        return;
      }

      if (key === 'confirm') {
        if (pin.length === PIN_LENGTH) void submitPin();
        return;
      }

      if (pin.length >= PIN_LENGTH) return;

      const newPin = pin + key;
      setPin(newPin);

      if (newPin.length === PIN_LENGTH) {
        setTimeout(() => {
          void submitPin(newPin);
        }, 150);
      }
    },
    [pin, pinStatus, lockoutTimer, selectedStaff]
  );

  useEffect(() => {
    if (!selectedStaff) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') handleKey(e.key);
      if (e.key === 'Backspace') handleKey('backspace');
      if (e.key === 'Enter') handleKey('confirm');
      if (e.key === 'Escape') {
        setSelectedStaff(null);
        setPin('');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedStaff, handleKey]);

  async function submitPin(pinToSubmit = pin) {
    if (pinToSubmit.length !== PIN_LENGTH || !selectedStaff) return;

    setPinStatus('loading');
    try {
      const hashedPin = await hashPinClient(pinToSubmit);

      // No network, a request that goes nowhere, or a server that can't check
      // the PIN right now (5xx): all mean "ask this terminal instead".
      let res: Response | null = null;
      if (navigator.onLine !== false) {
        try {
          res = await fetchWithTimeout(`${API_URL}/api/pos/auth/pin-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ staffId: selectedStaff.id, hashedPin, branchId: activeBranchId }),
          }, LOGIN_TIMEOUT_MS);
        } catch {
          res = null;
        }
      }

      if (!res || res.status >= 500) {
        await signInOffline(pinToSubmit, hashedPin);
        return;
      }

      if (!res.ok) {
        if (res.status === 429) {
          const errData = await res.json().catch(() => ({}));
          const retryAfter = errData.retryAfter || 60;
          setLockoutTimer(retryAfter);
          localStorage.setItem('pos_lockout_until', (Date.now() + retryAfter * 1000).toString());
          setWrongAttempts(0);
          localStorage.removeItem('pos_wrong_attempts');
          throw new Error('Lockout');
        } else if (res.status === 401) {
          const errData = await res.json().catch(() => ({}));
          const attemptsLeft = errData.attemptsLeft;
          if (typeof attemptsLeft === 'number') {
            const used = 5 - attemptsLeft;
            setWrongAttempts(used);
            localStorage.setItem('pos_wrong_attempts', used.toString());
          }
          throw new Error('Invalid PIN');
        } else {
          throw new Error('Failed to login');
        }
      }

      setOffline(false);
      clearServerReauth();
      const data = await res.json();
      const user = data.user;

      // Save this PIN's offline verifier so this person can sign in here
      // without a connection later. Not awaited: it's a fraction of a second of hashing the
      // cashier shouldn't wait on, and the navigation below is client-side, so
      // it finishes in the background.
      void rememberLogin(pinToSubmit, {
        id: user.id,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        branchId: user.branchId,
        avatarColor: user.avatarColor ?? null,
      }, data.token).catch(() => {});

      await completeSignIn({
        user,
        token: data.token,
        branding: data.branding,
        activeShift: data.activeShift,
        offline: false,
      });
    } catch (error: any) {
      setPinStatus('error');
      setPin('');
      setShake(true);
      setTimeout(() => setShake(false), 400);

      if (error.message !== 'Lockout') {
        setTimeout(() => setPinStatus('idle'), 600);
      }
    }
  }

  // The server couldn't be asked, so check the PIN against this terminal's
  // saved verifier (lib/offline-auth.ts). Throws like the online path does, so
  // the shake and lockout handling in submitPin's catch apply unchanged.
  async function signInOffline(pinToSubmit: string, hashedPin: string) {
    if (!selectedStaff) return;
    setOffline(true);
    const check = await checkPinOffline(selectedStaff.id, activeBranchId, pinToSubmit);

    if (!check.ok) {
      if (check.reason === 'unknown') {
        setPinNote(`No connection. ${selectedStaff.name.split(' ')[0]} needs to sign in once on this terminal while online.`);
        throw new Error('No offline sign-in');
      }
      if (check.reason === 'locked') {
        setLockoutTimer(check.lockedForSeconds ?? 60);
        setWrongAttempts(0);
        throw new Error('Lockout');
      }
      setWrongAttempts(5 - (check.attemptsLeft ?? 0));
      throw new Error('Invalid PIN');
    }

    queueServerReauth({ staffId: check.user.id, branchId: activeBranchId, hashedPin, name: check.user.name });
    await completeSignIn({ user: check.user, token: check.token, offline: true });
  }

  async function completeSignIn({ user, token, branding, activeShift, offline: signedInOffline }: {
    user: OfflineUser;
    token: string;
    branding?: any;
    activeShift?: { id: string; openedAt: string; openingFloat: number } | null;
    offline: boolean;
  }) {
    // Update Session — must include the token itself: this Zustand store is
    // a long-lived in-memory singleton, so several call sites read
    // session.token directly (not the localStorage-backed getToken()
    // helper). Omitting it here meant every one of those requests silently
    // sent no Authorization header (401) until the next full page reload
    // re-hydrated the store from localStorage.
    setSession({
      cashierId: user.id,
      cashierName: user.name,
      tenantId: user.tenantId,
      branchId: user.branchId,
      branchName: activeBranchName,
      shiftId: activeShift?.id || undefined,
      role: user.role,
      token,
    });

    const posSession = {
      userId: user.id,
      name: user.name,
      role: user.role,
      branchId: user.branchId,
      branchName: activeBranchName,
      tenantId: user.tenantId,
      avatarColor: user.avatarColor || '#F59E0B',
      token,
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
      // Cleared once the server has re-checked the PIN (lib/offline-auth.ts).
      ...(signedInOffline ? { signedInOffline: true } : {}),
    };

    localStorage.setItem('pos_session', JSON.stringify(posSession));
    localStorage.setItem('pos_token', token);
    if (branding) {
      localStorage.setItem('pos_branding', JSON.stringify(branding));
      if (branding.primaryColor) {
        document.documentElement.style.setProperty('--pos-primary', branding.primaryColor);
      }
      // Seed pos_tenant_settings from the login response too, so the POS
      // config/Kitchen toggles (require-shift-opening, block-out-of-stock,
      // auto-print, useKDS) are correct from a cashier's very first
      // session instead of only arriving later via a live admin edit.
      if (branding.pos || branding.kitchen) {
        try {
          const existingStr = localStorage.getItem('pos_tenant_settings');
          const existing = existingStr ? JSON.parse(existingStr) : {};
          localStorage.setItem('pos_tenant_settings', JSON.stringify({
            ...existing,
            pos: { ...existing.pos, ...branding.pos },
            kitchen: { ...existing.kitchen, ...branding.kitchen },
          }));
        } catch {}
      }
    }

    setPinStatus('success');
    setWrongAttempts(0);
    localStorage.removeItem('pos_wrong_attempts');
    localStorage.removeItem('pos_lockout_until');

    // Store or verify pos_shift
    if (activeShift) {
      localStorage.setItem('pos_shift', JSON.stringify({
        shiftId: activeShift.id,
        openedAt: activeShift.openedAt,
        openingFloat: activeShift.openingFloat
      }));
    } else if (signedInOffline) {
      // Nothing to verify against: this terminal's open shift is the shift.
      const stored = getPosShift();
      if (stored?.shiftId) setSession({ shiftId: stored.shiftId });
    } else {
      const storedShiftStr = localStorage.getItem('pos_shift');
      if (storedShiftStr) {
        try {
          const shiftObj = JSON.parse(storedShiftStr);
          if (shiftObj.shiftId) {
            const shiftRes = await fetch(`${API_URL}/api/shifts/${shiftObj.shiftId}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (shiftRes.ok) {
              const shiftData = await shiftRes.json();
              if (shiftData.status !== 'OPEN') {
                localStorage.removeItem('pos_shift');
              } else {
                setSession({ shiftId: shiftObj.shiftId });
              }
            } else {
              localStorage.removeItem('pos_shift');
            }
          }
        } catch (e) {
          localStorage.removeItem('pos_shift');
        }
      }
    }

    // End break if returning from break mode
    const posBreak = getPosBreak();
    if (posBreak?.shiftId && signedInOffline) {
      // Recorded with the time they actually came back, once there is a
      // connection to record it on.
      queueBreakEnd(posBreak.shiftId, new Date().toISOString());
      clearPosBreak();
      toast.success('Welcome back! Your break end will be recorded when the connection returns.', { duration: 4000 });
    } else if (posBreak?.shiftId) {
      try {
        // A Content-Type: application/json header with no body is rejected
        // by Fastify before the route runs — same bug as break/start (see
        // POSTopBar.tsx). It made every break-end call fail silently, which
        // left the ShiftBreak row open forever (durationMinutes null),
        // still counted as "on break" until the shift itself closed.
        const breakRes = await fetch(`${API_URL}/api/shifts/${posBreak.shiftId}/break/end`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        if (breakRes.ok) {
          const breakData = await breakRes.json();
          const mins = breakData.durationMinutes ?? 0;
          toast.success(`Welcome back! Break was ${mins} minute${mins !== 1 ? 's' : ''}.`, { duration: 4000 });
          // Local audit-trail record — only once the server has confirmed
          // it. Recording this unconditionally (including when the server
          // rejected the call) left a break "confirmed" in the local log
          // forever with no way to tell it apart from a real one — SHIFT
          // events auto-confirm on append and never retry through the
          // outbox.
          const { endBreak } = await import('@/lib/core/commands');
          endBreak(posBreak.shiftId).catch(() => {});
        } else {
          const body = await breakRes.json().catch(() => ({}));
          toast.error(body?.error || "Couldn't confirm your break ended — check with your manager if it looks wrong.");
        }
      } catch {
        toast.error("Couldn't reach the server to end your break — check with your manager if it looks wrong.");
      } finally {
        clearPosBreak();
      }
    } else if (signedInOffline) {
      toast.success('Signed in offline. Orders will sync when the connection returns.', { duration: 4000 });
    }

    let destination = '/pos/home';
    if (user.role === 'KITCHEN_STAFF') {
      destination = '/pos/kds';
    } else if (user.role === 'WAITER') {
      destination = '/pos/tables';
      if (!signedInOffline) {
        try {
          const tableRes = await fetch(`${API_URL}/api/tables/assigned?userId=${user.id}&branchId=${user.branchId}`, {
             headers: { Authorization: `Bearer ${token}` }
          });
          if (tableRes.ok) {
            const assignedData = await tableRes.json();
            localStorage.setItem('pos_assigned_tables', JSON.stringify(assignedData.assignedTableIds || []));
          }
        } catch(e) {
          console.error('Failed to fetch assigned tables', e);
        }
      }
    }

    if (signedInOffline) {
      // A client-side push would first try to fetch the next screen's data
      // from the server, fail, and only then fall back to a full load. Go
      // straight to the full load; the service worker serves it. The toast
      // above gets a moment on screen first.
      setTimeout(() => window.location.assign(destination), 600);
    } else {
      // Straight to /pos/home — not /pos. `/pos` is a render-time
      // redirect(), and reaching it through this client-side push desyncs
      // hydration under Turbopack + React 19 ("Rendered more hooks" in
      // Next's Router, blank screen right after a successful PIN).
      router.push(destination);
    }
  }

  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkCode, setLinkCode] = useState('');
  const [isLinking, setIsLinking] = useState(false);

  const promptBranchChange = () => {
    setLinkCode('');
    setLinkModalOpen(true);
  };

  const handleLinkTerminal = async () => {
    const code = linkCode.trim();
    if (!code) return;
    setIsLinking(true);
    try {
      const res = await fetch(`${API_URL}/api/pos/link?code=${encodeURIComponent(code)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          localStorage.setItem('pos_branch_id', data.branchId);
          setActiveBranchId(data.branchId);
          setActiveBranchName(data.branchName);
          setLinkModalOpen(false);
          toast.success(`Terminal linked to ${data.branchName}`);
        } else {
          toast.error('Invalid POS Code. Please try again.');
        }
      } else {
        toast.error('Invalid POS Code. Please try again.');
      }
    } catch {
      toast.error('Failed to verify POS Code. Check your connection.');
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <main className="flex flex-col lg:flex-row h-dvh w-full bg-canvas text-ink overflow-hidden font-body-md">
      {/* Link Terminal Modal */}
      {linkModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4">
          <div className="w-full max-w-[380px] bg-white border border-line rounded-2xl p-8 shadow-2xl">
            <h3 className="font-clash font-bold text-xl text-ink mb-2">Link Terminal</h3>
            <p className="text-ink-3 text-sm mb-6">Enter the POS Code displayed in your Dashboard to link this terminal to a branch.</p>
            <input
              type="text"
              autoFocus
              value={linkCode}
              onChange={(e) => setLinkCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleLinkTerminal()}
              placeholder="e.g. POS-A4BX"
              className="w-full bg-canvas border border-line-strong focus:border-brand rounded-xl px-4 py-3 text-ink text-[16px] font-mono tracking-widest placeholder:text-ink-4 outline-none transition-colors mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setLinkModalOpen(false)}
                className="flex-1 h-11 rounded-xl border border-line-strong text-ink-2 hover:text-ink hover:bg-sunken transition-all font-semibold"
              >Cancel</button>
              <button
                onClick={handleLinkTerminal}
                disabled={!linkCode.trim() || isLinking}
                className="flex-1 h-11 rounded-xl font-bold text-white disabled:opacity-50 transition-all shadow-sm"
                style={{ backgroundColor: 'var(--pos-primary, #F59E0B)', color: '#FFFFFF' }}
              >{isLinking ? 'Linking…' : 'Link Terminal'}</button>
            </div>
          </div>
        </div>
      )}

      {/* LEFT PANEL — Flush-Left Premium Branding & Info. Desktop-only
          (lg+): below that, a hard w-1/2 (both panels) meant the login flow's
          own w-1/2 column had to fit a PIN numpad that alone needs ~240px
          into ~180-215px. The compact header right after this section
          carries the one functional piece of this panel — branch name /
          change-branch tap target, shift-active badge, break banner — down
          to phone/tablet-portrait so nothing here is lost, just decorative
          content (clock, tagline, dot-grid) that doesn't fit is dropped. */}
      <section className="hidden lg:flex relative w-1/2 bg-canvas flex-col justify-between p-16 border-r border-line">
        <div className="absolute inset-0 amber-dot-grid pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, var(--pos-primary, #F59E0B) 1px, transparent 1px)', backgroundSize: '20px 20px', opacity: 0.05 }}></div>

        {/* Top: Flush Left Dineiz Logo (Light Variant) & Tagline */}
        <div className="relative z-10 animate-entrance-fade" style={{ animationDelay: '0.1s' }}>
          <DineizLogo size="xl" variant="light" showBadge={false} />
          <p className="text-[12px] text-ink-3 font-semibold tracking-[0.2em] mt-3 uppercase">
            Restaurant Intelligence Platform
          </p>
        </div>

        {/* Middle: Clock & Greet */}
        <div className="relative z-10 animate-entrance-up" style={{ animationDelay: '0.2s' }}>
          <div className="font-mono text-[64px] font-bold text-ink tracking-tighter leading-none mb-4">
            {timeStr}
          </div>
          <p className="text-[20px] font-semibold" style={{ color: 'var(--pos-primary, #F59E0B)' }}>
            {greeting}, {selectedStaff ? selectedStaff.name.split(' ')[0] : 'Team'}
          </p>

          {/* ON BREAK Banner */}
          {isBreakMode && (
            <div className="mt-5 flex items-center gap-3 bg-amber-50 border border-amber-300 rounded-2xl px-5 py-3.5 animate-fade-in">
              <span className="text-2xl">☕</span>
              <div>
                <p className="text-amber-700 font-black text-[13px] uppercase tracking-widest">Terminal On Break</p>
                <p className="text-amber-600 text-[12px] font-medium mt-0.5">
                  Away for <span className="font-bold">{breakElapsed}</span> · Log in to resume
                </p>
              </div>
              <span className="ml-auto w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            </div>
          )}
        </div>

        {/* Bottom: Status & Version */}
        <div className="relative z-10 animate-entrance-fade" style={{ animationDelay: '0.3s' }}>
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-[20px] font-semibold text-ink mb-2 flex flex-col cursor-pointer hover:text-slate-600 transition-colors" onClick={promptBranchChange} title="Click to change branch">
                <span className="flex items-center gap-2">
                  {activeBranchName}
                  <Pencil className="text-ink-3 w-[16px] h-[16px]" />
                </span>
                <span className="text-[12px] text-ink-3 font-semibold tracking-wide uppercase mt-1">Terminal Linked</span>
              </h2>
              {!isShiftLoading && (
                hasActiveShift ? (
                  <div className="inline-flex items-center gap-2 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-[12px] font-bold text-emerald-700 uppercase tracking-wider">Shift Active</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 bg-rose-50 px-3 py-1 rounded-full border border-rose-200">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    <span className="text-[12px] font-bold text-rose-700 uppercase tracking-wider">No Active Shift</span>
                  </div>
                )
              )}
              {offline && <OfflineChip className="ml-2" />}
            </div>
            {activeBranchId && (
              <div className="text-right text-[12px] text-ink-3 leading-relaxed font-medium font-mono" title={activeBranchId}>
                <p>Branch Ref: {activeBranchId.slice(-8).toUpperCase()}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Compact branding strip — lg:hidden counterpart to the panel above.
          Carries only what's functional (branch/change-branch, shift status,
          break banner) so it stays useful on a phone/tablet without pushing
          the actual login flow below the fold. */}
      <div className="lg:hidden shrink-0 bg-canvas border-b border-line px-4 pt-safe">
        <div className="flex items-center justify-between pt-3">
          <DineizLogo size="sm" variant="light" showBadge={false} />
          <div className="flex items-center gap-1.5">
            {offline && <OfflineChip compact />}
            {!isShiftLoading && (
              hasActiveShift ? (
                <div className="inline-flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Shift Active</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                  <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">No Shift</span>
                </div>
              )
            )}
          </div>
        </div>
        <button
          onClick={promptBranchChange}
          className="flex items-center gap-1.5 text-[13px] font-semibold text-ink py-2.5 -mx-1 px-1"
          title="Tap to change branch"
        >
          {activeBranchName}
          <Pencil className="text-ink-3 w-[14px] h-[14px]" />
        </button>
        {isBreakMode && (
          <div className="mb-3 flex items-center gap-2.5 bg-amber-50 border border-amber-300 rounded-xl px-3.5 py-2.5">
            <span className="text-lg">☕</span>
            <div className="min-w-0">
              <p className="text-amber-700 font-black text-[11px] uppercase tracking-widest">Terminal On Break</p>
              <p className="text-amber-600 text-[11px] font-medium truncate">Away for <span className="font-bold">{breakElapsed}</span></p>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT PANEL — POS Light Login Flow */}
      <section className="flex-1 min-h-0 w-full lg:w-1/2 bg-white flex items-center justify-center p-4 sm:p-8 lg:p-12 relative overflow-hidden">

        {/* Step 1: Role Selection */}
        <div className={`w-full max-w-[400px] space-y-8 transition-all duration-300 absolute ${!selectedRole && !selectedStaff ? 'opacity-100 scale-100 z-10' : 'opacity-0 scale-95 pointer-events-none -z-10'}`}>
          <header className="text-center space-y-2 mb-10">
            <h3 className="font-clash font-bold text-2xl text-ink">Select your role</h3>
            <p className="text-ink-3">Identify yourself to begin the shift</p>
            {offline && staffList.length > 0 && <OfflineNote />}
          </header>

          <div className="grid grid-cols-1 gap-3 max-h-[60dvh] overflow-y-auto pr-2 custom-scrollbar">
            {availableRoles.length === 0 && (
              <div className="text-center text-ink-3 py-8">
                {offline
                  ? 'No connection. This terminal needs to be online once to load its staff.'
                  : 'No roles configured for this branch.'}
              </div>
            )}

            {availableRoles.map((role) => (
              <button
                key={role.id}
                className="role-card group flex items-center justify-between h-[56px] px-6 bg-canvas border border-line rounded-xl hover:bg-sunken transition-all hover:border-brand relative overflow-hidden shrink-0 shadow-sm"
                onClick={() => setSelectedRole(role.id)}
              >
                <div className="flex items-center gap-4">
                  <role.Icon className="w-5 h-5 text-ink-3 group-hover:text-brand transition-colors" />
                  <span className="font-bold text-ink">{role.label}</span>
                </div>
                <ChevronRight className="text-ink-3 chevron transition-transform group-hover:translate-x-1 w-[20px] h-[20px]" />
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Staff Selection */}
        <div className={`w-full max-w-[400px] space-y-8 transition-all duration-300 absolute ${selectedRole && !selectedStaff ? 'opacity-100 scale-100 z-10' : 'opacity-0 scale-95 pointer-events-none -z-10'}`}>
          <header className="text-center space-y-3 mb-10">
            <button
              className="flex items-center gap-2 mx-auto text-ink-3 hover:text-brand transition-colors group"
              onClick={() => setSelectedRole(null)}
            >
              <ArrowLeft className="group-hover:-translate-x-1 transition-transform w-[16px] h-[16px]" />
              <span className="text-[12px] font-bold uppercase tracking-wider">Change Role</span>
            </button>
            <div>
              <h3 className="font-clash font-bold text-2xl text-ink">Select User</h3>
              <p className="text-ink-3">Choose your profile</p>
              {offline && <OfflineNote />}
            </div>
          </header>

          <div className="grid grid-cols-1 gap-3 max-h-[60dvh] overflow-y-auto pr-2 custom-scrollbar">
            {staffList.filter(s => s.role === selectedRole || (selectedRole === 'MANAGER' && s.role === 'BRANCH_MANAGER')).length === 0 && (
              <div className="text-center text-ink-3 py-8">No staff found for this role.</div>
            )}

            {staffList.filter(s => s.role === selectedRole || (selectedRole === 'MANAGER' && s.role === 'BRANCH_MANAGER')).map((staff) => {
              // Offline, only someone with a saved sign-in on this terminal
              // can get in. Saying so on the tile beats letting them type a
              // PIN that can't work.
              const needsConnection = offline && !canSignInOffline(staff.id, activeBranchId);
              return (
                <button
                  key={staff.id}
                  className={`role-card group flex items-center justify-between h-[56px] px-6 bg-canvas border border-line rounded-xl transition-all relative overflow-hidden shrink-0 shadow-sm ${needsConnection ? 'cursor-default' : 'hover:bg-sunken hover:border-brand'}`}
                  aria-disabled={needsConnection}
                  onClick={() => {
                    if (needsConnection) {
                      toast.info(`${staff.name.split(' ')[0]} hasn't signed in on this terminal recently, so the first sign-in needs a connection.`);
                      return;
                    }
                    setSelectedStaff(staff);
                  }}
                >
                  <div className={`flex items-center gap-4 min-w-0 ${needsConnection ? 'opacity-50' : ''}`}>
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm shrink-0"
                      style={{ backgroundColor: staff.avatarColor || 'var(--pos-primary, #F59E0B)' }}
                    >
                      {staff.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-bold text-ink truncate">{staff.name}</span>
                  </div>
                  {needsConnection ? (
                    <span className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-3 shrink-0">
                      <WifiOff className="w-3.5 h-3.5" />
                      Needs connection
                    </span>
                  ) : (
                    <ChevronRight className="text-ink-3 transition-transform group-hover:translate-x-1 group-hover:text-brand w-[20px] h-[20px] shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 3: PIN Entry Modal */}
        <div className={`w-full max-w-[320px] space-y-10 transition-all duration-300 absolute ${selectedStaff ? 'opacity-100 translate-y-0 z-20' : 'opacity-0 translate-y-8 pointer-events-none -z-10'}`}>
          {selectedStaff && (
            <>
              <header className="text-center space-y-3">
                <button
                  className="flex items-center gap-2 mx-auto text-ink-3 hover:text-brand transition-colors group"
                  onClick={() => {
                    setSelectedStaff(null);
                    setPin('');
                    setPinStatus('idle');
                  }}
                  disabled={lockoutTimer > 0 || pinStatus === 'loading'}
                >
                  <ArrowLeft className="group-hover:-translate-x-1 transition-transform w-[16px] h-[16px]" />
                  <span className="text-[12px] font-bold uppercase tracking-wider">Change User</span>
                </button>
                <div className="pt-2">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white mx-auto mb-3 shadow-md"
                    style={{ backgroundColor: selectedStaff.avatarColor || 'var(--pos-primary, #F59E0B)' }}
                  >
                    {selectedStaff.name.charAt(0).toUpperCase()}
                  </div>
                  <h3 className="font-clash font-bold text-2xl text-ink">{selectedStaff.name}</h3>
                  <p className="text-ink-3 mt-1 font-medium text-sm">
                    {lockoutTimer > 0
                      ? <span className="text-rose-600 font-bold">Locked out for {lockoutTimer}s</span>
                      : pinNote
                        ? <span className="text-rose-600 font-bold">{pinNote}</span>
                        : pinStatus === 'error'
                          ? <span className="text-rose-600 font-bold">Incorrect PIN</span>
                          : "Enter your security PIN"}
                  </p>
                </div>
              </header>

              {/* PIN Dots */}
              <div className={`flex justify-center gap-5 h-4 transition-transform ${shake ? 'shake' : ''}`}>
                {Array.from({ length: PIN_LENGTH }).map((_, i) => {
                  const isFilled = pin.length > i;
                  const isSuccess = pinStatus === 'success';
                  const isError = pinStatus === 'error';

                  let dotClass = 'bg-transparent border-line-strong';
                  let style = {};

                  if (isSuccess) {
                    dotClass = 'bg-ok border-ok scale-110';
                  } else if (isError) {
                    dotClass = 'bg-rose-500 border-rose-500';
                  } else if (isFilled) {
                    dotClass = 'border-transparent';
                    style = { backgroundColor: 'var(--pos-primary, #F59E0B)', borderColor: 'var(--pos-primary, #F59E0B)' };
                  }

                  return (
                    <div
                      key={i}
                      className={`w-3 h-3 rounded-full border-2 transition-all duration-200 ${dotClass}`}
                      style={style}
                    />
                  );
                })}
              </div>

              {/* Numpad */}
              <div className={`grid grid-cols-3 gap-3 transition-transform ${shake ? 'translate-x-2' : ''}`}>
                {NUMPAD_KEYS.map((key, idx) => {
                  if (key === 'backspace') {
                    return (
                      <button
                        key={idx}
                        onClick={() => handleKey(key)}
                        disabled={lockoutTimer > 0}
                        className="flex items-center justify-center h-[56px] w-[72px] mx-auto bg-canvas rounded-xl border border-line-strong hover:bg-hover active:scale-95 transition-all disabled:opacity-50 shadow-sm"
                      >
                        <Delete className="text-ink-2 w-[20px] h-[20px]" />
                      </button>
                    );
                  }
                  if (key === 'confirm') {
                    const isReady = pin.length === PIN_LENGTH;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleKey(key)}
                        disabled={!isReady || pinStatus === 'loading' || lockoutTimer > 0}
                        className={`flex items-center justify-center h-[56px] w-[72px] mx-auto rounded-xl border transition-all duration-300 active:scale-95 ${isReady && lockoutTimer === 0
                            ? 'text-white cursor-pointer shadow-md'
                            : 'bg-canvas border-line-strong opacity-50 cursor-not-allowed text-ink-4'
                          }`}
                        style={isReady && lockoutTimer === 0 ? { backgroundColor: 'var(--pos-primary, #F59E0B)', borderColor: 'var(--pos-primary, #F59E0B)', color: '#FFFFFF' } : {}}
                      >
                        {pinStatus === 'loading' ? (
                          <Loader2 className="animate-spin text-white w-[20px] h-[20px]" />
                        ) : (
                          <LogIn className="text-white w-[20px] h-[20px]" />
                        )}
                      </button>
                    );
                  }
                  return (
                    <button
                      key={idx}
                      onClick={() => handleKey(key)}
                      disabled={lockoutTimer > 0}
                      className="flex items-center justify-center h-[56px] w-[72px] mx-auto bg-canvas rounded-xl border border-line-strong hover:bg-hover active:scale-95 transition-all disabled:opacity-50 text-xl font-bold text-ink shadow-sm"
                    >
                      {key}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Decorative Icons */}
        <div className="absolute bottom-12 right-12 flex gap-5 opacity-20 pointer-events-none text-ink-3">
          {offline ? <WifiOff className="w-[36px] h-[36px]" /> : <Wifi className="w-[36px] h-[36px]" />}
          <BatteryCharging className="w-[36px] h-[36px]" />
        </div>

        {/* Custom scrollbar CSS */}
        <style dangerouslySetInnerHTML={{
          __html: `
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: #F8FAFC; border-radius: 4px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 4px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94A3B8; }
        `}} />
      </section>
    </main>
  );
}

function OfflineChip({ compact = false, className = '' }: { compact?: boolean; className?: string }) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 bg-sunken border border-line-strong rounded-full ${compact ? 'px-2.5 py-1' : 'px-3 py-1'} ${className}`}
      title="No connection to the server"
    >
      <WifiOff className={`text-ink-2 ${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'}`} />
      <span className={`font-bold text-ink-2 uppercase tracking-wider ${compact ? 'text-[10px]' : 'text-[12px]'}`}>Offline</span>
    </div>
  );
}

// Says what still works, in the words a cashier would use.
function OfflineNote() {
  return (
    <p className="mx-auto mt-3 max-w-[320px] flex items-start justify-center gap-2 text-[13px] leading-snug text-ink-2 bg-sunken border border-line rounded-xl px-3 py-2 text-left">
      <WifiOff className="w-4 h-4 mt-0.5 shrink-0 text-ink-3" />
      <span>No connection. Anyone who has signed in on this terminal this week can still sign in.</span>
    </p>
  );
}
