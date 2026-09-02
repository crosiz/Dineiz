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
import { useTerminalSettings } from '@/lib/terminal-settings';
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

const ROUTE_SKIP = ['/login', '/pos/shift', '/pos/settings'];

/**
 * Where this route SHOULD be, given the local session/shift state — or `null`
 * if it's fine to stay. Pure (reads localStorage only), no navigation. Called
 * both during render (to hold back `children` so the target screen never
 * flashes its stale contents for a frame before the redirect) and in the
 * mount effect (which actually calls router.replace).
 */
function resolveRouteGate(pathname: string, searchParams: URLSearchParams): { to: string; toast?: string } | null {
  const sessionObj = getPosSession();
  const onSkip = ROUTE_SKIP.some((p) => pathname.startsWith(p));

  if (!sessionObj) return onSkip ? null : { to: '/login' };

  const role = sessionObj.role?.toUpperCase() || '';

  if (role === 'KITCHEN_STAFF') {
    return pathname.startsWith('/pos/kds') ? null : { to: '/pos/kds' };
  }

  if (role === 'WAITER') {
    const allowed = ['/pos/tables', '/pos/tickets', '/pos/order', '/pos/stock'];
    if (!allowed.some((p) => pathname.startsWith(p))) return { to: '/pos/tables' };
    if (pathname === '/pos/order' && !searchParams.get('tableId') && !searchParams.get('orderId')) {
      return { to: '/pos/tables' };
    }
    return null;
  }

  let requireShiftOpening = true;
  try {
    const settings = JSON.parse(localStorage.getItem('pos_tenant_settings') || '{}');
    if (settings?.pos?.requireShiftOpening === false) requireShiftOpening = false;
  } catch {}

  if (!getPosShift() && requireShiftOpening && !onSkip) {
    const viewMode = allowsViewMode() && localStorage.getItem('pos_view_mode') === '1';
    if (!viewMode) return { to: '/pos/shift/open' };
    if (pathname.startsWith('/pos/order')) return { to: '/pos/home', toast: 'Open a shift to take orders' };
  }

  if (role === 'CASHIER' && pathname.startsWith('/pos/admin')) return { to: '/pos/home' };

  return null;
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

  // The route this screen should be on (or null to stay). Computed during
  // render so `children` can be held back below — otherwise /pos/home paints a
  // frame of its stale useViews orders and dashboard numbers before the mount
  // effect redirects to /pos/shift/open. `null` until mounted so SSR and the
  // first client render agree.
  const gate = isMounted ? resolveRouteGate(pathname, searchParams) : null;

  useEffect(() => {
    // Never fire router.replace() during the hydration render — reaching a
    // route via a client transition and redirecting again inside the same
    // commit desyncs Next's <Router> under Turbopack + React 19 ("Rendered
    // more hooks…", blank screen). Wait one frame (isMounted).
    if (!isMounted || !gate) return;
    if (gate.toast) toast.message(gate.toast);
    router.replace(gate.to);
  }, [gate?.to, gate?.toast, isMounted, router]);

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

    // Spec Part 9 — terminal-local settings (printer, sound, display, drawer).
    // Loaded once here so print.service / the sound cue / the shell font-scale
    // can read them from anywhere without each caller hydrating Dexie.
    useTerminalSettings.getState().load();

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
    //
    // The server pull runs whether or not the replay resolves: replaying a
    // local log is a best-effort optimisation, but a rejection there (a
    // corrupt IndexedDB row, a quota error mid-read) must NOT be what leaves
    // the terminal with no orders and no floor plan. `finally`, not `then`.
    const pullServerState = () => {
      const s = getPosSession();
      if (!s?.branchId) return;
      seedTablesFromServer(s.branchId).catch(console.error);
      refreshOrders(s.branchId, liveOrdersScope()).catch(console.error);
    };
    rebuildViews().catch(console.error).finally(pullServerState);

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

  // Spec Part 9 — terminal-local display settings. keepAwake → the Screen
  // Wake Lock so the tablet doesn't dim mid-service. (fontScale is stored but
  // not applied to the shell yet — a root `zoom` broke the `h-screen` layout.)
  const termSettings = useTerminalSettings((s) => s.settings);
  useEffect(() => {
    if (!termSettings.keepAwake || !('wakeLock' in navigator)) return;
    let lock: any = null;
    let released = false;
    const acquire = () => (navigator as any).wakeLock.request('screen')
      .then((l: any) => { if (released) l.release?.(); else lock = l; })
      .catch(() => {});
    acquire();
    const onVisible = () => { if (document.visibilityState === 'visible' && !lock) acquire(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      released = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release?.().catch(() => {});
    };
  }, [termSettings.keepAwake]);

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
      {/* Dynamic Content Area. Held behind `isMounted` for the first paint:
          every POS screen decides what to render from localStorage / IndexedDB
          (branch, shift, the view store), none of which exist on the server —
          rendering children during SSR guarantees a hydration mismatch on
          whichever screen was hard-loaded.

          That gate renders NOTHING, deliberately. It lasts one frame (isMounted
          flips in the mount effect), and a skeleton in that window is a flash of
          fake content, not information. The shell around it — top bar, bottom
          nav — is already painted, so the terminal never looks broken, and
          NavigationProgress is the cue for anything that actually takes time.

          Also held back while `gate` is set: this screen is about to redirect
          (no shift → /pos/shift/open, wrong role, …). Rendering `children` here
          would flash /pos/home's stale orders + dashboard numbers for a frame
          before the redirect lands. */}
      <div className="flex-1 overflow-hidden flex flex-col relative">
        {isMounted && !gate ? children : null}
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
          currentUserId={getPosSession()?.userId ?? ''}
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
