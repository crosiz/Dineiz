'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCartStore } from '@/lib/store';
import { toast } from 'sonner';
import { DineizLogo } from '@/components/ui/DineizLogo';
import { getPosBreak, clearPosBreak } from '@/lib/pos-session';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const PIN_LENGTH = 4;
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

  const availableRoles = useMemo(() => {
    const roles = new Set(staffList.map((s) => s.role));
    return Array.from(roles).map((roleId) => {
      let label = roleId.replace(/_/g, ' ');
      label = label.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

      let icon = 'account_circle';
      if (roleId === 'BRANCH_MANAGER' || roleId === 'MANAGER') icon = 'manage_accounts';
      else if (roleId === 'HEAD_CASHIER' || roleId === 'CASHIER') icon = 'payments';
      else if (roleId === 'KITCHEN_STAFF') icon = 'outdoor_grill';
      else if (roleId === 'RIDER' || roleId === 'DELIVERY') icon = 'delivery_dining';
      else if (roleId === 'WAITER') icon = 'restaurant';

      return { id: roleId, label, icon };
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

  // Fetch Staff and Shift status
  useEffect(() => {
    if (!activeBranchId) return;

    const fetchStaff = async () => {
      try {
        const res = await fetch(`${API_URL}/api/pos/staff?branchId=${activeBranchId}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data.staff) setStaffList(data.staff);
          if (data.branchName) setActiveBranchName(data.branchName);
        } else {
          setActiveBranchName('Branch Not Found');
        }
      } catch (e) {
        console.error('Failed to load staff', e);
        setActiveBranchName('Connection Error');
      }
    };

    const fetchShiftStatus = async () => {
      try {
        const res = await fetch(`${API_URL}/api/pos/shifts/active?branchId=${activeBranchId}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setHasActiveShift(!!data.hasActiveShift);
        }
      } catch (e) {
        console.error('Failed to fetch shift status', e);
      } finally {
        setIsShiftLoading(false);
      }
    };

    void fetchStaff();
    void fetchShiftStatus();
  }, [activeBranchId]);

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

      const res = await fetch(`${API_URL}/api/pos/auth/pin-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ staffId: selectedStaff.id, hashedPin, branchId: activeBranchId }),
      });

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

      const data = await res.json();
      const user = data.user;
      const branding = data.branding;
      const activeShift = data.activeShift;

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
        token: data.token,
      });

      const posSession = {
        userId: user.id,
        name: user.name,
        role: user.role,
        branchId: user.branchId,
        branchName: activeBranchName,
        tenantId: user.tenantId,
        avatarColor: user.avatarColor || '#F59E0B',
        token: data.token,
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
      };

      localStorage.setItem('pos_session', JSON.stringify(posSession));
      localStorage.setItem('pos_token', data.token);
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
      } else {
        const storedShiftStr = localStorage.getItem('pos_shift');
        if (storedShiftStr) {
          try {
            const shiftObj = JSON.parse(storedShiftStr);
            if (shiftObj.shiftId) {
              const shiftRes = await fetch(`${API_URL}/api/shifts/${shiftObj.shiftId}`, {
                headers: { 'Authorization': `Bearer ${data.token}` }
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
      if (posBreak?.shiftId) {
        try {
          const breakRes = await fetch(`${API_URL}/api/shifts/${posBreak.shiftId}/break/end`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${data.token}`, 'Content-Type': 'application/json' },
          });
          if (breakRes.ok) {
            const breakData = await breakRes.json();
            const mins = breakData.durationMinutes ?? 0;
            toast.success(`Welcome back! Break was ${mins} minute${mins !== 1 ? 's' : ''}.`, { duration: 4000 });
          }
          const { endBreak } = await import('@/lib/core/commands');
          endBreak(posBreak.shiftId).catch(() => {});
        } catch { /* non-fatal */ } finally {
          clearPosBreak();
        }
      }

      if (user.role === 'KITCHEN_STAFF') {
        router.push('/pos/kds');
      } else if (user.role === 'WAITER') {
        try {
          const tableRes = await fetch(`${API_URL}/api/tables/assigned?userId=${user.id}&branchId=${user.branchId}`, {
             headers: { Authorization: `Bearer ${data.token}` }
          });
          if (tableRes.ok) {
            const assignedData = await tableRes.json();
            localStorage.setItem('pos_assigned_tables', JSON.stringify(assignedData.assignedTableIds || []));
          }
        } catch(e) {
          console.error('Failed to fetch assigned tables', e);
        }
        router.push('/pos/tables');
      } else {
        router.push('/pos');
      }

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
    <main className="flex h-screen w-full bg-[#F8FAFC] text-[#0F172A] overflow-hidden font-body-md">
      {/* Link Terminal Modal */}
      {linkModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-8 w-[380px] shadow-2xl">
            <h3 className="font-clash font-bold text-xl text-[#0F172A] mb-2">Link Terminal</h3>
            <p className="text-[#64748B] text-sm mb-6">Enter the POS Code displayed in your Dashboard to link this terminal to a branch.</p>
            <input
              type="text"
              autoFocus
              value={linkCode}
              onChange={(e) => setLinkCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleLinkTerminal()}
              placeholder="e.g. POS-A4BX"
              className="w-full bg-[#F8FAFC] border border-[#CBD5E1] focus:border-[var(--pos-primary,#F59E0B)] rounded-xl px-4 py-3 text-[#0F172A] text-[15px] font-mono tracking-widest placeholder:text-[#94A3B8] outline-none transition-colors mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setLinkModalOpen(false)}
                className="flex-1 h-11 rounded-xl border border-[#CBD5E1] text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-all font-semibold"
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

      {/* LEFT PANEL — Flush-Left Premium Branding & Info */}
      <section className="relative w-1/2 bg-[#F8FAFC] flex flex-col justify-between p-16 border-r border-[#E2E8F0]">
        <div className="absolute inset-0 amber-dot-grid pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, var(--pos-primary, #F59E0B) 1px, transparent 1px)', backgroundSize: '20px 20px', opacity: 0.05 }}></div>

        {/* Top: Flush Left Dineiz Logo (Light Variant) & Tagline */}
        <div className="relative z-10 animate-entrance-fade" style={{ animationDelay: '0.1s' }}>
          <DineizLogo size="xl" variant="light" showBadge={false} />
          <p className="text-[12px] text-[#64748B] font-semibold tracking-[0.2em] mt-3 uppercase">
            Restaurant Intelligence Platform
          </p>
        </div>

        {/* Middle: Clock & Greet */}
        <div className="relative z-10 animate-entrance-up" style={{ animationDelay: '0.2s' }}>
          <div className="font-mono text-[64px] font-bold text-[#0F172A] tracking-tighter leading-none mb-4">
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
              <h2 className="text-[20px] font-semibold text-[#0F172A] mb-2 flex flex-col cursor-pointer hover:text-slate-600 transition-colors" onClick={promptBranchChange} title="Click to change branch">
                <span className="flex items-center gap-2">
                  {activeBranchName}
                  <span className="material-symbols-outlined text-[16px] text-[#64748B]">edit</span>
                </span>
                <span className="text-[12px] text-[#64748B] font-semibold tracking-wide uppercase mt-1">Terminal Linked</span>
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
            </div>
            {activeBranchId && (
              <div className="text-right text-[12px] text-[#64748B] leading-relaxed font-medium font-mono" title={activeBranchId}>
                <p>Branch Ref: {activeBranchId.slice(-8).toUpperCase()}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* RIGHT PANEL — POS Light Login Flow */}
      <section className="w-1/2 bg-white flex items-center justify-center p-12 relative overflow-hidden">

        {/* Step 1: Role Selection */}
        <div className={`w-full max-w-[400px] space-y-8 transition-all duration-300 absolute ${!selectedRole && !selectedStaff ? 'opacity-100 scale-100 z-10' : 'opacity-0 scale-95 pointer-events-none -z-10'}`}>
          <header className="text-center space-y-2 mb-10">
            <h3 className="font-clash font-bold text-2xl text-[#0F172A]">Select your role</h3>
            <p className="text-[#64748B]">Identify yourself to begin the shift</p>
          </header>

          <div className="grid grid-cols-1 gap-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            {availableRoles.length === 0 && (
              <div className="text-center text-[#64748B] py-8">No roles configured for this branch.</div>
            )}

            {availableRoles.map((role) => (
              <button
                key={role.id}
                className="role-card group flex items-center justify-between h-[56px] px-6 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl hover:bg-[#F1F5F9] transition-all hover:border-[var(--pos-primary,#F59E0B)] relative overflow-hidden shrink-0 shadow-sm"
                onClick={() => setSelectedRole(role.id)}
              >
                <div className="flex items-center gap-4">
                  <span className="material-symbols-outlined text-[#64748B] group-hover:text-[var(--pos-primary,#F59E0B)] transition-colors">{role.icon}</span>
                  <span className="font-bold text-[#0F172A]">{role.label}</span>
                </div>
                <span className="material-symbols-outlined text-[#64748B] chevron transition-transform group-hover:translate-x-1">chevron_right</span>
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Staff Selection */}
        <div className={`w-full max-w-[400px] space-y-8 transition-all duration-300 absolute ${selectedRole && !selectedStaff ? 'opacity-100 scale-100 z-10' : 'opacity-0 scale-95 pointer-events-none -z-10'}`}>
          <header className="text-center space-y-3 mb-10">
            <button
              className="flex items-center gap-2 mx-auto text-[#64748B] hover:text-[var(--pos-primary,#F59E0B)] transition-colors group"
              onClick={() => setSelectedRole(null)}
            >
              <span className="material-symbols-outlined text-[16px] group-hover:-translate-x-1 transition-transform">arrow_back</span>
              <span className="text-[12px] font-bold uppercase tracking-wider">Change Role</span>
            </button>
            <div>
              <h3 className="font-clash font-bold text-2xl text-[#0F172A]">Select User</h3>
              <p className="text-[#64748B]">Choose your profile</p>
            </div>
          </header>

          <div className="grid grid-cols-1 gap-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            {staffList.filter(s => s.role === selectedRole || (selectedRole === 'MANAGER' && s.role === 'BRANCH_MANAGER')).length === 0 && (
              <div className="text-center text-[#64748B] py-8">No staff found for this role.</div>
            )}

            {staffList.filter(s => s.role === selectedRole || (selectedRole === 'MANAGER' && s.role === 'BRANCH_MANAGER')).map((staff) => (
              <button
                key={staff.id}
                className="role-card group flex items-center justify-between h-[56px] px-6 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl hover:bg-[#F1F5F9] transition-all hover:border-[var(--pos-primary,#F59E0B)] relative overflow-hidden shrink-0 shadow-sm"
                onClick={() => setSelectedStaff(staff)}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm"
                    style={{ backgroundColor: staff.avatarColor || 'var(--pos-primary, #F59E0B)' }}
                  >
                    {staff.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-bold text-[#0F172A] group-hover:text-[#0F172A] transition-colors">{staff.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[#64748B] transition-transform group-hover:translate-x-1 group-hover:text-[var(--pos-primary,#F59E0B)]">chevron_right</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Step 3: PIN Entry Modal */}
        <div className={`w-full max-w-[320px] space-y-10 transition-all duration-300 absolute ${selectedStaff ? 'opacity-100 translate-y-0 z-20' : 'opacity-0 translate-y-8 pointer-events-none -z-10'}`}>
          {selectedStaff && (
            <>
              <header className="text-center space-y-3">
                <button
                  className="flex items-center gap-2 mx-auto text-[#64748B] hover:text-[var(--pos-primary,#F59E0B)] transition-colors group"
                  onClick={() => {
                    setSelectedStaff(null);
                    setPin('');
                    setPinStatus('idle');
                  }}
                  disabled={lockoutTimer > 0 || pinStatus === 'loading'}
                >
                  <span className="material-symbols-outlined text-[16px] group-hover:-translate-x-1 transition-transform">arrow_back</span>
                  <span className="text-[12px] font-bold uppercase tracking-wider">Change User</span>
                </button>
                <div className="pt-2">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white mx-auto mb-3 shadow-md"
                    style={{ backgroundColor: selectedStaff.avatarColor || 'var(--pos-primary, #F59E0B)' }}
                  >
                    {selectedStaff.name.charAt(0).toUpperCase()}
                  </div>
                  <h3 className="font-clash font-bold text-2xl text-[#0F172A]">{selectedStaff.name}</h3>
                  <p className="text-[#64748B] mt-1 font-medium text-sm">
                    {lockoutTimer > 0
                      ? <span className="text-rose-600 font-bold">Locked out for {lockoutTimer}s</span>
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

                  let dotClass = 'bg-transparent border-[#CBD5E1]';
                  let style = {};

                  if (isSuccess) {
                    dotClass = 'bg-[#10B981] border-[#10B981] scale-110';
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
                        className="flex items-center justify-center h-[56px] w-[72px] mx-auto bg-[#F8FAFC] rounded-xl border border-[#CBD5E1] hover:bg-[#E2E8F0] active:scale-95 transition-all disabled:opacity-50 shadow-sm"
                      >
                        <span className="material-symbols-outlined text-[#475569]">backspace</span>
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
                            : 'bg-[#F8FAFC] border-[#CBD5E1] opacity-50 cursor-not-allowed text-[#94A3B8]'
                          }`}
                        style={isReady && lockoutTimer === 0 ? { backgroundColor: 'var(--pos-primary, #F59E0B)', borderColor: 'var(--pos-primary, #F59E0B)', color: '#FFFFFF' } : {}}
                      >
                        {pinStatus === 'loading' ? (
                          <span className="material-symbols-outlined animate-spin text-white">progress_activity</span>
                        ) : (
                          <span className="material-symbols-outlined text-white">login</span>
                        )}
                      </button>
                    );
                  }
                  return (
                    <button
                      key={idx}
                      onClick={() => handleKey(key)}
                      disabled={lockoutTimer > 0}
                      className="flex items-center justify-center h-[56px] w-[72px] mx-auto bg-[#F8FAFC] rounded-xl border border-[#CBD5E1] hover:bg-[#E2E8F0] active:scale-95 transition-all disabled:opacity-50 text-xl font-bold text-[#0F172A] shadow-sm"
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
        <div className="absolute bottom-12 right-12 flex gap-5 opacity-20 pointer-events-none text-[#64748B]">
          <span className="material-symbols-outlined text-4xl">wifi</span>
          <span className="material-symbols-outlined text-4xl">battery_charging_full</span>
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
