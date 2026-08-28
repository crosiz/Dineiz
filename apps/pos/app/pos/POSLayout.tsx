'use client';

import { useEffect, useState } from 'react';
import { useCartStore } from '@/lib/store';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { getDB } from '@/lib/db';
import { startOutbox } from '@/lib/core/outbox';
import { startBackgroundSync } from '@/lib/sync';
import { useViews, rebuildViews, seedTablesFromServer, refreshOrders, startTableReconcile } from '@/lib/core/views';
import { BottomNav } from '@/components/layout/BottomNav';
import { NavigationProgress } from '@/components/NavigationProgress';
import { toast } from 'sonner';
import { TopBarProvider } from '@/contexts/TopBarContext';
import { SocketProvider, useSocket } from '@/contexts/SocketContext';
import { POSTopBar } from '@/components/POSTopBar';
import { getPosSession, getPosShift, getToken } from '@/lib/pos-session';
import { useBrandingStore } from '@/lib/branding-store';
import { QuickStockAlertModal, StockAlertPayload } from '@/components/QuickStockAlertModal';
import { OrphanResolutionModal, OrphanOrder } from '@/components/shift/OrphanResolutionModal';
import { ManagerOverlayBar } from '@/components/ManagerOverlayBar';
import { useManagerOverlay } from '@/lib/manager-overlay';
import { ViewModeBanner } from '@/components/ViewModeBanner';
import { allowsViewMode } from '@/lib/view-mode';

// Spec Part 2 — a cashier's / waiter's live board is scoped to their own
// open shift; a branch manager / admin sees the whole branch. The server
// also enforces the cashier scope by role, so this is mostly an
// optimisation plus the "signed in with no shift" case.
function liveOrdersScope(): { shiftId?: string | null } {
  const sess = getPosSession();
  const isManager = sess?.role === 'BRANCH_MANAGER' || sess?.role === 'TENANT_ADMIN';
  if (isManager) return {};
  return { shiftId: getPosShift()?.shiftId ?? null };
}

function POSLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useCartStore((s) => s.session);
  const clearSession = useCartStore((s) => s.clearSession);
  const clearCart = useCartStore((s) => s.clearCart);
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const [isMounted, setIsMounted] = useState(false);
  const { setBranding } = useBrandingStore();
  const [stockAlert, setStockAlert] = useState<StockAlertPayload | null>(null);
  const [orphans, setOrphans] = useState<OrphanOrder[]>([]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const searchParams = useSearchParams();

  useEffect(() => {
    const sessionObj = getPosSession();
    const shiftObj = getPosShift();
    // `/pos/shift` covers open, close and the post-close background-sync
    // screen (spec Part 6) — the last two run with `pos_shift` already
    // cleared and must not bounce to shift-open. `/pos/settings` is reachable
    // with or without a shift (spec Part 9).
    const skip = ['/login', '/pos/shift', '/pos/settings'];

    if (!sessionObj && !skip.some(p => pathname.startsWith(p))) {
      router.replace('/login');
      return;
    }

    const role = sessionObj?.role?.toUpperCase() || '';

    // 1. KITCHEN_STAFF: Only allowed on KDS
    if (role === 'KITCHEN_STAFF') {
      if (!pathname.startsWith('/pos/kds')) {
        router.replace('/pos/kds');
      }
      return;
    }

    // 2. WAITER: Only allowed on specific floor/order screens
    if (role === 'WAITER') {
      const allowedWaiterPaths = ['/pos/tables', '/pos/tickets', '/pos/order', '/pos/stock'];
      if (!allowedWaiterPaths.some(p => pathname.startsWith(p))) {
        router.replace('/pos/tables');
        return;
      }
      
      // If a waiter tries to access /pos/order directly without a tableId or orderId, redirect back
      if (pathname === '/pos/order' && !searchParams.get('tableId') && !searchParams.get('orderId')) {
        router.replace('/pos/tables');
        return;
      }
      return; // Fully exempt from shift check below
    }

    // 3. Shift Check: All other roles MUST have a shift opened, unless the
    // tenant has turned off Settings → Point of Sale → "Require shift
    // opening" — previously this redirect fired unconditionally regardless
    // of that setting, so turning it off in the admin panel had no effect.
    let requireShiftOpening = true;
    try {
      const settings = JSON.parse(localStorage.getItem('pos_tenant_settings') || '{}');
      if (settings?.pos?.requireShiftOpening === false) requireShiftOpening = false;
    } catch {}

    if (!shiftObj && requireShiftOpening && !skip.some(p => pathname.startsWith(p))) {
      // Spec Part 11 — VIEW MODE. If the tenant allows login without a shift
      // and the cashier chose "Continue Without Shift", let them in read-only
      // instead of forcing shift-open. Order-building / checkout screens stay
      // off-limits until a shift is open.
      const viewMode = allowsViewMode() && localStorage.getItem('pos_view_mode') === '1';
      if (!viewMode) {
        router.replace('/pos/shift/open');
        return;
      }
      if (pathname.startsWith('/pos/order')) {
        router.replace('/pos/home');
        toast.message('Open a shift to take orders');
        return;
      }
    }

    if (sessionObj?.role === 'CASHIER' && pathname.startsWith('/pos/admin')) {
      router.replace('/pos/home');
      return;
    }
  }, [pathname, searchParams, router]);

  useEffect(() => {
    // Load once from localStorage on mount (in case zustand initial state missed it on server)
    const stored = JSON.parse(localStorage.getItem('pos_branding') ?? '{}');
    const settingsStr = localStorage.getItem('pos_tenant_settings');
    if (settingsStr) {
      try {
        const settings = JSON.parse(settingsStr);
        // `pos` must be a DEEP merge: `pos_branding.pos` carries the Part 13
        // config the pin-login response wrote (order-number format, sync
        // tunables, allowLoginWithoutShift, manager-overlay config …), while
        // `pos_tenant_settings.pos` carries the separate Tenant.settings blob
        // (requireShiftOpening, kitchen.useKDS …). A plain Object.assign here
        // replaces the whole sub-object and silently drops whichever side's
        // keys the other doesn't also have.
        const mergedPos = { ...(stored.pos ?? {}), ...(settings.pos ?? {}) };
        Object.assign(stored, settings);
        if (Object.keys(mergedPos).length) stored.pos = mergedPos;
      } catch (e) {}
    }
    setBranding(stored);

    const applyBranding = () => {
      const branding = useBrandingStore.getState().branding;
      const root = document.documentElement;
      if (branding.primaryColor) {
        root.style.setProperty('--pos-primary', branding.primaryColor);
        // Calculate dim version:
        root.style.setProperty('--pos-primary-dim', branding.primaryColor + '1F');
      }

      // Sync dual-tax config from branding into the Zustand session so
      // CheckoutModal always uses the latest tenant-configured rates
      if (branding.cashTaxRate !== undefined || branding.cardTaxRate !== undefined) {
        useCartStore.getState().setSession({
          cashTaxEnabled: branding.cashTaxEnabled ?? false,
          cashTaxRate: (branding.cashTaxRate ?? 5) / 100,
          cashTaxLabel: branding.cashTaxLabel ?? 'GST (Cash)',
          cashTaxNote: branding.cashTaxNote ?? null,
          cardTaxEnabled: branding.cardTaxEnabled ?? false,
          cardTaxRate: (branding.cardTaxRate ?? 17) / 100,
          cardTaxLabel: branding.cardTaxLabel ?? 'GST (Card/Digital)',
          cardTaxNote: branding.cardTaxNote ?? null,
          showDualTaxOnReceipt: branding.showDualTaxOnReceipt ?? true,
          taxRoundingMethod: branding.taxRoundingMethod ?? 'ROUND',
          serviceChargeEnabled: branding.serviceChargeEnabled ?? false,
          serviceChargeRate: branding.serviceChargeRate ?? 10,
        });
      }

      // This branch's own currency — previously the session always kept
      // its hardcoded 'PKR' default no matter what the branch was actually
      // configured with in Add/Edit Branch. (Timezone isn't wired the same
      // way: nothing in the POS UI currently reads a session-level
      // timezone at all — every date/time display uses the browser's own
      // local time — so storing one here wouldn't change any behavior yet.)
      if (branding.currency) {
        useCartStore.getState().setSession({ currency: branding.currency });
      }
    };
    applyBranding();

    // Outbox drain loop (lib/core/outbox.ts) — ships queued events from the
    // local log to the server, replacing the old per-screen fetch-then-
    // queue-offline pattern for every command-driven flow (new orders,
    // status changes, payments, table status). Started before rebuildViews()
    // resolves is fine: it reads straight from IndexedDB itself and simply
    // finds nothing queued yet on a cold start.
    const cleanupOutbox = startOutbox();

    // Spec Part 10 — restore an in-flight manager overlay across a reload
    // (auto-exits itself if it went stale while the tab was closed).
    useManagerOverlay.getState().hydrate();

    // lib/sync.ts's older queue still runs alongside it: the "add items to
    // an order already sent to the kitchen" flow (order/page.tsx's
    // isAppending branch) was deliberately NOT moved onto the outbox — it
    // edits an order that may not yet have a local view-store entry (e.g.
    // opened via a direct link before refreshOrders() has populated it),
    // and commands.addItem() silently no-ops when the target order isn't in
    // the store yet. Its offline queue (pendingItemAdds) still needs this
    // loop to drain it.
    const cleanupSync = startBackgroundSync();

    // Spec Part 3 — re-derive every table every 60s so a table whose cleaning
    // window has elapsed drops DIRTY→FREE (no event fires for a time-based
    // transition), and any drift is corrected.
    const cleanupTableReconcile = startTableReconcile();

    // Event-sourced view store (lib/core/views.ts) — replay the local event
    // log into memory once on mount (fast: IndexedDB read + pure reducer,
    // no network) so orders created earlier this session are already there
    // before any screen reads from it, then seed table reference data from
    // the server the same way ClientTableMap/useSWRTables already do.
    rebuildViews().then(() => {
      const s = getPosSession();
      if (!s?.branchId) return;
      // Views must be replayed first (above) before merging server data in
      // — refreshOrders needs to see any locally-pending orders already in
      // the store so it doesn't drop them while merging the server's list.
      seedTablesFromServer(s.branchId).catch(console.error);
      refreshOrders(s.branchId, liveOrdersScope()).catch(console.error);
    }).catch(console.error);

    // Prefetch every POS route bundle right after login so tab switching
    // doesn't pay Next.js's lazy-chunk-load cost the first time each tab is
    // visited — the data is already instant via useViews; this removes the
    // remaining bundle-fetch latency too.
    ['/pos/home', '/pos/order', '/pos/tickets', '/pos/tables', '/pos/stock', '/pos/admin', '/pos/kds']
      .forEach((r) => router.prefetch(r));

    return () => {
      cleanupOutbox();
      cleanupSync && cleanupSync();
      cleanupTableReconcile();
    };
  }, []);

  // Spec Part 2 — orphan check. When a shift is open and the cashier lands on
  // a working screen, ask the server whether any still-active orders were
  // left under a now-closed shift at this branch. If so, block with the
  // resolution modal until every one is adopted or cancelled. Re-runs on
  // navigation so it also catches the first hop out of the shift-open flow.
  useEffect(() => {
    const shift = getPosShift();
    const s = getPosSession();
    const onWorkingScreen =
      pathname.startsWith('/pos') &&
      !pathname.startsWith('/pos/shift') &&
      !pathname.startsWith('/pos/kds') &&
      !pathname.startsWith('/pos/login');
    if (!shift?.shiftId || !s?.branchId || !onWorkingScreen) {
      setOrphans([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/pos/orphans?branchId=${s.branchId}`,
          { headers: { Authorization: `Bearer ${getToken()}` } },
        );
        if (!res.ok || cancelled) return;
        const list = (await res.json()) as OrphanOrder[];
        if (!cancelled) setOrphans(Array.isArray(list) ? list : []);
      } catch {
        /* offline / transient — the modal simply doesn't appear this pass */
      }
    })();
    return () => { cancelled = true; };
  }, [pathname]);

  // Spec Part 10 — a manager overlay cannot take a payment or build an order.
  // Walking onto the order/checkout or receipt screen ends it, and the
  // cashier's session simply resumes.
  useEffect(() => {
    const o = useManagerOverlay.getState();
    if (!o.overlay) return;
    if (pathname.startsWith('/pos/order') || pathname.startsWith('/pos/receipt')) {
      o.exit('NAV_PAYMENT');
      toast.message('Manager mode ended — payments and new orders are the cashier’s job.');
    }
  }, [pathname]);

  // Keep the idle countdown honest while the manager is actually doing things.
  useEffect(() => {
    let last = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - last < 5000) return;
      last = now;
      if (useManagerOverlay.getState().overlay) useManagerOverlay.getState().bump();
    };
    window.addEventListener('pointerdown', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity);
    return () => {
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
    };
  }, []);

  const recheckOrphans = () => {
    const s = getPosSession();
    if (!s?.branchId) return;
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/pos/orphans?branchId=${s.branchId}`,
      { headers: { Authorization: `Bearer ${getToken()}` } },
    )
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => setOrphans(Array.isArray(list) ? list : []))
      .catch(() => {});
  };

  useEffect(() => {
    if (!socket) return;

    const handleMenuPublished = async () => {
      const db = getDB();
      await db.menuItems.clear();
      queryClient.invalidateQueries({ queryKey: ['menu'] });
    };

    const handleMenuPriceChanged = async ({ itemId, price }: any) => {
      const db = getDB();
      if (itemId) {
        await db.menuItems.where('id').equals(itemId).modify({ basePrice: price });
      }
      queryClient.invalidateQueries({ queryKey: ['menu'] });
    };

    const handleBrandingUpdated = (data: any) => {
      const existing = useBrandingStore.getState().branding;
      const updated = { ...existing, ...data };
      setBranding(updated);
      localStorage.setItem('pos_branding', JSON.stringify(updated));
      
      if (data.primaryColor) {
        document.documentElement.style.setProperty('--pos-primary', data.primaryColor);
        document.documentElement.style.setProperty('--pos-primary-dim', data.primaryColor + '1F');
      }

      if (data.cashTaxRate !== undefined || data.cardTaxRate !== undefined) {
        useCartStore.getState().setSession({
          cashTaxEnabled: data.cashTaxEnabled ?? false,
          cashTaxRate: (data.cashTaxRate ?? 5) / 100,
          cashTaxLabel: data.cashTaxLabel ?? 'GST (Cash)',
          cardTaxEnabled: data.cardTaxEnabled ?? false,
          cardTaxRate: (data.cardTaxRate ?? 17) / 100,
          cardTaxLabel: data.cardTaxLabel ?? 'GST (Card/Digital)',
          showDualTaxOnReceipt: data.showDualTaxOnReceipt ?? true,
          taxRoundingMethod: data.taxRoundingMethod ?? 'ROUND',
        });
      }

      toast.info('Settings synced from Admin Panel');
    };

    const handleSettingsUpdated = (settings: any) => {
      try {
        const existingStr = localStorage.getItem('pos_tenant_settings');
        const existing = existingStr ? JSON.parse(existingStr) : {};
        const updated = { ...existing, ...settings };
        localStorage.setItem('pos_tenant_settings', JSON.stringify(updated));
      } catch {}
    };

    const s = getPosSession();
    if (s?.branchId) {
      socket.emit('join_branch', s.branchId);
    }
    if (s?.tenantId) {
      socket.emit('join_tenant', s.tenantId);
    }

    // No inbox yet (that's the multi-terminal phase, not built) — until
    // then, the simplest correct thing a remote order/table event can do is
    // trigger a full refetch-and-merge rather than try to hand-apply a
    // partial remote event to local view state.
    const branchId = s?.branchId;
    const onOrderChanged = () => { if (branchId) refreshOrders(branchId, liveOrdersScope()).catch(console.error); };
    const onTableChanged = () => { if (branchId) seedTablesFromServer(branchId).catch(console.error); };

    // Waiter assignment (from AssignWaiterSheet, possibly on another
    // terminal) is a remote fact — patched directly into the table view,
    // same as seedTablesFromServer, not routed through commands.assignWaiter
    // (that would incorrectly record it as *this* terminal's own action).
    const onOrderAssigned = (data: { tableId: string; assignedWaiterId: string; assignedWaiterName: string; assignedWaiterColor?: string }) => {
      const t = useViews.getState().tables[data.tableId];
      if (!t) return;
      useViews.getState()._setSnapshot({
        tables: {
          ...useViews.getState().tables,
          [data.tableId]: {
            ...t,
            assignedWaiterId: data.assignedWaiterId,
            assignedWaiterName: data.assignedWaiterName,
            assignedWaiterColor: data.assignedWaiterColor ?? t.assignedWaiterColor,
          },
        },
      });
    };

    socket.on('menu:published', handleMenuPublished);
    socket.on('menu:price_changed', handleMenuPriceChanged);
    socket.on('tenant:branding_updated', handleBrandingUpdated);
    socket.on('tenant:settings_updated', handleSettingsUpdated);
    socket.on('order:assigned', onOrderAssigned);
    socket.on('order:created', onOrderChanged);
    socket.on('order:status_changed', onOrderChanged);
    socket.on('order:updated', onOrderChanged);
    socket.on('order:cancelled', onOrderChanged);
    socket.on('table:status_changed', onTableChanged);

    return () => {
      socket.off('menu:published', handleMenuPublished);
      socket.off('menu:price_changed', handleMenuPriceChanged);
      socket.off('tenant:branding_updated', handleBrandingUpdated);
      socket.off('tenant:settings_updated', handleSettingsUpdated);
      socket.off('order:assigned', onOrderAssigned);
      socket.off('order:created', onOrderChanged);
      socket.off('order:status_changed', onOrderChanged);
      socket.off('order:updated', onOrderChanged);
      socket.off('order:cancelled', onOrderChanged);
      socket.off('table:status_changed', onTableChanged);
    };
  }, [socket, queryClient]);

  // Global inventory awareness — mounted here (rather than the Stock screen
  // itself) so a cashier taking an order on /pos/order still gets warned the
  // moment an ingredient runs out, not only when they happen to be on the
  // Stock tab. Scoped strictly to reacting to the socket event: it does not
  // touch cart/order state and kitchen staff (who live on /pos/kds and
  // never see the bottom nav) are excluded since the alert's actions are
  // menu-availability/manager actions they can't take anyway.
  useEffect(() => {
    if (!socket) return;

    const handleOutOfStock = (payload: any) => {
      const s = getPosSession();
      if (!s || s.role === 'KITCHEN_STAFF') return;
      if (payload?.branchId && s.branchId && payload.branchId !== s.branchId) return;
      setStockAlert({
        ingredientId: payload.ingredientId,
        name: payload.name,
        affectedItems: Array.isArray(payload.affectedItems) ? payload.affectedItems : [],
      });
    };

    const handleItemUnavailable = (payload: any) => {
      if (payload?.itemName) {
        toast.info(`${payload.itemName} marked unavailable${payload.reason ? ` — ${payload.reason}` : ''}`);
      }
    };

    const handleItemAvailable = (payload: any) => {
      if (payload?.itemName) {
        toast.success(`${payload.itemName} is available again`);
      }
    };

    socket.on('inventory:out_of_stock', handleOutOfStock);
    socket.on('menu:item_unavailable', handleItemUnavailable);
    socket.on('menu:item_available', handleItemAvailable);

    return () => {
      socket.off('inventory:out_of_stock', handleOutOfStock);
      socket.off('menu:item_unavailable', handleItemUnavailable);
      socket.off('menu:item_available', handleItemAvailable);
    };
  }, [socket]);

  const handleSignOut = () => {
    clearSession();
    clearCart();
    router.push('/login');
  };

  const hideTopBar = pathname.startsWith('/pos/shift') || pathname.startsWith('/login') || pathname.startsWith('/pos/kds');
  const hideBottomNav = pathname.startsWith('/pos/kds');

  return (
    <div className="flex flex-col h-screen select-none bg-[var(--pos-bg-base)] text-[#0F172A] overflow-hidden font-body-md">
      <NavigationProgress />
      {!hideTopBar && <POSTopBar />}
      <ManagerOverlayBar />
      {!hideTopBar && <ViewModeBanner />}
      {/* Dynamic Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col relative">
        {children}
      </div>

      {/* Canonical Bottom Navigation */}
      {!hideBottomNav && <BottomNav />}

      <QuickStockAlertModal alert={stockAlert} onDismiss={() => setStockAlert(null)} />

      {orphans.length > 0 && (
        <OrphanResolutionModal
          orphans={orphans}
          branchId={getPosSession()?.branchId ?? ''}
          intoShiftId={getPosShift()?.shiftId ?? ''}
          token={getToken()}
          onResolved={recheckOrphans}
        />
      )}
    </div>
  );
}

export default function POSLayout({ children }: { children: React.ReactNode }) {
  return (
    <TopBarProvider>
      <POSLayoutInner>
        {children}
      </POSLayoutInner>
    </TopBarProvider>
  );
}
