'use client';

import React, { useContext, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { TopBarStateContext } from '../contexts/TopBarContext';
import { useCartStore } from '@/lib/store';
import { getPosSession, getPosShift, clearPosSession, setPosBreak } from '@/lib/pos-session';
import { toast } from 'sonner';
import { CloseShiftModal } from '@/components/CloseShiftModal';
import { ShiftCloseBlockerModal } from '@/components/ShiftCloseBlockerModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { DineizLogo } from './ui/DineizLogo';

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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/shifts/can-close?shiftId=${session.shiftId}&branchId=${session.branchId}`, {
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
              <span className="material-symbols-outlined text-sm">arrow_back</span>
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
                className="w-8.5 h-8.5 rounded-full flex items-center justify-center font-bold text-[13px] text-white shrink-0 hover:opacity-90 active:scale-95 transition-all shadow-sm"
                style={{ backgroundColor: avatarColor }}
                title={avatarTitle}
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                suppressHydrationWarning
              >
                {avatarInitial}
              </button>
              {/* Profile Dropdown */}
              {isDropdownOpen && (
                <div className="absolute top-12 right-0 w-72 bg-white border border-[#E2E8F0] rounded-[16px] shadow-[0_10px_40px_rgba(0,0,0,0.08)] overflow-hidden animate-slide-down origin-top-right z-50">
                  <div className="px-5 py-4 bg-white border-b border-[#E2E8F0]">
                    <p className="font-bold text-[#0F172A] text-[15px] truncate">{avatarTitle}</p>
                    <p className="text-[#64748B] text-[12px] font-medium mt-0.5">{cashierRole}</p>
                  </div>

                  <div className="px-5 py-2.5 bg-white border-b border-[#E2E8F0] flex items-center justify-between">
                    <span className="text-[#64748B] text-[12px] uppercase tracking-wider font-semibold">Active Shift</span>
                    <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[12px] font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      {shiftDuration}
                    </div>
                  </div>

                  <div className="p-2 flex flex-col gap-1">
                    <button
                      className="w-full px-4 py-3 rounded-lg flex items-center gap-3 text-left hover:bg-[#F8FAFC] active:scale-[0.98] transition-all group"
                      onClick={() => { setIsDropdownOpen(false); toggleFullscreen(); }}
                    >
                      <span className="material-symbols-outlined text-[#64748B] group-hover:text-[#0F172A] transition-colors text-[20px]">
                        {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
                      </span>
                      <span className="font-semibold text-[13px] text-[#0F172A]">{isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}</span>
                    </button>
                    <button
                      className="w-full px-4 py-3 rounded-lg flex items-center gap-3 text-left hover:bg-[#F8FAFC] active:scale-[0.98] transition-all group disabled:opacity-50"
                      onClick={handleCloseShiftClick}
                      disabled={isValidatingClose}
                    >
                      <span className="material-symbols-outlined text-[#64748B] group-hover:text-[#0F172A] transition-colors text-[20px]">schedule</span>
                      <span className="font-semibold text-[13px] text-[#0F172A]">Close Shift</span>
                    </button>
                    <button
                      className="w-full px-4 py-3 rounded-lg flex items-center gap-3 text-left hover:bg-[#F8FAFC] active:scale-[0.98] transition-all group"
                      onClick={() => {
                        setIsDropdownOpen(false);
                        setShowTakeBreakConfirm(true);
                      }}
                    >
                      <span className="material-symbols-outlined text-[#64748B] group-hover:text-[#0F172A] transition-colors text-[20px]">coffee</span>
                      <span className="font-semibold text-[13px] text-[#0F172A] transition-colors">Take a Break</span>
                    </button>
                    <div className="h-[1px] bg-[#E2E8F0] mx-3 my-1" />
                    <button
                      className="w-full px-4 py-3 rounded-lg flex items-center gap-3 text-left hover:bg-rose-50 active:scale-[0.98] transition-all group"
                      onClick={() => {
                        setIsDropdownOpen(false);
                        setShowSignOutConfirm(true);
                      }}
                    >
                      <span className="material-symbols-outlined text-rose-500 group-hover:text-rose-600 transition-colors text-[20px]">logout</span>
                      <span className="font-semibold text-[13px] text-rose-600 group-hover:text-rose-700 transition-colors">Sign Out</span>
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-[400px] bg-white border border-[#E2E8F0] rounded-[24px] shadow-[0_30px_80px_rgba(15,23,42,0.25)] overflow-hidden animate-slide-up">

            <div className="p-8 text-center flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-[#FDECEC] border border-[#F5C6C2] flex items-center justify-center mb-5">
                <span className="material-symbols-outlined text-[#DC2626] text-[32px]">logout</span>
              </div>
              <h3 className="font-bold text-[#0F172A] text-[22px] clash-display tracking-wide mb-2">Sign Out of POS?</h3>
              <p className="text-[#64748B] text-[14px] mb-8">
                Your session will be closed, but your <strong className="text-[var(--pos-primary,#F59E0B)]">shift will remain active</strong> for when you return.
              </p>

              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setShowSignOutConfirm(false)}
                  className="flex-1 h-[52px] rounded-[14px] border border-[#E2E8F0] text-[#475569] hover:bg-[#F1F5F9] active:scale-[0.98] transition-all font-semibold text-[15px]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSignOut}
                  className="flex-1 h-[52px] rounded-[14px] bg-[#DC2626] hover:bg-[#C4362E] text-white font-bold text-[15px] active:scale-[0.98] transition-all shadow-[0_4px_20px_rgba(220,38,38,0.25)]"
                >
                  Sign Out
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Take Break confirm modal */}
      {showTakeBreakConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-[400px] bg-white border border-[#E2E8F0] rounded-[24px] shadow-[0_30px_80px_rgba(15,23,42,0.25)] overflow-hidden animate-slide-up">

            <div className="p-8 text-center flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-[var(--pos-primary,#F59E0B)]/10 border border-[var(--pos-primary,#F59E0B)]/30 flex items-center justify-center mb-5">
                <span className="material-symbols-outlined text-[var(--pos-primary,#F59E0B)] text-[32px]">coffee</span>
              </div>
              <h2 className="font-bold text-[#0F172A] text-[22px] clash-display tracking-wide mb-2">Take a Break?</h2>
              <p className="text-[#64748B] text-[14px] leading-relaxed mb-8 max-w-[280px]">
                You'll be locked out temporarily. Your shift stays active and all orders continue.
              </p>

              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setShowTakeBreakConfirm(false)}
                  className="flex-1 h-[48px] rounded-[14px] border border-[#E2E8F0] text-[#475569] font-semibold text-[15px] hover:bg-[#F1F5F9] active:scale-[0.98] transition-all"
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
                  className="flex-1 h-[48px] rounded-[14px] bg-orange-500 hover:bg-orange-400 text-white font-bold text-[15px] active:scale-[0.98] transition-all shadow-[0_4px_12px_rgba(249,115,22,0.3)]"
                >
                  Lock Screen
                </button>
              </div>
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
