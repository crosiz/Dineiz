'use client';

import React, { useContext, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { TopBarStateContext } from '../contexts/TopBarContext';
import { useCartStore } from '@/lib/store';
import { getPosSession, getPosShift, getToken, clearPosSession, setPosBreak, resolveActiveShiftId } from '@/lib/pos-session';
import { getDB } from '@/lib/db';
import { v4 as uuid } from 'uuid';
import { toast } from 'sonner';
import { CloseShiftModal } from '@/components/CloseShiftModal';
import { CashDrawerModal } from '@/components/CashDrawerModal';
import { ShiftCloseBlockerModal } from '@/components/ShiftCloseBlockerModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { AdminPinModal } from '@/components/AdminPinModal';
import { DineizLogo } from './ui/DineizLogo';
import { Maximize2, Minimize2, Clock, Coffee, LogOut, ArrowLeft, Wallet, RefreshCw, ShieldAlert, Settings, Unlock, ShoppingBag } from 'lucide-react';
import { StartManagerOverrideModal } from '@/components/StartManagerOverrideModal';
import { SyncHealthDot } from '@/components/SyncHealthDot';
import { useManagerOverlay } from '@/lib/manager-overlay';
import { hasUnsyncedEvents, getUnsyncedSummary, kickOutbox, type UnsyncedSummary } from '@/lib/core/outbox';
import { startBreak } from '@/lib/core/commands';
import { saveCartDraft, type CartDraft } from '@/lib/core/drafts';

export function POSTopBar() {
  const config = useContext(TopBarStateContext);
  const router = useRouter();
  const session = useCartStore((s) => s.session);
  const [clockStr, setClockStr] = useState('00:00:00');
  const [isOnline, setIsOnline] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Profile Dropdown State
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [shiftDuration, setShiftDuration] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Modals State
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [showTakeBreakConfirm, setShowTakeBreakConfirm] = useState(false);
  const [isCloseShiftOpen, setIsCloseShiftOpen] = useState(false);
  const [isCashDrawerOpen, setIsCashDrawerOpen] = useState(false);
  const [showManagerOverride, setShowManagerOverride] = useState(false);
  const overlayActive = useManagerOverlay((s) => !!s.overlay);
  const exitOverlay = useManagerOverlay((s) => s.exit);
  const [pendingBackConfirm, setPendingBackConfirm] = useState(false);
  const [isBlockerOpen, setIsBlockerOpen] = useState(false);
  const [blockers, setBlockers] = useState<any[]>([]);

  // Spec Part 11 — signing out with items still in the cart builder (never
  // sent to the kitchen, so nothing durable exists for them) prompts
  // Hold It / Discard / Cancel before the session actually ends.
  const [showCartWarning, setShowCartWarning] = useState(false);
  const [holdBusy, setHoldBusy] = useState(false);

  // Sign-out sync guard — blocks signing out while this terminal still has
  // events queued for the server, instead of silently abandoning them.
  const [signOutSyncing, setSignOutSyncing] = useState(false);
  const [unsyncedInfo, setUnsyncedInfo] = useState<UnsyncedSummary | null>(null);
  const [showForcePin, setShowForcePin] = useState(false);
  const signOutPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Captured once when the sync-wait modal opens so the progress bar has a
  // fixed denominator to shrink towards — unsyncedInfo.count itself keeps
  // changing every poll tick.
  const signOutInitialCountRef = useRef(0);

  useEffect(() => {
    setIsMounted(true);
    // Sync fullscreen state on external exit (e.g. Esc key)
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const handleCloseShiftClick = async () => {
    setIsDropdownOpen(false);

    if (!session.branchId || !session.shiftId) {
      setIsCloseShiftOpen(true);
      return;
    }

    // Open immediately — CloseShiftModal has its own "Calculating totals…"
    // loading state, so the cashier sees feedback the instant they tap
    // instead of a frozen menu while this validation call is in flight
    // (previously this fetch had to resolve, cold Neon connection and all,
    // before the modal appeared at all). The can-close check still runs, in
    // the background — if it turns out the shift is blocked, swap to the
    // blocker modal instead.
    setIsCloseShiftOpen(true);

    try {
      const token = localStorage.getItem('pos_token');
      // Every other POS call falls back to :3001; this one said :8080, so on a
      // dev machine without NEXT_PUBLIC_API_URL set the close-shift guard
      // silently failed its check.
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/shifts/can-close?shiftId=${session.shiftId}&branchId=${session.branchId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Validation check failed');
      const data = await res.json();

      if (!data.canClose) {
        setIsCloseShiftOpen(false);
        setBlockers(data.blockers || []);
        setIsBlockerOpen(true);
      }
    } catch (e) {
      console.warn('Shift close validation error', e);
      toast.error('Could not validate shift status. Please try again.');
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => { });
    } else {
      document.exitFullscreen().catch(() => { });
    }
  };

  // Live clock
  useEffect(() => {
    const updateTime = () => setClockStr(new Date().toTimeString().split(' ')[0]);
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Shift duration
  useEffect(() => {
    if (!isMounted) return;
    const shiftObj = getPosShift();
    if (!shiftObj?.openedAt) return;

    const updateDuration = () => {
      const ms = Date.now() - new Date(shiftObj.openedAt).getTime();
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      setShiftDuration(`${h}h ${m}m`);
    };

    updateDuration();
    const interval = setInterval(updateDuration, 60000);
    return () => clearInterval(interval);
  }, [isMounted]);

  // Click-away listener for dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  // Basic online/offline check
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOnline(navigator.onLine);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const finishSignOut = () => {
    if (signOutPollRef.current) { clearInterval(signOutPollRef.current); signOutPollRef.current = null; }
    clearPosSession();
    useCartStore.getState().clearSession();
    useCartStore.getState().clearCart();
    toast.success('Signed out successfully');
    window.location.href = '/login';
  };

  // Terminal-owned outbox: events queued here (lib/core/outbox.ts) survive
  // in IndexedDB regardless of who's signed in, and the next session on
  // this terminal resumes shipping them. But signing out unmounts POSLayout
  // — which stops the drain loop — so anything still queued at that moment
  // would sit idle until someone logs back in here. Rather than silently
  // abandon it, block the sign-out and show what's still in flight.
  const handleSignOut = async () => {
    // Spec Part 11 — an unfinished cart isn't durable anywhere (it only
    // becomes an event once sent to the kitchen). Never let it vanish on
    // sign-out: offer Hold It / Discard / Cancel first.
    if (useCartStore.getState().cart.length > 0) {
      setShowSignOutConfirm(false);
      setShowCartWarning(true);
      return;
    }
    await continueSignOut();
  };

  // Persists the in-builder cart to the same `heldOrders` store the order
  // screen's "Hold" button writes to, so it reappears under Tickets → On Hold.
  const holdCurrentCart = async () => {
    const c = useCartStore.getState();
    if (c.cart.length === 0) return;
    const heldOrder = {
      id: uuid(),
      tableId: c.selectedTableId,
      tableLabel: c.selectedTableLabel,
      orderType: c.orderType || 'DINE_IN',
      guests: '1',
      cashierId: c.session?.cashierId ?? getPosSession()?.userId ?? null,
      cart: c.cart,
      heldAt: new Date().toISOString(),
    };
    try {
      const db = getDB();
      if (db.heldOrders) await db.heldOrders.put(heldOrder);
      if (navigator.onLine && getToken()) {
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/orders/held`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify(heldOrder),
        }).catch(() => { /* saved locally is enough */ });
      }
    } catch {
      /* local storage unavailable — fall through, the cart is still cleared */
    }
  };

  const holdCartThenSignOut = async () => {
    setHoldBusy(true);
    await holdCurrentCart();
    useCartStore.getState().clearCart();
    setHoldBusy(false);
    setShowCartWarning(false);
    toast.success('Order held. Find it in Tickets → On Hold');
    await continueSignOut();
  };

  const discardCartThenSignOut = async () => {
    useCartStore.getState().clearCart();
    setShowCartWarning(false);
    await continueSignOut();
  };

  const continueSignOut = async () => {
    const pending = await hasUnsyncedEvents();
    if (!pending) {
      finishSignOut();
      return;
    }

    setShowSignOutConfirm(false);
    const summary = await getUnsyncedSummary();
    signOutInitialCountRef.current = summary.count;
    setUnsyncedInfo(summary);
    setSignOutSyncing(true);
    // blockedOnAuthOnly events wait on a fresh login token, not on network
    // retries — kicking the outbox won't move them, so don't bother.
    if (!summary.blockedOnAuthOnly) kickOutbox();

    signOutPollRef.current = setInterval(async () => {
      const stillPending = await hasUnsyncedEvents();
      if (!stillPending) {
        setSignOutSyncing(false);
        finishSignOut();
        return;
      }
      const latest = await getUnsyncedSummary();
      setUnsyncedInfo(latest);
    }, 1500);
  };

  const cancelSignOutWait = () => {
    if (signOutPollRef.current) { clearInterval(signOutPollRef.current); signOutPollRef.current = null; }
    setSignOutSyncing(false);
  };

  useEffect(() => {
    return () => {
      if (signOutPollRef.current) clearInterval(signOutPollRef.current);
    };
  }, []);

  // Avatar — match login screen style
  const posSession = isMounted ? getPosSession() : null;
  const avatarColor = isMounted ? (posSession?.avatarColor || 'var(--pos-primary, #F59E0B)') : 'var(--pos-primary, #F59E0B)';
  const avatarInitial = isMounted && session.cashierName
    ? session.cashierName.charAt(0).toUpperCase()
    : 'O';
  const avatarTitle = isMounted ? (session.cashierName || 'Operator') : 'Operator';
  const cashierRole = posSession?.role?.replace(/_/g, ' ') || 'CASHIER';

  let roleBadgeStyle = 'bg-[#E2E8F0] text-[#475569]'; // default gray for Cashier
  if (posSession?.role === 'WAITER') roleBadgeStyle = 'bg-blue-100 text-blue-700';
  else if (posSession?.role === 'BRANCH_MANAGER' || posSession?.role === 'TENANT_ADMIN') {
    roleBadgeStyle = 'bg-[var(--pos-primary,#F59E0B)] text-white';
  }

  return (
    <>
      <header className="flex items-center justify-between whitespace-nowrap border-b border-[#E2E8F0] bg-white px-6 py-3 shrink-0 h-[72px] sticky top-0 z-40 shadow-sm">

        {/* Left Slot: Logo & Titles */}
        <div className="flex items-center gap-3.5 text-[#0F172A] min-w-[280px]">
          {config.showBackButton && config.backPath && (
            <button
              onClick={() => {
                const pathname = window.location.pathname;
                const cart = useCartStore.getState().cart;
                if (pathname.startsWith('/pos/order') && cart.length > 0) {
                  setPendingBackConfirm(true);
                } else {
                  router.push(config.backPath!);
                }
              }}
              className="px-2.5 py-1.5 rounded-xl bg-[#F1F5F9] border border-[#CBD5E1] text-[#334155] font-medium text-[13px] flex items-center gap-1.5 hover:text-[#0F172A] hover:bg-[#E2E8F0] transition-all active:scale-95 shadow-sm"
            >
              <ArrowLeft size={15} />
              Back
            </button>
          )}

          <DineizLogo
            size="md"
            variant="light"
            onClick={() => router.push('/pos/home')}
          />

          {(config.pageTitle || config.breadcrumb) && (
            <div className="flex items-center gap-3 pl-2 border-l border-[#E2E8F0]">
              <div>
                {config.pageTitle && <h2 className="clash-display text-lg font-bold leading-tight tracking-[-0.015em] text-[#0F172A]">{config.pageTitle}</h2>}
                {config.breadcrumb && <div className="text-[10px] text-[#64748B] uppercase tracking-widest leading-none font-semibold">{config.breadcrumb}</div>}
              </div>
            </div>
          )}
        </div>

        {/* Center Slot: Dynamic Tools */}
        <div className="flex-1 flex justify-center px-4">
          {config.centerSlot}
        </div>

        {/* Right Slot: Actions + Permanent Info */}
        <div className="flex items-center justify-end gap-4 min-w-[300px]">
          {/* Dynamic Actions */}
          {config.rightActions}

          {/* Separator if rightActions exist */}
          {config.rightActions && <div className="w-[1px] h-6 bg-[#CBD5E1] mx-2"></div>}

          {/* Permanent Info — deliberately minimal: only surface the
              exception (offline), not the default (online); the clock is
              plain text, not a bordered widget; fullscreen and identity
              details live one tap away in the avatar menu instead of
              sitting in the bar permanently. */}
          <div className="flex items-center gap-4">
            {!isOnline && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 pulse-red"></span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Offline</span>
              </div>
            )}

            {isMounted && <SyncHealthDot />}

            <span className="hidden md:inline font-mono text-[13px] font-semibold text-[#64748B] tabular-nums">{clockStr}</span>

            <div className="relative" ref={dropdownRef}>
              <button
                data-testid="avatar-menu"
                className="w-8.5 h-8.5 rounded-full flex items-center justify-center font-bold text-[13px] text-white shrink-0 hover:opacity-90 active:scale-95 transition-all shadow-xs"
                style={{ backgroundColor: avatarColor }}
                title={avatarTitle}
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                suppressHydrationWarning
              >
                {avatarInitial}
              </button>
              
              {/* Profile Dropdown Popover */}
              {isDropdownOpen && (
                <div className="absolute top-11 right-0 w-64 bg-white border border-slate-200/90 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 z-50">
                  {/* User Info Header */}
                  <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-200/80">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-slate-900 text-sm truncate">{avatarTitle}</p>
                      <span className="text-[10px] font-mono font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-700 shrink-0">
                        {cashierRole}
                      </span>
                    </div>
                    
                    {/* Active Shift Row */}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200/60 text-xs">
                      <span className="text-slate-500 font-medium">Shift Duration</span>
                      <span className="font-mono font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded text-[11px] tabular-nums">
                        {shiftDuration || 'Active'}
                      </span>
                    </div>
                  </div>

                  {/* Menu Actions */}
                  <div className="p-1.5 flex flex-col gap-0.5">
                    <button
                      className="w-full px-3 py-2 rounded-lg flex items-center gap-2.5 text-left text-slate-700 hover:text-slate-900 hover:bg-slate-100/80 active:bg-slate-200/70 transition-colors text-xs font-semibold"
                      onClick={() => { setIsDropdownOpen(false); toggleFullscreen(); }}
                    >
                      {isFullscreen ? <Minimize2 size={15} className="text-slate-500" /> : <Maximize2 size={15} className="text-slate-500" />}
                      <span>{isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}</span>
                    </button>

                    <button
                      className="w-full px-3 py-2 rounded-lg flex items-center gap-2.5 text-left text-slate-700 hover:text-slate-900 hover:bg-slate-100/80 active:bg-slate-200/70 transition-colors text-xs font-semibold"
                      onClick={() => { setIsDropdownOpen(false); setIsCashDrawerOpen(true); }}
                    >
                      <Wallet size={15} className="text-slate-500" />
                      <span>Cash Drawer</span>
                    </button>

                    <button
                      className="w-full px-3 py-2 rounded-lg flex items-center gap-2.5 text-left text-slate-700 hover:text-slate-900 hover:bg-slate-100/80 active:bg-slate-200/70 transition-colors text-xs font-semibold"
                      onClick={() => { setIsDropdownOpen(false); router.push('/pos/settings'); }}
                    >
                      <Settings size={15} className="text-slate-500" />
                      <span>Settings</span>
                    </button>

                    <button
                      className={`w-full px-3 py-2 rounded-lg flex items-center gap-2.5 text-left transition-colors text-xs font-semibold ${overlayActive ? 'text-amber-700 hover:bg-amber-50' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100/80 active:bg-slate-200/70'}`}
                      onClick={() => {
                        setIsDropdownOpen(false);
                        if (overlayActive) exitOverlay('MANUAL');
                        else setShowManagerOverride(true);
                      }}
                    >
                      <Unlock size={15} className={overlayActive ? 'text-amber-600' : 'text-slate-500'} />
                      <span>{overlayActive ? 'Exit Manager Mode' : 'Manager Override'}</span>
                    </button>

                    <button
                      className="w-full px-3 py-2 rounded-lg flex items-center gap-2.5 text-left text-slate-700 hover:text-slate-900 hover:bg-slate-100/80 active:bg-slate-200/70 transition-colors text-xs font-semibold"
                      onClick={handleCloseShiftClick}
                    >
                      <Clock size={15} className="text-slate-500" />
                      <span>Close Shift</span>
                    </button>

                    <button
                      className="w-full px-3 py-2 rounded-lg flex items-center gap-2.5 text-left text-slate-700 hover:text-slate-900 hover:bg-slate-100/80 active:bg-slate-200/70 transition-colors text-xs font-semibold"
                      onClick={() => {
                        setIsDropdownOpen(false);
                        setShowTakeBreakConfirm(true);
                      }}
                    >
                      <Coffee size={15} className="text-slate-500" />
                      <span>Take a Break</span>
                    </button>

                    <div className="h-[1px] bg-slate-200/80 my-1 mx-1.5" />

                    <button
                      className="w-full px-3 py-2 rounded-lg flex items-center gap-2.5 text-left text-rose-600 hover:text-rose-700 hover:bg-rose-50 active:bg-rose-100/80 transition-colors text-xs font-semibold"
                      onClick={() => {
                        setIsDropdownOpen(false);
                        setShowSignOutConfirm(true);
                      }}
                    >
                      <LogOut size={15} className="text-rose-500" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Sign out confirm modal */}
      {showSignOutConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-[360px] bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <LogOut size={20} />
            </div>
            
            <h3 className="font-bold text-slate-900 text-base mb-1">Sign Out of POS?</h3>
            <p className="text-slate-500 text-xs leading-relaxed mb-6">
              Your session will be closed, but your <strong className="text-[var(--pos-primary,#F59E0B)]">shift will remain active</strong> for when you return.
            </p>

            <div className="flex gap-2.5 w-full">
              <button
                onClick={() => setShowSignOutConfirm(false)}
                className="flex-1 h-10 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSignOut}
                className="flex-1 h-10 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Spec Part 11 — unfinished cart on sign-out. Hold It / Discard / Cancel. */}
      {showCartWarning && (
        <div className="fixed inset-0 z-[205] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-[380px] bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center mb-4">
              <ShoppingBag size={20} />
            </div>

            <h3 className="font-bold text-slate-900 text-base mb-1">You have an unfinished order</h3>
            <p className="text-slate-500 text-xs leading-relaxed mb-6">
              There {useCartStore.getState().cart.length === 1 ? 'is' : 'are'}{' '}
              <strong className="text-slate-700">
                {useCartStore.getState().cart.length} item{useCartStore.getState().cart.length === 1 ? '' : 's'}
              </strong>{' '}
              in the cart that {useCartStore.getState().cart.length === 1 ? 'hasn’t' : 'haven’t'} been sent to the
              kitchen. Signing out now will lose {useCartStore.getState().cart.length === 1 ? 'it' : 'them'} unless you hold the order.
            </p>

            <div className="flex flex-col gap-2 w-full">
              <button
                onClick={holdCartThenSignOut}
                disabled={holdBusy}
                className="w-full h-10 rounded-xl bg-[var(--pos-primary,#F59E0B)] hover:brightness-105 text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                {holdBusy ? <RefreshCw size={13} className="animate-spin" /> : <ShoppingBag size={13} />}
                Hold It &amp; Sign Out
              </button>
              <div className="flex gap-2.5 w-full">
                <button
                  onClick={() => setShowCartWarning(false)}
                  className="flex-1 h-10 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={discardCartThenSignOut}
                  className="flex-1 h-10 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 text-xs font-semibold transition-colors"
                >
                  Discard &amp; Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Blocks sign-out while unsynced events are still in flight. When
          every one of them is stuck purely on an expired session token
          (blockedOnAuthOnly), waiting longer is never going to help — the
          only fix is a fresh login, which is exactly what signing out and
          back in does, so that's offered directly instead of demanding a
          manager PIN for something that isn't actually an override. */}
      {signOutSyncing && unsyncedInfo?.blockedOnAuthOnly && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-[380px] bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center mb-4">
              <Clock size={20} />
            </div>

            <h3 className="font-bold text-slate-900 text-base mb-1">Session Expired</h3>
            <p className="text-slate-500 text-xs leading-relaxed mb-6">
              This terminal has <strong className="text-slate-700">{unsyncedInfo.count} change{unsyncedInfo.count === 1 ? '' : 's'}</strong> saved
              locally that couldn't reach the server because this session timed out. They're safe and will sync
              automatically the next time anyone signs in here — go ahead and sign out.
            </p>

            <div className="flex gap-2.5 w-full">
              <button
                onClick={cancelSignOutWait}
                className="flex-1 h-10 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors"
              >
                Stay Signed In
              </button>
              <button
                onClick={() => { setSignOutSyncing(false); finishSignOut(); }}
                className="flex-1 h-10 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {signOutSyncing && unsyncedInfo && !unsyncedInfo.blockedOnAuthOnly && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-[380px] bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center mb-4">
              <RefreshCw size={20} className="animate-spin" style={{ animationDuration: '1.5s' }} />
            </div>

            <h3 className="font-bold text-slate-900 text-base mb-1">Finishing Sync…</h3>
            <p className="text-slate-500 text-xs leading-relaxed mb-3">
              This terminal has <strong className="text-slate-700">{unsyncedInfo.count} change{unsyncedInfo.count === 1 ? '' : 's'}</strong> still
              being sent to the server. Signing out now would leave them queued until someone logs back in here.
              {unsyncedInfo.poisoned > 0 && (
                <span className="block mt-2 text-rose-600 font-semibold">
                  {unsyncedInfo.poisoned} of these were rejected by the server and need a manager to review them.
                </span>
              )}
            </p>

            <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden mb-4">
              <div
                className="h-full bg-[var(--pos-primary,#F59E0B)] transition-all duration-500 ease-out"
                style={{
                  width: `${Math.max(0, Math.min(100, Math.round((1 - (unsyncedInfo?.count ?? 0) / Math.max(signOutInitialCountRef.current, 1)) * 100)))}%`,
                }}
              />
            </div>

            <div className="flex gap-2.5 w-full mb-2">
              <button
                onClick={cancelSignOutWait}
                className="flex-1 h-10 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors"
              >
                Keep Working
              </button>
              <button
                onClick={() => kickOutbox()}
                className="flex-1 h-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
              >
                <RefreshCw size={13} /> Retry Now
              </button>
            </div>

            <button
              onClick={() => setShowForcePin(true)}
              className="w-full h-9 rounded-xl bg-transparent text-rose-600 hover:bg-rose-50 text-[11px] font-semibold transition-colors flex items-center justify-center gap-1.5"
            >
              <ShieldAlert size={13} /> Force Sign Out (Manager PIN)
            </button>
          </div>
        </div>
      )}

      {showForcePin && (
        <AdminPinModal
          onClose={() => setShowForcePin(false)}
          onSuccess={() => {
            setShowForcePin(false);
            setSignOutSyncing(false);
            finishSignOut();
          }}
        />
      )}

      {showManagerOverride && (
        <StartManagerOverrideModal onClose={() => setShowManagerOverride(false)} />
      )}

      {/* Take Break confirm modal */}
      {showTakeBreakConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-[360px] bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center mb-4">
              <Coffee size={20} />
            </div>
            
            <h2 className="font-bold text-slate-900 text-base mb-1">Take a Break?</h2>
            <p className="text-slate-500 text-xs leading-relaxed mb-6">
              You'll be locked out temporarily. Your shift stays active and all orders continue.
            </p>

            <div className="flex gap-2.5 w-full">
              <button
                onClick={() => setShowTakeBreakConfirm(false)}
                className="flex-1 h-10 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  // Two bugs used to make this record nothing while still
                  // locking the screen, so a cashier's break simply vanished:
                  // (1) fetch() with a Content-Type: application/json header
                  // but no body — Fastify rejects that as a malformed request
                  // before the route handler ever runs; (2) getPosShift() can
                  // be stale (the inactivity sweeper can auto-close a shift
                  // server-side with no client-side signal), so the call
                  // targeted a shift that was no longer OPEN. Both are wrapped
                  // in a bare try/catch below, so neither ever surfaced.
                  const sessionObj = getPosSession();
                  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
                  const shiftId = await resolveActiveShiftId(API_URL);

                  if (!shiftId) {
                    toast.error('No open shift found — it may have been closed automatically. Open a new shift to continue.');
                    setShowTakeBreakConfirm(false);
                    return;
                  }

                  // Any items sitting in the cart builder aren't durable
                  // anywhere yet (they only become an event once sent to the
                  // kitchen) — save them as a draft so the order screen can
                  // offer to restore it once this cashier's back.
                  const cart = useCartStore.getState();
                  if (cart.cart.length > 0) {
                    const draft: CartDraft = {
                      cart: cart.cart,
                      orderType: cart.orderType ?? null,
                      selectedTableId: cart.selectedTableId ?? null,
                      selectedTableLabel: cart.selectedTableLabel ?? null,
                      customerId: cart.customerId ?? null,
                      customerName: cart.customerName ?? null,
                      notes: null,
                      reason: 'break',
                    };
                    saveCartDraft(draft).catch(console.error);
                  }

                  try {
                    const res = await fetch(`${API_URL}/api/shifts/${shiftId}/break/start`, {
                      method: 'POST',
                      headers: { 'Authorization': `Bearer ${sessionObj?.token}`, 'Content-Type': 'application/json' },
                      body: JSON.stringify({}),
                    });
                    if (res.ok) {
                      const data = await res.json();
                      setPosBreak({ breakId: data.breakId, shiftId, startedAt: data.startedAt });
                    } else {
                      const body = await res.json().catch(() => ({}));
                      toast.error(body?.error || "Couldn't start your break — it may not be recorded.");
                    }
                    // Local audit-trail record — the break API call above is
                    // still what the server actually relies on; this just
                    // keeps the local event log complete.
                    startBreak(shiftId).catch(console.error);
                  } catch {
                    toast.error("Couldn't reach the server — your break may not be recorded.");
                  }
                  router.push('/login?reason=break');
                }}
                className="flex-1 h-10 rounded-xl bg-[#FF5722] hover:bg-orange-600 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                Lock Screen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Shift Modal */}
      {isCloseShiftOpen && (
        <CloseShiftModal
          isOpen={isCloseShiftOpen}
          onClose={() => setIsCloseShiftOpen(false)}
        />
      )}

      {/* Mid-shift cash in / cash out */}
      {/* `||`, not `??`, on shiftId: the cart store seeds session.shiftId as an
          empty string, which `??` treats as a real value and passes straight
          through — the modal then had no shift to load, made no request at all,
          and silently rendered an empty form. */}
      <CashDrawerModal
        isOpen={isCashDrawerOpen}
        shiftId={session?.shiftId || getPosShift()?.shiftId}
        onClose={() => setIsCashDrawerOpen(false)}
      />

      <ShiftCloseBlockerModal
        isOpen={isBlockerOpen}
        onClose={() => setIsBlockerOpen(false)}
        blockers={blockers}
        onForceClose={async (pin, reason) => {
          setIsBlockerOpen(false);
          localStorage.setItem('shift_override_pin', pin);
          localStorage.setItem('shift_override_reason', reason);
          setIsCloseShiftOpen(true);
        }}
      />

      <ConfirmModal
        isOpen={pendingBackConfirm}
        title="Leave Order?"
        message="Items in this order haven't been sent yet and will be lost if you leave."
        confirmText="Leave Order"
        cancelText="Stay"
        variant="danger"
        onConfirm={() => {
          useCartStore.getState().clearCart();
          setPendingBackConfirm(false);
          router.push(config.backPath!);
        }}
        onCancel={() => setPendingBackConfirm(false)}
      />
    </>
  );
}
