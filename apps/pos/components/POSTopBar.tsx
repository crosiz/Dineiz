'use client';

import React, { useContext, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { TopBarStateContext } from '../contexts/TopBarContext';
import { useCartStore } from '@/lib/store';
import { getPosSession, getPosShift, clearPosSession, setPosBreak } from '@/lib/pos-session';
import { toast } from 'sonner';
import { CloseShiftModal } from '@/components/CloseShiftModal';
import { CashDrawerModal } from '@/components/CashDrawerModal';
import { ShiftCloseBlockerModal } from '@/components/ShiftCloseBlockerModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { DineizLogo } from './ui/DineizLogo';
import { Maximize2, Minimize2, Clock, Coffee, LogOut, ArrowLeft, Wallet } from 'lucide-react';

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
  const [pendingBackConfirm, setPendingBackConfirm] = useState(false);
  const [isBlockerOpen, setIsBlockerOpen] = useState(false);
  const [blockers, setBlockers] = useState<any[]>([]);
  const [isValidatingClose, setIsValidatingClose] = useState(false);

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

    setIsValidatingClose(true);
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
        setBlockers(data.blockers || []);
        setIsBlockerOpen(true);
      } else {
        setIsCloseShiftOpen(true);
      }
    } catch (e) {
      console.warn('Shift close validation error', e);
      toast.error('Could not validate shift status. Please try again.');
    } finally {
      setIsValidatingClose(false);
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

  const handleSignOut = () => {
    clearPosSession();
    useCartStore.getState().clearSession();
    useCartStore.getState().clearCart();
    toast.success('Signed out successfully');
    window.location.href = '/login';
  };

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
                      className="w-full px-3 py-2 rounded-lg flex items-center gap-2.5 text-left text-slate-700 hover:text-slate-900 hover:bg-slate-100/80 active:bg-slate-200/70 transition-colors text-xs font-semibold disabled:opacity-50"
                      onClick={handleCloseShiftClick}
                      disabled={isValidatingClose}
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
                  // Call the break-start API before locking the screen
                  try {
                    const shiftObj = getPosShift();
                    const sessionObj = getPosSession();
                    if (shiftObj?.shiftId && sessionObj?.token) {
                      const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
                      const res = await fetch(`${API_URL}/api/shifts/${shiftObj.shiftId}/break/start`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${sessionObj.token}`, 'Content-Type': 'application/json' },
                      });
                      if (res.ok) {
                        const data = await res.json();
                        setPosBreak({ breakId: data.breakId, shiftId: shiftObj.shiftId, startedAt: data.startedAt });
                      }
                    }
                  } catch {
                    // Non-fatal: still lock the screen even if API call fails
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
      <CashDrawerModal
        isOpen={isCashDrawerOpen}
        shiftId={session?.shiftId ?? getPosShift()?.shiftId}
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
