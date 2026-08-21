'use client';

import { useEffect, useState } from 'react';
import { useCartStore } from '@/lib/store';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { getDB } from '@/lib/db';
import { startBackgroundSync } from '@/lib/sync';
import { BottomNav } from '@/components/layout/BottomNav';
import { toast } from 'sonner';
import { TopBarProvider } from '@/contexts/TopBarContext';
import { SocketProvider, useSocket } from '@/contexts/SocketContext';
import { POSTopBar } from '@/components/POSTopBar';
import { getPosSession, getPosShift } from '@/lib/pos-session';
import { useBrandingStore } from '@/lib/branding-store';
import { QuickStockAlertModal, StockAlertPayload } from '@/components/QuickStockAlertModal';

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

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const searchParams = useSearchParams();

  useEffect(() => {
    const sessionObj = getPosSession();
    const shiftObj = getPosShift();
    const skip = ['/login', '/pos/shift/open'];

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
      router.replace('/pos/shift/open');
      return;
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
        Object.assign(stored, settings);
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

    const cleanupSync = startBackgroundSync();

    return () => {
      cleanupSync && cleanupSync();
    };
  }, []);

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

    socket.on('menu:published', handleMenuPublished);
    socket.on('menu:price_changed', handleMenuPriceChanged);
    socket.on('tenant:branding_updated', handleBrandingUpdated);
    socket.on('tenant:settings_updated', handleSettingsUpdated);

    return () => {
      socket.off('menu:published', handleMenuPublished);
      socket.off('menu:price_changed', handleMenuPriceChanged);
      socket.off('tenant:branding_updated', handleBrandingUpdated);
      socket.off('tenant:settings_updated', handleSettingsUpdated);
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
      {!hideTopBar && <POSTopBar />}
      {/* Dynamic Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col relative">
        {children}
      </div>

      {/* Canonical Bottom Navigation */}
      {!hideBottomNav && <BottomNav />}

      <QuickStockAlertModal alert={stockAlert} onDismiss={() => setStockAlert(null)} />
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
