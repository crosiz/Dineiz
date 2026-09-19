'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { cartItemKey, useCartStore } from '@/lib/store';
import { useMenu, groupByCategory } from '@/hooks/useMenu';
import { useRouter, useSearchParams } from 'next/navigation';
import { VariationPicker, DiscountModal } from './components';
import type { CachedMenuItem } from '@/lib/db';
import type { ViewMode } from '@/components/MenuItemCard';
import { OrderPanel } from '@/components/OrderPanel';
import { MenuBrowser } from '@/components/MenuBrowser';
import { toast } from 'sonner';
import { getDB } from '@/lib/db';
import { v4 as uuid } from 'uuid';
import PaymentModal from '@/components/PaymentModal';
import { useTopBar } from '@/hooks/useTopBar';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { getToken } from '@/lib/pos-session';
import { VoidItemBottomSheet } from './VoidItemBottomSheet';
import * as commands from '@/lib/core/commands';
import { useViews, seedServerOrder, resolveLocalOrderId } from '@/lib/core/views';
import { useBrandingStore } from '@/lib/branding-store';
import { formatPKR } from '@/lib/utils';
import { saveCartDraft, loadCartDraft, clearCartDraft } from '@/lib/core/drafts';
import { CustomerPickerSheet, type PickedCustomer } from '@/components/CustomerPickerSheet';
import { AssignWaiterSheet } from '@/app/pos/tables/AssignWaiterSheet';
import { ServiceIllustration } from '@/components/ServiceIllustration';

// Give the name its own row so long dishes remain readable in a narrow
// order panel. Quantity and price share the second row; at one portion the
// minus becomes remove. The configuration key targets only this exact set
// of extras, not every portion of the same dish.
function SwipeableCartItem({ cartItem, incrementItem, decrementItem }: any) {
  const addOns: string[] = (cartItem.selectedAddOns ?? []).map((a: any) => a.name);
  const detail = [cartItem.selectedVariation?.name, ...addOns.map((n) => `+ ${n}`)].filter(Boolean).join(' · ');
  const lastOne = cartItem.quantity <= 1;
  const accessibleName = [cartItem.name, detail].filter(Boolean).join(', ');
  const stepBtn = 'w-11 h-11 grid place-items-center text-ink-2 hover:bg-sunken hover:text-ink transition-colors';

  return (
    <div className="px-4 py-3 grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 border-b border-line last:border-b-0">
      <div className="min-w-0 col-span-2">
        <p className="text-[14px] font-semibold text-ink leading-snug line-clamp-2">{cartItem.name}</p>
        {detail && <p className="text-[12px] text-ink-3 leading-snug truncate">{detail}</p>}
      </div>
      <div className="flex w-fit items-center h-11 rounded-lg border border-line overflow-hidden shrink-0">
        <button
          onClick={() => decrementItem(cartItem.itemId, cartItem.selectedVariation?.id, cartItemKey(cartItem))}
          className={`${stepBtn} ${lastOne ? 'text-danger hover:text-danger hover:bg-danger/10' : ''}`}
          aria-label={lastOne ? `Remove ${accessibleName}` : `One less ${accessibleName}`}
        >
          {lastOne ? <Trash2 className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
        </button>
        <span className="w-7 text-center text-[14px] font-semibold text-ink tabular-nums">{cartItem.quantity}</span>
        <button
          onClick={() => incrementItem(cartItem.itemId, cartItem.selectedVariation?.id, cartItemKey(cartItem))}
          className={stepBtn}
          aria-label={`One more ${accessibleName}`}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      <span className="text-right text-[14px] font-semibold text-ink tabular-nums shrink-0">
        {formatPKR(cartItem.subtotal)}
      </span>
    </div>
  );
}

function OrderEntryPageContent() {
  const router = useRouter();
  const session = useCartStore(s => s.session);
  const branding = useBrandingStore(s => s.branding);
  const cart = useCartStore(s => s.cart);
  const addItem = useCartStore(s => s.addItem);
  const incrementItem = useCartStore(s => s.incrementItem);
  const decrementItem = useCartStore(s => s.decrementItem);
  const removeItem = useCartStore(s => s.removeItem);
  const clearCart = useCartStore(s => s.clearCart);
  const subtotal = useCartStore(s => s.subtotal());
  const discountAmount = useCartStore(s => s.discountAmount());
  const taxAmount = useCartStore(s => s.taxAmount());
  const total = useCartStore(s => s.total());
  
  const existingItems = useCartStore(s => s.existingItems);
  const existingOrderData = useCartStore(s => s.existingOrderData);
  const combinedSubtotal = useCartStore(s => s.combinedSubtotal());
  const combinedTaxAmount = useCartStore(s => s.combinedTaxAmount());
  const combinedTotal = useCartStore(s => s.combinedTotal());

  const searchParams = useSearchParams();

  const selectedTableId = useCartStore(s => s.selectedTableId);
  const selectedTableLabel = useCartStore(s => s.selectedTableLabel);
  const paymentOrderId = useCartStore(s => s.paymentOrderId);
  const [paymentOrderNumber, setPaymentOrderNumber] = useState<string | null>(null);
  const isEditing = useCartStore(s => s.isEditing);
  const orderType = useCartStore(s => s.orderType);
  const setOrderType = useCartStore(s => s.setOrderType);
  const setOrderContext = useCartStore(s => s.setOrderContext);

  const setPaymentOrderId = (id: string | null) => setOrderContext({ orderId: id });
  const [promptContinueOpen, setPromptContinueOpen] = useState(false);
  const [voidSheetState, setVoidSheetState] = useState<{ isOpen: boolean; item: any }>({ isOpen: false, item: null });

  const customerId = useCartStore(s => s.customerId);
  const customerName = useCartStore(s => s.customerName);
  const setCustomer = useCartStore(s => s.setCustomer);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);

  const waiterId = useCartStore(s => s.waiterId);
  const waiterName = useCartStore(s => s.waiterName);
  const waiterColor = useCartStore(s => s.waiterColor);
  const setWaiter = useCartStore(s => s.setWaiter);
  const [waiterPickerOpen, setWaiterPickerOpen] = useState(false);

  const setExistingOrderData = useCartStore(s => s.setExistingOrderData);
  const setExistingItems = useCartStore(s => s.setExistingItems);

  // Auto-refresh existing order to sync remote void approvals and KDS status
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (paymentOrderId) {
      interval = setInterval(async () => {
        // paymentOrderId is this terminal's permanent client id — the
        // server only knows a locally-created order by its reconciled
        // serverId (lib/core/views.ts's reconcileServerId, set once the
        // outbox's CREATE_ORDER task lands). Polling by the client id 404s
        // every time until then; skip rather than spam a request that can
        // never succeed.
        const serverId = useViews.getState().orders[paymentOrderId]?.serverId;
        if (!serverId) return;
        try {
          const res = await fetch(`${API_URL}/api/orders/${serverId}`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
          });
          if (res.ok) {
            const order = await res.json();
            const prevItems = useCartStore.getState().existingItems;
            
            if (prevItems.length > (order.items?.length || 0)) {
              toast.success('Item was successfully removed from the order');
            }

            useCartStore.setState({
              existingOrderData: order,
              existingItems: order.items || [],
            });
          }
        } catch (e) {}
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    }
  }, [paymentOrderId]);

  const handleVoidSuccess = (updatedOrder: any) => {
    // Update the store directly so UI updates without a reload
    setExistingOrderData(updatedOrder);
    setExistingItems(updatedOrder.items || []);
  };

  const handleContinueOrder = () => {
    setPromptContinueOpen(false);
    let qs = '';
    if (selectedTableId) qs += `tableId=${selectedTableId}&tableLabel=${encodeURIComponent(selectedTableLabel || '')}&`;
    if (paymentOrderId) qs += `orderId=${paymentOrderId}&edit=${isEditing}&`;
    if (orderType) qs += `type=${orderType.toLowerCase().replace('_', '-')}`;
    router.replace(`/pos/order?${qs}`);
  };

  const handleStartNewOrderFromPrompt = () => {
    setPromptContinueOpen(false);
    clearCart();
  };

  const { data: menuItems = [], isLoading: menuLoading } = useMenu(session?.tenantId || 'DEFAULT_TENANT', session?.branchId);
  const menuQueryClient = useQueryClient();
  const menuQueryKey = ['menu', session?.tenantId || 'DEFAULT_TENANT', session?.branchId];
  const [togglingItemId, setTogglingItemId] = useState<string | null>(null);
  // The availability endpoint only authorizes BRANCH_MANAGER and above
  // (see apps/api menu.routes.ts) — hide the toggle for cashiers so it
  // doesn't render a control that always 403s.
  const canToggleAvailability = ['BRANCH_MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN'].includes(session?.role || '');

  // Lets a manager 86 an item straight from the menu grid instead of routing
  // through the dashboard.
  const handleToggleAvailability = async (item: CachedMenuItem, nextAvailable: boolean) => {
    setTogglingItemId(item.id);
    try {
      const res = await fetch(`${API_URL}/api/v1/menu/items/${item.id}/availability`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify({ isAvailable: nextAvailable, branchId: session?.branchId }),
      });
      if (!res.ok) throw new Error('Failed to update item availability');

      menuQueryClient.setQueryData<CachedMenuItem[]>(menuQueryKey, (prev) =>
        (prev || []).map((m) => (m.id === item.id ? { ...m, isAvailable: nextAvailable } : m))
      );
      toast.success(nextAvailable ? `${item.name} marked available` : `${item.name} marked sold out`);
    } catch {
      toast.error('Could not update availability — check your connection.');
    } finally {
      setTogglingItemId(null);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const [cartWidthPercent, setCartWidthPercent] = useState(32);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    const savedWidth = localStorage.getItem('pos_cart_width_percent');
    const width = Number(savedWidth);
    if (savedWidth && Number.isFinite(width)) setCartWidthPercent(Math.max(28, Math.min(48, width)));
  }, []);

  useEffect(() => {
    if (!isResizing) return;
    const handlePointerMove = (e: PointerEvent) => {
      const newPercent = ((window.innerWidth - e.clientX) / window.innerWidth) * 100;
      if (newPercent >= 28 && newPercent <= 48) {
        setCartWidthPercent(newPercent);
      }
    };
    const handlePointerUp = (e: PointerEvent) => {
      setIsResizing(false);
      const newPercent = ((window.innerWidth - e.clientX) / window.innerWidth) * 100;
      if (newPercent >= 28 && newPercent <= 48) {
        localStorage.setItem('pos_cart_width_percent', newPercent.toString());
      } else {
        localStorage.setItem('pos_cart_width_percent', cartWidthPercent.toString());
      }
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isResizing, cartWidthPercent]);

  useEffect(() => {
    // 'pos_menu_layout', NOT 'pos_view_mode'. That key belongs to lib/view-mode.ts
    // (signed-in-without-shift), and the two features were sharing it: opening a
    // shift calls removeItem('pos_view_mode'), silently wiping the cashier's menu
    // layout, and choosing 'Continue Without Shift' wrote '1' into it, which then
    // loaded back here as a layout name that doesn't exist.
    const saved = localStorage.getItem('pos_menu_layout') as ViewMode | null;
    if (saved === 'grid' || saved === 'list') setViewMode(saved);
  }, []);

  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('pos_menu_layout', mode);
  };

  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);

  // What the checkout is billing, captured at the moment it OPENS.
  //
  // The modal used to be gated on `isPaymentOpen && paymentOrderId` and read
  // `paymentOrderId` live. PaymentModal calls clearCart() the instant a payment
  // succeeds — which sets paymentOrderId to null — so the gate went false and
  // the modal UNMOUNTED in the middle of its own success: the receipt screen
  // never rendered, "Done" could never be tapped, and so onSuccess (clear the
  // order, go Home) never ran. The cashier was left looking at the order they
  // had just charged, marked SENT, beside a "select an order type" warning,
  // with no way to print or send the receipt. Freezing these at open time keeps
  // the modal alive through its success state.
  const [checkout, setCheckout] = useState<{
    orderId: string; orderNumber?: string; items: any[]; summary: string;
  } | null>(null);

  /** Open the checkout against a specific order id, snapshotting what it bills. */
  const openCheckout = (orderId: string, orderNumber?: string | null) => {
    const s = useCartStore.getState();
    const items = [...s.existingItems, ...s.cart];
    setCheckout({
      orderId,
      orderNumber: orderNumber ?? paymentOrderNumber ?? undefined,
      items,
      summary: [
        ...s.existingItems.map((c: any) => `${c.quantity}x ${c.itemName || c.item?.name}`),
        ...s.cart.map((c: any) => `${c.quantity}x ${c.name}`),
      ].join(' · '),
    });
    setIsPaymentOpen(true);
  };

  const [confirmNewOrderOpen, setConfirmNewOrderOpen] = useState(false);
  // Fix #5: clear-cart confirmation via ConfirmModal instead of confirm()
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const [heldOrderId, setHeldOrderId] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
  const [draftPrompt, setDraftPrompt] = useState<Awaited<ReturnType<typeof loadCartDraft>>>(null);

  const applyFreshOrderParams = () => {
    const type = searchParams.get('type');
    if (type) {
      useCartStore.setState({ orderType: type.toUpperCase().replace('-', '_') as any });
    }
    const tId = searchParams.get('tableId');
    const tLabel = searchParams.get('tableLabel');
    if (tId) useCartStore.setState({ selectedTableId: tId });
    if (tLabel) useCartStore.setState({ selectedTableLabel: tLabel });
  };

  const handleRestoreDraft = () => {
    if (!draftPrompt) return;
    useCartStore.setState({
      cart: draftPrompt.cart,
      orderType: (draftPrompt.orderType as any) ?? null,
      selectedTableId: draftPrompt.selectedTableId,
      selectedTableLabel: draftPrompt.selectedTableLabel,
    });
    if (draftPrompt.customerId) {
      useCartStore.getState().setCustomer({ id: draftPrompt.customerId, name: draftPrompt.customerName || 'Customer' });
    }
    setOrderNote(draftPrompt.notes ?? '');
    setDraftPrompt(null);
    clearCartDraft().catch(console.error);
  };

  const handleDiscardDraft = () => {
    setDraftPrompt(null);
    useCartStore.getState().clearCart();
    applyFreshOrderParams();
    clearCartDraft().catch(console.error);
  };

  // An existing order is read from the local view store, which POSLayout
  // rebuilds from IndexedDB on every full page load. Offline, every screen
  // change IS a full page load, so this screen mounted before the store was
  // filled, missed the order, fell back to the network, and opened
  // "Collect payment" on an empty PKR 0 cart. Wait for the store instead.
  const viewsReady = useViews((s) => s.isReady);
  const waitForViews =
    !!searchParams.get('orderId') && !searchParams.get('heldOrderId') &&
    searchParams.get('isHeld') !== 'true' && !viewsReady;

  // Strict Cart Mount Rules
  useEffect(() => {
    if (waitForViews) {
      useCartStore.getState().clearCart();
      return;
    }
    const existingOrderId = searchParams.get('orderId');
    const heldOrderIdParam = searchParams.get('heldOrderId');
    const isHeld = searchParams.get('isHeld') === 'true' || !!heldOrderIdParam;

    // Normalize the ID to use
    const idToLoad = heldOrderIdParam || existingOrderId;

    if (!idToLoad) {
      // RULE 1: FRESH ORDER — clear SYNCHRONOUSLY, first, always.
      //
      // This used to clear only inside loadCartDraft()'s `.then()`. An
      // IndexedDB read is not instant, so until it resolved the screen was
      // rendered AND interactive with the previous order still in the store —
      // its paymentOrderId, its existingItems, the lot. Tapping a menu item in
      // that window appended it to the order that had just been paid for. The
      // architecture's own rule is "new order (no orderId param) → ALWAYS
      // clearCart() on mount", and the async placement quietly broke it.
      useCartStore.getState().clearCart();
      applyFreshOrderParams();

      // Then offer to restore a draft saved for exactly this situation (a
      // break interruption, or a reload/crash mid-order). Cart items live only
      // in memory until ORDER_SENT_TO_KITCHEN, so this is the only durability
      // a not-yet-sent order has — but it's an offer, made on top of a clean
      // slate, not a reason to delay clearing one.
      loadCartDraft()
        .then((draft) => { if (draft?.cart?.length) setDraftPrompt(draft); })
        .catch(() => {});
      return;
    }

    // RULE 2 & 3: Clear first and get a new session ID
    useCartStore.getState().clearCart();
    const currentSessionId = useCartStore.getState().cartSessionId;

    if (isHeld) {
      // RULE 3: Load from local IndexedDB
      getDB().heldOrders.get(idToLoad).then(order => {
        if (useCartStore.getState().cartSessionId !== currentSessionId) return; // Stale fetch check
        if (!order) {
          toast.error('Held order not found');
          return;
        }
        // holdOrder() below also captures tableId/tableLabel/orderType — a
        // held dine-in order used to come back as "no table selected" with
        // no order type, forcing the cashier to redo everything except the
        // items (and re-tripping the CHARGE-greyed-out guard, since
        // canSubmitOrder requires orderType to be set).
        useCartStore.setState({
          cart: order.cart || [],
          orderType: order.orderType || 'DINE_IN',
          selectedTableId: order.tableId ?? null,
          selectedTableLabel: order.tableLabel ?? null,
        });
        useCartStore.getState().setSourceOrderId(order.id);
        setHeldOrderId(order.id);

        // After loading, delete the held order record so it cannot be double-loaded
        getDB().heldOrders.delete(order.id).catch(console.error);

        if (searchParams.get('checkout') === 'true') {
          setPaymentOrderId(order.id);
          openCheckout(order.id, order.orderNumber);
        }
      }).catch(() => toast.error('Failed to load local held order'));
    } else {
      // RULE 2: Load from the local view store first — an order created via
      // the event-sourced flow (lib/core/commands.ts) is keyed by its
      // permanent client id, which the server has never heard of until the
      // outbox's CREATE_ORDER task reconciles it (lib/core/views.ts's
      // reconcileServerId). Fetching `idToLoad` from the API before that
      // happens 404s — and the old code here didn't check res.ok, so it
      // quietly treated the 404 error body as an order with no items and no
      // type, which is why "Collect Payment" on a fresh order used to land
      // on an empty "no table selected" screen. Every order Tickets/Home can
      // link to is already in this store (that's what they render from), so
      // this is also just fewer round trips for the common case.
      // Tickets and Tables link by whichever id they hold; a synced order's
      // server id maps back to its local key here.
      const tracked = useViews.getState().orders[resolveLocalOrderId(idToLoad)];
      if (tracked) {
        useCartStore.setState({
          existingOrderData: tracked,
          existingItems: tracked.items.map((it) => ({
            id: it.lineId,
            itemId: it.itemId,
            itemName: it.itemName,
            quantity: it.qty,
            unitPrice: it.unitPrice,
            subtotal: it.qty * it.unitPrice,
            variationName: it.variationName,
            notes: it.note,
          })),
          orderType: tracked.type as any,
          selectedTableId: tracked.tableId || searchParams.get('tableId') || null,
          selectedTableLabel: tracked.tableLabel || searchParams.get('tableLabel') || null,
        });
        useCartStore.getState().setSourceOrderId(tracked.id);
        setPaymentOrderId(tracked.id);
        setPaymentOrderNumber(tracked.orderNumber);
        setOrderStatus(tracked.status);
        if (tracked.customerId) {
          useCartStore.getState().setCustomer({ id: tracked.customerId, name: tracked.customerName || 'Customer' });
        }
        if (searchParams.get('checkout') === 'true') {
          openCheckout(tracked.id, tracked.orderNumber);
        }
        return;
      }

      // Not tracked locally (e.g. a very old order from before this
      // terminal's view store existed) — fall back to the network.
      fetch(`${API_URL}/api/orders/${idToLoad}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      })
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then(order => {
          if (useCartStore.getState().cartSessionId !== currentSessionId) return; // Stale fetch check
          useCartStore.setState({
            existingOrderData: order,
            existingItems: order.items || [],
            orderType: order.type,
            selectedTableId: order.tableId || searchParams.get('tableId') || null,
            selectedTableLabel: order.table?.label || searchParams.get('tableLabel') || null,
          });
          useCartStore.getState().setSourceOrderId(order.id);
          setPaymentOrderId(order.id);
          setPaymentOrderNumber(order.orderNumber);
          setOrderStatus(order.status);
          if (order.customer) {
            useCartStore.getState().setCustomer({ id: order.customer.id, name: order.customer.name });
          } else if (order.customerId) {
            useCartStore.getState().setCustomer({ id: order.customerId, name: 'Customer' });
          }
          if (searchParams.get('checkout') === 'true') {
            openCheckout(order.id, order.orderNumber);
          }
        })
        .catch(() => toast.error(
          navigator.onLine === false
            ? 'This order isn’t on this terminal, and there’s no connection to load it.'
            : 'Failed to load order for editing',
        ));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, waitForViews]);

  // Guard against browser refresh/close
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (useCartStore.getState().cart.length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const categories = useMemo(() => groupByCategory(menuItems), [menuItems]);

  const filteredItems = useMemo(() => {
    let items = menuItems;
    if (activeCategoryId) {
      items = items.filter(i => i.categoryId === activeCategoryId);
    }
    if (debouncedSearch) {
      const lower = debouncedSearch.toLowerCase();
      items = items.filter(i => i.name.toLowerCase().includes(lower));
    }
    return items;
  }, [menuItems, activeCategoryId, debouncedSearch]);

  const cartQuantities = useMemo(() => cart.reduce<Record<string, number>>((quantities, item) => {
    quantities[item.itemId] = (quantities[item.itemId] ?? 0) + item.quantity;
    return quantities;
  }, {}), [cart]);

  const [selectedItem, setSelectedItem] = useState<CachedMenuItem | null>(null);

  const handleItemTap = (item: CachedMenuItem) => {
    if (item.isAvailable === false) return;
    if (item.variations?.length || item.addOns?.length) {
      setSelectedItem(item);
    } else {
      addItem({
        itemId: item.id,
        name: item.name,
        basePrice: item.basePrice,
        unitPrice: item.basePrice,
        selectedAddOns: [],
        image: item.image,
      });
    }
  };

  const [kitchenLoading, setKitchenLoading] = useState(false);
  // Fix #4: mutex for handleCharge to prevent double order creation
  const [chargeLoading, setChargeLoading] = useState(false);
  const [discountModalOpen, setDiscountModalOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);

  const setDiscount = useCartStore(s => s.setDiscount);
  const [orderNote, setOrderNote] = useState('');
  const [showKitchenNote, setShowKitchenNote] = useState(false);
  const guestCount = searchParams.get('guests') || '2';

  // Cart draft auto-save — debounced 300ms. Only for a brand-new,
  // not-yet-sent order: one already loaded from the server (paymentOrderId)
  // or from a held order already has its own persistence. This is what lets
  // "Take a Break" (POSTopBar.tsx) and an accidental reload hand the
  // in-progress order back on the restore prompt above, instead of losing it.
  useEffect(() => {
    const handler = setTimeout(() => {
      // An order that has left the builder — charged, sent to the kitchen, or
      // held — must DROP its draft, not just stop updating it.
      //
      // This guard used to sit at the top of the effect and skip it entirely,
      // which meant the clear branch below never ran once paymentOrderId was
      // set. handleCharge() sets it the moment CHARGE is tapped, so every
      // completed order left its items sitting in the single draft slot
      // forever — and the next brand-new order found them and offered to
      // "restore" the order that had just been paid for. That is exactly the
      // long-standing "previous order's items carry over to a new order"
      // report.
      if (paymentOrderId || heldOrderId) {
        clearCartDraft().catch(console.error);
        return;
      }
      if (draftPrompt) return; // a restore offer is on screen; don't race it
      if (cart.length > 0) {
        saveCartDraft({
          cart, orderType, selectedTableId, selectedTableLabel,
          customerId, customerName, notes: orderNote, reason: 'autosave',
        }).catch(console.error);
      } else {
        clearCartDraft().catch(console.error);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [cart, orderType, selectedTableId, selectedTableLabel, customerId, customerName, orderNote, paymentOrderId, heldOrderId, draftPrompt]);

  const activePaymentMethod = useCartStore(s => s.activePaymentMethod);
  const isCard = ['CARD', 'JAZZCASH', 'EASYPAISA', 'BANK_TRANSFER', 'ONLINE'].includes((activePaymentMethod || 'CASH').toUpperCase());
  
  const cashRate = session?.cashTaxEnabled !== false ? (session?.cashTaxRate ?? 0.05) : 0;
  const cardRate = session?.cardTaxEnabled !== false ? (session?.cardTaxRate ?? 0.17) : 0;
  const taxRate = isCard ? cardRate : cashRate;
  
  const baseLabel = isCard ? (session?.cardTaxLabel ?? 'Tax') : (session?.cashTaxLabel ?? 'Tax');
  const taxLabel = taxRate > 0 ? `${baseLabel} (${(taxRate * 100).toFixed(0)}%)` : baseLabel;

  // Fire-and-forget: printing (and the WebUSB device round-trip it can
  // involve) must never delay getting the cashier back to Home after a
  // successful order — a missing/unpaired printer previously blocked
  // this whole flow until the print attempt failed. Unchanged from the
  // original sendToKitchen — just factored out so both the online-success
  // path and the optimistic-reconciliation path below can call it.
  const printKOT = async (order: any, orderTypeStr: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY', sessionObj: any, cartItems: typeof cart, notes: string) => {
    try {
      const { useBrandingStore } = await import('@/lib/branding-store');
      const branding = useBrandingStore.getState().branding;
      let autoPrintKOT = true;
      try {
        const settings = JSON.parse(localStorage.getItem('pos_tenant_settings') || '{}');
        const branchLevel = branding?.branchKotAutoPrint ?? false;
        if (settings?.pos?.autoPrintKOT === false && !branchLevel) autoPrintKOT = false;
      } catch {}
      if (autoPrintKOT) {
        const { printDocument } = await import('@/lib/print.service');
        await printDocument('KOT', {
          orderNumber: order.orderNumber || order.id?.slice(-6),
          // Falls back to the permanent order number, never a placeholder —
          // this is the exact "kitchen ticket shows a bogus identity"
          // failure mode the whole event-sourced order-number change exists
          // to eliminate. tokenNumber itself isn't generated client-side
          // yet (Phase 1 only covers orderNumber), so for locally-created
          // orders this is what actually prints until that's added.
          tokenNumber: order.tokenNumber || order.orderNumber,
          type: orderTypeStr,
          cashierName: sessionObj.name || sessionObj.userId,
          tenantName: branding.restaurantName || 'Dineiz',
          branchName: sessionObj.branchName || 'Main Branch',
          items: cartItems.map(c => ({
            name: c.name,
            quantity: c.quantity,
            notes: c.notes,
            variationName: c.selectedVariation?.name,
            addOnNames: c.selectedAddOns?.map((a: any) => a.name),
            unitPrice: c.basePrice || 0,
            subtotal: (c.basePrice || 0) * c.quantity
          })),
          notes,
          createdAt: order.createdAt || new Date().toISOString(),
          subtotal: order.subtotal || 0,
          discountAmount: order.discountAmount || 0,
          taxAmount: order.taxAmount || 0,
          total: order.total || 0,
          paymentMethod: order.paymentMethod || 'CASH',
        });
      }
    } catch (printErr) {
      console.error('KOT Print failed', printErr);
      toast.error('Order sent, but KOT printing failed. Check printer connection in Settings.');
    }
  };

  const sendToKitchen = async () => {
    if (cart.length === 0) return;
    if (!canSubmitOrder) {
      toast.error(needsTable ? 'Select a table before sending this order to the kitchen.' : 'Select an order type before sending this order to the kitchen.');
      return;
    }

    const sessionObj = JSON.parse(localStorage.getItem('pos_session') ?? '{}');
    const shift = JSON.parse(localStorage.getItem('pos_shift') ?? '{}');
    const orderTypeStr = orderType || 'DINE_IN';
    const tableId = (selectedTableId && selectedTableId !== 'undefined') ? selectedTableId : null;
    const isHeld = searchParams.get('isHeld') === 'true';
    const rawOrderId = searchParams.get('orderId');
    const isActuallyEdit = !!paymentOrderId && !isHeld;
    const isAppending = isActuallyEdit && existingOrderData;

    const cartItems = cart;
    const notes = orderNote;

    // ── Adding items to an order already sent to the kitchen ──────────────
    // Event-sourced now: each extra item is an ITEM_ADDED event on the
    // existing order, shipped by the outbox's ADD_ITEMS op
    // (POST /api/orders/:serverId/items) with its own retry/dependency
    // handling. This replaces a direct fetch against `paymentOrderId`, which
    // 404'd whenever that id was still the order's local client id (the
    // common case — Tickets/Tables link to the local view-store order).
    // Works online, offline, and while the parent order is still syncing.
    if (isAppending) {
      setKitchenLoading(true);

      // The order must be in the view store for the reducer + outbox to act
      // on it. Every order Tickets/Tables can link to already is; only a
      // pre-view-store historical order (loaded via the network fallback)
      // needs seeding first.
      let targetId = paymentOrderId!;
      if (!useViews.getState().orders[targetId] && existingOrderData) {
        targetId = seedServerOrder(existingOrderData) || targetId;
      }

      // The kitchen needs the extra items the instant this is tapped — print
      // now, don't wait on the queue.
      printKOT(
        {
          orderNumber: existingOrderData?.orderNumber || paymentOrderNumber || `#${paymentOrderId?.slice(-6)}`,
          tokenNumber: existingOrderData?.tokenNumber,
          createdAt: new Date().toISOString(),
        },
        orderTypeStr, sessionObj, cartItems, notes,
      );

      try {
        await commands.appendItems(targetId, cartItems.map(item => ({
          itemId: item.itemId,
          itemName: item.name,
          variationId: item.selectedVariation?.id ?? null,
          variationName: item.selectedVariation?.name ?? null,
          qty: item.quantity,
          unitPrice: item.unitPrice,
          note: item.notes ?? null,
          addOns: item.selectedAddOns?.map(a => ({ id: a.id, name: a.name, price: a.price })) ?? null,
        })));

        setOrderNote('');
        toast.success('Items added — sending to kitchen');

        if (isHeld && rawOrderId) {
          try {
            const db = getDB();
            if (db.heldOrders) await db.heldOrders.delete(rawOrderId);
          } catch (e) { console.error('Failed to delete held order', e); }
        }

        clearCart();
        setDiscount(null);
        router.push('/pos/home');
      } catch (err) {
        console.error('Failed to append items', err);
        toast.error('Could not add the items — please retry.');
      } finally {
        setKitchenLoading(false);
      }
      return;
    }

    // ── Brand-new order — event-sourced / local-first ───────────────────────
    // createOrder() generates a permanent client-owned id + order number
    // (lib/core/event-log.ts's nextOrderNumber — terminal-scoped, never
    // reassigned) and appends it to the local event log immediately; the
    // ticket is painted onto Tickets/Home and the cashier is navigated away
    // before the network round trip resolves. Unlike the previous
    // "Sending…"/temp-number approach, this number is never swapped for a
    // different one once the background POST lands — the server doesn't
    // accept client-supplied ids yet (that's a later phase), so its
    // response id is recorded separately via reconcileServerId() purely so
    // later operations (payment, append-items) know what to PUT against.
    //
    // Shipping to the server is no longer done here — commands.sendToKitchen()
    // below queues an ORDER_SENT_TO_KITCHEN event, and the outbox
    // (lib/core/outbox.ts, started once in POSLayout) picks it up and POSTs
    // it — with retry/backoff/circuit-breaker — the moment it's queued,
    // whether or not this screen is still mounted to see it happen.
    const { orderId: localId, orderNumber } = await commands.createOrder({
      type: orderTypeStr,
      tableId,
      tableLabel: selectedTableLabel || undefined,
      notes,
    });
    for (const item of cartItems) {
      await commands.addItem(localId, {
        itemId: item.itemId,
        itemName: item.name,
        variationId: item.selectedVariation?.id ?? null,
        variationName: item.selectedVariation?.name ?? null,
        qty: item.quantity,
        unitPrice: item.unitPrice,
        note: item.notes ?? null,
        addOns: item.selectedAddOns?.map(a => ({ id: a.id, name: a.name, price: a.price })) ?? null,
      });
    }

    // The waiter parked on the cart becomes a real WAITER_ASSIGNED event now
    // that there is an order to attach it to. Through commands, so it applies
    // locally at once and the outbox ships it — this works offline.
    if (waiterId) {
      await commands.assignWaiter(localId, waiterId, waiterName, waiterColor);
    }
    await commands.sendToKitchen(localId);

    // Tickets/Home now read live orders straight from lib/core/views.ts
    // (populated synchronously by the commands above) — no separate
    // TanStack cache to paint here anymore, which also removes the class of
    // bug where that cache and the view store could disagree about an
    // order's real id.
    const localOrder = useViews.getState().orders[localId];

    // Print the KOT NOW, from data we already have — the kitchen needs the
    // ticket the instant this is tapped, not after a round trip to the
    // server. Everything printDocument needs (items, table, totals) is
    // already known client-side; only the real order number isn't, so it
    // prints with the temp one. This used to wait for the POST to resolve,
    // which silently reintroduced the exact "kitchen waits on the network"
    // problem this whole optimistic flow exists to remove.
    printKOT(localOrder ?? { orderNumber }, orderTypeStr, sessionObj, cartItems, notes);

    toast.success('Order sent to kitchen!');
    if (isHeld && rawOrderId) {
      try {
        const db = getDB();
        if (db.heldOrders) await db.heldOrders.delete(rawOrderId);
      } catch (e) { console.error('Failed to delete held order', e); }
    }
    setOrderNote('');
    clearCart();
    clearCartDraft().catch(console.error);
    setDiscount(null);
    router.push('/pos/home');
  };

  const holdOrder = async () => {
    if (cart.length === 0) return;

    const newHeldOrderId = heldOrderId || uuid();
    const heldOrder = {
      id: newHeldOrderId,
      tableId: selectedTableId,
      tableLabel: selectedTableLabel,
      orderType: orderType || 'DINE_IN',
      guests: searchParams.get('guests') || '1',
      cashierId: session.cashierId,
      cart: cart,
      heldAt: new Date().toISOString(),
    };

    try {
      const db = getDB();
      if (!db.heldOrders) throw new Error('heldOrders store not available');
      await db.heldOrders.put(heldOrder); 
      
      // Online sync if possible
      if (navigator.onLine && session.token) {
        fetch(`${API_URL}/api/orders/held`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.token}`,
          },
          body: JSON.stringify(heldOrder),
        }).catch(() => {
          // Ignore failures, it's saved locally
        });
      }

      clearCart();
      setHeldOrderId(null);
      toast.success('Order held. Find it in Tickets → On Hold');
      router.push('/pos/home');
    } catch (e) {
      toast.error('Could not hold order — local storage unavailable.');
    }
  };

  const startNewOrder = () => {
    if (cart.length > 0) {
      setConfirmNewOrderOpen(true);
      return;
    }
    executeStartNewOrder();
  };

  const executeStartNewOrder = () => {
    setConfirmNewOrderOpen(false);
    clearCart();
    setOrderNote('');
    router.push('/pos/home');
  };

  const handleCharge = async () => {
    if (cart.length === 0 && existingItems.length === 0) return;
    // Fix #4: mutex — prevent double-create
    if (chargeLoading) return;
    if (!canSubmitOrder) {
      toast.error(needsTable ? 'Select a table before charging this order.' : 'Select an order type before charging this order.');
      return;
    }

    if (!paymentOrderId) {
      // Local-first / event-sourced — same pattern sendToKitchen() uses below
      // for a brand-new order (commands.createOrder + commands.addItem), just
      // without commands.sendToKitchen() since charging directly deliberately
      // skips the kitchen. This replaces a raw, awaited fetch() straight to
      // POST /api/orders, which blocked the whole "Charge" tap on a network
      // round trip (the reported slow charge) and never registered the order
      // in useViews (the reported stale Home screen) — but the real damage
      // was downstream: PaymentModal's collectPayment() right after used the
      // server's raw id, which the view store had no record of under ANY key.
      // The PAYMENT_COLLECTED reducer silently no-ops on an unknown aggregate
      // (views.ts), and the outbox's deriveTaskChains then hits its "no task
      // producible" invariant and marks that event CONFIRMED locally without
      // ever shipping it — the cashier sees "Payment Successful" and the
      // money is simply never recorded server-side. Client-owned identity
      // from the moment of creation is what closes that gap.
      setChargeLoading(true);
      try {
        const orderTypeStr = orderType || 'DINE_IN';
        const tableId = (selectedTableId && selectedTableId !== 'undefined') ? selectedTableId : null;

        const { orderId: localId, orderNumber } = await commands.createOrder({
          type: orderTypeStr,
          tableId,
          tableLabel: selectedTableLabel || undefined,
          notes: orderNote,
        });
        for (const item of cart) {
          await commands.addItem(localId, {
            itemId: item.itemId,
            itemName: item.name,
            variationId: item.selectedVariation?.id ?? null,
            variationName: item.selectedVariation?.name ?? null,
            qty: item.quantity,
            unitPrice: item.unitPrice,
            note: item.notes ?? null,
            addOns: item.selectedAddOns?.map(a => ({ id: a.id, name: a.name, price: a.price })) ?? null,
          });
        }

        // The waiter parked on the cart becomes a real WAITER_ASSIGNED event now
        // that there is an order to attach it to. Through commands, so it applies
        // locally at once and the outbox ships it — this works offline.
        if (waiterId) {
          await commands.assignWaiter(localId, waiterId, waiterName, waiterColor);
        }

        setPaymentOrderId(localId);
        setPaymentOrderNumber(orderNumber);
        openCheckout(localId, orderNumber);

        const isHeld = searchParams.get('isHeld') === 'true';
        const rawOrderId = searchParams.get('orderId');
        if (isHeld && rawOrderId) {
          try {
            const db = getDB();
            if (db.heldOrders) {
              await db.heldOrders.delete(rawOrderId);
            }
          } catch (e) {
            console.error('Failed to delete held order on charge', e);
          }
        }
      } catch (err) {
        console.error('Failed to create order for charge', err);
        toast.error('Could not open payment — please retry.');
      } finally {
        setChargeLoading(false);
      }
    } else if (cart.length > 0) {
      // Existing order with un-sent items in the cart — fold them in as
      // ITEM_ADDED events (same event-sourced path as sendToKitchen's append),
      // then open payment. Local-first: the events write instantly and the
      // outbox ships the ADD_ITEMS op; PaymentModal reads the merged line list
      // from the view store.
      setChargeLoading(true);
      const isHeld = searchParams.get('isHeld') === 'true';
      const isActuallyEdit = !!paymentOrderId && !isHeld;
      try {
        if (isActuallyEdit && existingOrderData) {
          let targetId = paymentOrderId!;
          if (!useViews.getState().orders[targetId]) {
            targetId = seedServerOrder(existingOrderData) || targetId;
          }
          await commands.appendItems(targetId, cart.map(item => ({
            itemId: item.itemId,
            itemName: item.name,
            variationId: item.selectedVariation?.id ?? null,
            variationName: item.selectedVariation?.name ?? null,
            qty: item.quantity,
            unitPrice: item.unitPrice,
            note: item.notes ?? null,
            addOns: item.selectedAddOns?.map(a => ({ id: a.id, name: a.name, price: a.price })) ?? null,
          })));
        }
        openCheckout(paymentOrderId!, paymentOrderNumber);
      } catch (err) {
        console.error('Failed to append items before charge', err);
        toast.error('Could not add the items — please retry.');
      } finally {
        setChargeLoading(false);
      }
    } else {
      openCheckout(paymentOrderId!, paymentOrderNumber);
    }
  };

  const tableDisplay = selectedTableLabel ? `Table ${selectedTableLabel}` : 'No table selected';
  const orderTypeDisplay = orderType ? (orderType === 'DINE_IN' ? 'Dine-in' : orderType === 'TAKEAWAY' ? 'Takeaway' : 'Delivery') : 'No order type';
  const orderIdDisplay = paymentOrderId ? `Order #${paymentOrderId.slice(-6)}` : 'New Order';

  // A dine-in order must be tied to a table before it can be sent to the
  // kitchen or charged — this is the one rule every order-entry point
  // (Home's New Order/Takeaway cards, BottomNav's Menu tab) has to funnel
  // through, so it's enforced here once rather than per entry point.
  const needsTable = orderType === 'DINE_IN' && !selectedTableId;
  const canSubmitOrder = !!orderType && !needsTable;

  // Nothing on this order at all — neither already sent nor waiting to be.
  const orderEmpty = cart.length === 0 && existingItems.length === 0;

  const actionBtnCls =
    'h-11 border border-line-strong bg-surface text-ink rounded-lg text-[12px] font-bold ' +
    'flex items-center justify-center gap-1 shadow-sm transition-colors ' +
    'enabled:hover:bg-sunken disabled:opacity-40 disabled:cursor-not-allowed';

  // Dine-in/Takeaway/Delivery — shared by both places it renders (see
  // centerSlot below). At ~286px unwrapped, this doesn't fit POSTopBar's
  // center slot on a phone or tablet portrait (the header's left+right
  // slots already claim most of the width) — centerSlot only clips
  // overflow, it doesn't scroll it, so this was rendering with "Takeaway"/
  // "Delivery" silently cut off (phone) or tightly squeezed (~768px tablet)
  // with no way to reach the rest. Hidden in the header below lg; rendered
  // again, full-width and uncramped, inline in the page body.
  const orderTypeButtons = (
    <>
      <button
        onClick={() => {
          setOrderType('DINE_IN');
          // Nothing to lose yet — send straight to table selection, same
          // as Home's "New Order" card. If items are already in the cart
          // (order type changed mid-build), stay put and let the inline
          // banner below prompt for a table instead of risking losing them.
          if (!selectedTableId && cart.length === 0) {
            router.push('/pos/tables');
          }
        }}
        className={`flex-1 lg:flex-none min-h-11 px-3 sm:px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors ${orderType === 'DINE_IN' ? 'bg-white text-ink shadow-sm' : 'text-ink-3 hover:text-ink'}`}
      >Dine-in</button>
      <button onClick={() => setOrderType('TAKEAWAY')} className={`flex-1 lg:flex-none min-h-11 px-3 sm:px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors ${orderType === 'TAKEAWAY' ? 'bg-white text-ink shadow-sm' : 'text-ink-3 hover:text-ink'}`}>Takeaway</button>
      <button onClick={() => setOrderType('DELIVERY')} className={`flex-1 lg:flex-none min-h-11 px-3 sm:px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors ${orderType === 'DELIVERY' ? 'bg-white text-ink shadow-sm' : 'text-ink-3 hover:text-ink'}`}>Delivery</button>
    </>
  );

  useTopBar({
    // The header used to state the same three facts up to three times each: the
    // title said "New Order — No table selected", then a NEW ORDER pill, a
    // NO TABLE SELECTED pill, a TAKEAWAY pill and a GUESTS pill sat under it,
    // and the order-type segmented control beside it said the type a third
    // time. Each thing is said once now, in the place that can act on it: the
    // type in its own control, the table as a pill (only when it's a dine-in
    // concern), the party size only when it isn't the default of one.
    pageTitle: paymentOrderId ? 'Edit Order' : 'New Order',
    // One plain line, not a row of capital-letter pills: "Table T-4 ·
    // 2 guests", "Takeaway", or a warning in words when dine-in has no table.
    breadcrumb: (
      <span>
        {[
          paymentOrderId ? orderIdDisplay : null,
          orderType === 'DINE_IN' ? null : orderType === 'TAKEAWAY' ? 'Takeaway' : orderType === 'DELIVERY' ? 'Delivery' : null,
          orderType === 'DINE_IN' && selectedTableLabel ? tableDisplay : null,
          orderType === 'DINE_IN' && selectedTableLabel && parseInt(guestCount) > 1 ? `${guestCount} guests` : null,
        ].filter(Boolean).join(' · ')}
        {orderType === 'DINE_IN' && !selectedTableLabel && <span className="text-warn font-medium">No table chosen</span>}
      </span>
    ),
    showBackButton: true,
    backPath: '/pos/tables',
    centerSlot: (
      // lg, not sm: even with POSTopBar's left-slot width cap, this 3-button
      // group (~286px unwrapped) is still tight in the shared header at
      // tablet-portrait widths (~768px) once the avatar cluster also has its
      // share — the full-width inline copy below (lg:hidden) stays legible
      // through phone AND tablet portrait; only larger/landscape screens get
      // the compact header version.
      <div className="hidden lg:flex bg-sunken border border-line-strong p-1 rounded-xl">
        {orderTypeButtons}
      </div>
    )
    // No Hold here: the order panel has it, next to Clear. Two copies of the
    // same button a screen apart was part of what made this screen busy.
  });

  return (
    <div className="flex flex-col h-full select-none bg-canvas text-ink overflow-hidden font-body-md">
      <ConfirmModal
        isOpen={promptContinueOpen}
        title="Continue Order?"
        message={selectedTableLabel ? `Continue order for Table ${selectedTableLabel} or start a new order?` : 'Continue your existing order or start a new one?'}
        confirmText="Continue Order"
        cancelText="Start New Order"
        onConfirm={handleContinueOrder}
        onCancel={handleStartNewOrderFromPrompt}
      />
      <ConfirmModal
        isOpen={confirmNewOrderOpen}
        title="Clear Current Order?"
        message="Are you sure you want to clear the current order and start a new one? Unsaved items will be lost."
        confirmText="Clear Order"
        onConfirm={executeStartNewOrder}
        onCancel={() => setConfirmNewOrderOpen(false)}
      />
      <ConfirmModal
        isOpen={confirmClearOpen}
        title="Clear Cart?"
        message="Remove all items from this order?"
        confirmText="Clear"
        onConfirm={() => { clearCart(); setPaymentOrderId(null); setConfirmClearOpen(false); }}
        onCancel={() => setConfirmClearOpen(false)}
      />
      <ConfirmModal
        isOpen={!!draftPrompt}
        title="Restore In-Progress Order?"
        message={`You have ${draftPrompt?.cart?.length ?? 0} item(s) from an order that wasn't sent to the kitchen yet${draftPrompt?.selectedTableLabel ? ` (Table ${draftPrompt.selectedTableLabel})` : ''}.`}
        confirmText="Restore Order"
        cancelText="Start New Order"
        onConfirm={handleRestoreDraft}
        onCancel={handleDiscardDraft}
      />

      <main
        className="flex flex-col lg:flex-row flex-1 overflow-hidden"
        style={{ '--cart-width': `${cartWidthPercent}%` } as React.CSSProperties}
      >
        <MenuBrowser
          categories={categories} items={filteredItems} loading={menuLoading}
          search={searchQuery} onSearch={setSearchQuery}
          category={activeCategoryId} onCategory={setActiveCategoryId}
          view={viewMode} onView={handleViewChange}
          quantities={cartQuantities} onTap={handleItemTap}
          onAvailability={canToggleAvailability ? handleToggleAvailability : undefined}
          togglingId={togglingItemId} orderTypeControl={orderTypeButtons}
        />

        {/* A reserved footer, never a floating control covering the last item. */}
        {!orderEmpty && <div className="lg:hidden shrink-0 border-t border-line bg-surface p-3">
          <button onClick={() => setIsCartDrawerOpen(true)} className="flex h-13 w-full items-center justify-between gap-3 rounded-lg bg-ink px-4 text-white">
            <span className="flex items-center gap-3 text-sm font-semibold">
              <span className="grid min-w-7 h-7 place-items-center rounded-md bg-white/15 px-1.5 tabular-nums">{cart.reduce((sum, item) => sum + item.quantity, 0) + existingItems.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0)}</span>
              View order
            </span>
            <span className="text-base font-semibold tabular-nums">{formatPKR(combinedTotal)}</span>
          </button>
        </div>}

        {/* RESIZER HANDLE */}
        <div
          className="hidden lg:flex w-2 cursor-col-resize hover:bg-amber-100 active:bg-amber-200 items-center justify-center border-l border-r border-line z-50 shrink-0 relative transition-colors group"
          onPointerDown={(e) => { e.preventDefault(); setIsResizing(true); }}
        >
          <div className="w-0.5 h-10 bg-hover group-hover:bg-brand rounded-full transition-colors" />
          <div className="absolute inset-y-0 -left-2 -right-2 z-10 cursor-col-resize" />
        </div>

        <OrderPanel open={isCartDrawerOpen} onClose={() => setIsCartDrawerOpen(false)}>
          <button type="button" onClick={() => setIsCartDrawerOpen(false)} className="flex h-11 shrink-0 items-center justify-center gap-2 border-b border-line text-sm font-medium text-ink-2 lg:hidden"><X size={16} />Back to menu</button>
          {/* Header: what this order is, and who it's for / who serves it. */}
          <div className="px-4 pt-3.5 pb-3 border-b border-line shrink-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-baseline gap-2 min-w-0">
                <h2 className="text-[17px] font-semibold text-ink">{existingItems.length > 0 ? 'Order' : 'New order'}</h2>
                <span className="text-[13px] text-ink-3 tabular-nums whitespace-nowrap">
                  {(() => {
                    // Units, not lines: two of the same dish is "2 items".
                    const units =
                      cart.reduce((n, c) => n + (c.quantity || 0), 0) +
                      existingItems.reduce((n: number, c: any) => n + (c.quantity || 0), 0);
                    return units === 0 ? 'Empty' : `${units} ${units === 1 ? 'item' : 'items'}`;
                  })()}
                </span>
                {cart.length > 0 && existingItems.length > 0 && (
                  <span className="h-5 px-1.5 rounded-md bg-ok/10 text-ok text-[11px] font-semibold tabular-nums">
                    +{cart.reduce((acc, c) => acc + c.quantity, 0)} new
                  </span>
                )}
              </div>
              <button
                onClick={startNewOrder}
                className="h-11 px-2.5 rounded-lg text-[12.5px] font-semibold text-ink-3 hover:bg-sunken hover:text-ink flex items-center gap-1.5 shrink-0"
                title="Start a fresh order"
              >
                <Plus className="w-3.5 h-3.5" /> New
              </button>
            </div>

            {/* Customer and (dine-in) waiter, side by side: the same control
                twice, so there's one thing to learn. Customer feeds loyalty
                redemption in PaymentModal; waiter can be set while punching,
                not only from the floor plan once an order exists. */}
            <div className="mt-2.5 flex gap-2">
              {customerId ? (
                <div className="flex-1 min-w-0 h-11 pl-2 pr-1 flex items-center gap-2 rounded-lg bg-sunken border border-line">
                  <button onClick={() => setCustomerPickerOpen(true)} className="flex items-center gap-2 min-w-0 flex-1 text-left">
                    <span className="w-5 h-5 rounded-full bg-brand/15 text-brand grid place-items-center text-[10px] font-bold shrink-0">
                      {(customerName || 'C').charAt(0).toUpperCase()}
                    </span>
                    <span className="text-[13px] font-semibold text-ink truncate">{customerName || 'Customer'}</span>
                  </button>
                  <button onClick={() => setCustomer(null)} className="w-11 h-11 grid place-items-center rounded-md text-ink-4 hover:text-danger hover:bg-surface shrink-0" aria-label="Remove customer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setCustomerPickerOpen(true)}
                  className="flex-1 min-w-0 h-11 px-2.5 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-line-strong text-[13px] font-medium text-ink-3 hover:text-ink hover:border-ink-4 hover:bg-sunken"
                >
                  <UserPlus className="w-4 h-4 shrink-0" /> <span className="truncate">Customer</span>
                </button>
              )}

              {orderType === 'DINE_IN' && (
                waiterId ? (
                  <div className="flex-1 min-w-0 h-11 pl-2 pr-1 flex items-center gap-2 rounded-lg bg-sunken border border-line">
                    <button onClick={() => setWaiterPickerOpen(true)} className="flex items-center gap-2 min-w-0 flex-1 text-left">
                      <span
                        className="w-5 h-5 rounded-full grid place-items-center text-white text-[10px] font-bold shrink-0"
                        style={{ backgroundColor: waiterColor || 'var(--pos-text-secondary)' }}
                      >
                        {(waiterName || 'W').charAt(0).toUpperCase()}
                      </span>
                      <span className="text-[13px] font-semibold text-ink truncate">{waiterName}</span>
                    </button>
                    <button onClick={() => setWaiter(null)} className="w-11 h-11 grid place-items-center rounded-md text-ink-4 hover:text-danger hover:bg-surface shrink-0" aria-label="Remove waiter">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setWaiterPickerOpen(true)}
                    className="flex-1 min-w-0 h-11 px-2.5 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-line-strong text-[13px] font-medium text-ink-3 hover:text-ink hover:border-ink-4 hover:bg-sunken"
                  >
                    <ConciergeBell className="w-4 h-4 shrink-0" /> <span className="truncate">Waiter</span>
                  </button>
                )
              )}
            </div>
          </div>

          {/* What's blocking Kitchen/Charge, said once, in place. */}
          {!orderType && (
            <div className="mx-4 mt-3 px-3 py-2.5 rounded-lg bg-warn/10 border border-warn/30 flex items-center gap-2.5 shrink-0">
              <Info className="text-warn w-4 h-4 shrink-0" />
              <p className="text-[13px] font-medium text-ink-2">Choose dine-in, takeaway or delivery above.</p>
            </div>
          )}
          {needsTable && (
            <div className="mx-4 mt-3 pl-3 pr-1.5 py-1.5 rounded-lg bg-warn/10 border border-warn/30 flex items-center justify-between gap-2.5 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <Armchair className="text-warn w-4 h-4 shrink-0" />
                <p className="text-[13px] font-medium text-ink-2 truncate">Dine-in needs a table.</p>
              </div>
              <button
                onClick={() => router.push('/pos/tables')}
                className="h-11 px-3 rounded-md bg-ink text-white text-[12.5px] font-semibold shrink-0 hover:bg-ink-2"
              >
                Pick table
              </button>
            </div>
          )}

          {/* Lines. min-h-0 lets this flex child shrink so it scrolls instead
              of pushing the footer off the bottom (see the section note). */}
          <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
            {existingItems.length > 0 && (
              <div>
                <div className="px-4 pt-3 pb-1.5 flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-ink-3">Sent to kitchen</span>
                  <span className="text-[12px] text-ink-4 tabular-nums">
                    {existingItems.reduce((n: number, c: any) => n + (c.quantity || 0), 0)}
                  </span>
                </div>
                {existingItems.map((i: any, idx: number) => (
                  <div key={idx} className="px-4 py-2 flex items-center gap-3 border-b border-line last:border-b-0">
                    <span className="w-6 text-right text-[13px] font-semibold text-ink-3 tabular-nums shrink-0">{i.quantity}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] text-ink-2 truncate">{i.itemName || i.item?.name}</p>
                      {i.variationName && <p className="text-[12px] text-ink-4 truncate">{i.variationName}</p>}
                    </div>
                    <span className="text-[13.5px] text-ink-3 tabular-nums shrink-0">{formatPKR(i.subtotal || (i.quantity * i.unitPrice))}</span>
                    <button
                      onClick={() => setVoidSheetState({ isOpen: true, item: i })}
                      className="w-11 h-11 grid place-items-center rounded-md text-ink-4 hover:text-danger hover:bg-danger/10 shrink-0"
                      aria-label={`Void ${i.itemName || 'item'}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {cart.length > 0 && existingItems.length > 0 && (
              <div className="px-4 pt-4 pb-1.5">
                <span className="text-[12px] font-semibold text-ok">Adding now</span>
              </div>
            )}

            {cart.length === 0 && existingItems.length === 0 ? (
              <div className="h-full min-h-[180px] flex flex-col items-center justify-center text-center px-6">
                <ServiceIllustration kind="order" className="w-32 h-[102px] mb-2" />
                <p className="text-[14px] font-semibold text-ink">Nothing on this order yet</p>
                <p className="text-[13px] mt-1 max-w-[240px] text-ink-3">
                  {selectedTableLabel ? `Tap items on the menu to start ${selectedTableLabel}'s order.` : 'Tap items on the menu to add them.'}
                </p>
              </div>
            ) : (
              cart.map((cartItem, idx) => (
                <SwipeableCartItem
                  key={`${cartItem.itemId}-${idx}`}
                  cartItem={cartItem}
                  incrementItem={incrementItem}
                  decrementItem={decrementItem}
                  removeItem={removeItem}
                />
              ))
            )}
          </div>

          {/* Kitchen note */}
          {showKitchenNote && (
            <div className="px-4 py-3 border-t border-line shrink-0">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[12.5px] font-semibold text-ink-2">Kitchen note</span>
                <button
                  onClick={() => { setShowKitchenNote(false); setOrderNote(''); }}
                  className="w-11 h-11 grid place-items-center rounded-md text-ink-3 hover:bg-sunken hover:text-ink"
                  aria-label="Remove note"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <textarea
                value={orderNote}
                onChange={(e) => setOrderNote(e.target.value)}
                placeholder="e.g. No onions, extra spicy"
                className="w-full bg-surface border border-line-strong rounded-lg px-3 py-2 text-[14px] text-ink placeholder:text-ink-4 focus:outline-none focus:border-ink resize-none h-14"
              />
            </div>
          )}

          {/* Totals and actions */}
          <div className="border-t border-line px-4 pt-3 pb-4 shrink-0 bg-surface">
            <dl className="space-y-1 text-[13px]">
              <div className="flex justify-between text-ink-3">
                <dt>Subtotal</dt>
                <dd className="tabular-nums text-ink-2">{formatPKR(combinedSubtotal)}</dd>
              </div>
              {combinedTaxAmount > 0 && (
                <div className="flex justify-between text-ink-3">
                  <dt>{taxLabel}</dt>
                  <dd className="tabular-nums text-ink-2">{formatPKR(combinedTaxAmount)}</dd>
                </div>
              )}
              {discountAmount > 0 && (
                <div className="flex justify-between text-ok">
                  <dt>Discount</dt>
                  <dd className="tabular-nums">− {formatPKR(discountAmount)}</dd>
                </div>
              )}
              <div className="flex justify-between items-baseline pt-2 mt-1.5 border-t border-line">
                <dt className="text-[15px] font-semibold text-ink">Total</dt>
                <dd className="text-[22px] font-bold text-ink tabular-nums tracking-tight">{formatPKR(combinedTotal)}</dd>
              </div>
            </dl>

            {/* Tools: Discount and Note apply to the order, so they work while
                editing a sent order; Hold and Clear act on the cart, so they
                follow it. */}
            <div className="mt-3 grid grid-cols-4 gap-1.5">
              {[
                { label: 'Discount', Icon: Percent, onClick: () => setDiscountModalOpen(true), disabled: orderEmpty, active: discountAmount > 0 },
                { label: 'Note', Icon: NotebookPen, onClick: () => setShowKitchenNote(!showKitchenNote), disabled: orderEmpty, active: showKitchenNote || !!orderNote },
                { label: 'Hold', Icon: PauseCircle, onClick: holdOrder, disabled: cart.length === 0, active: false },
                { label: 'Clear', Icon: Trash2, onClick: () => setConfirmClearOpen(true), disabled: cart.length === 0, active: false },
              ].map(({ label, Icon, onClick, disabled, active }) => (
                <button
                  key={label}
                  onClick={onClick}
                  disabled={disabled}
                  className={`h-11 rounded-lg border text-[12.5px] font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    active ? 'border-brand/40 bg-brand/10 text-brand-strong' : 'border-line text-ink-2 enabled:hover:bg-sunken enabled:hover:text-ink'
                  }`}
                >
                  <Icon className="w-4 h-4" /> {label}
                </button>
              ))}
            </div>

            <div className="mt-2 flex gap-2">
              {(() => {
                const kitchenOff = cart.length === 0 || kitchenLoading || orderStatus === 'COMPLETED' || !canSubmitOrder;
                const chargeOff = (cart.length === 0 && existingItems.length === 0) || orderStatus === 'COMPLETED' || chargeLoading || !canSubmitOrder;
                const why = needsTable ? 'Pick a table first' : !orderType ? 'Choose an order type first' : undefined;
                return (
                  <>
                    <button
                      onClick={sendToKitchen}
                      title={why}
                      disabled={kitchenOff}
                      className="flex-1 h-12 rounded-xl bg-ink text-white text-[14px] font-semibold flex items-center justify-center gap-2 transition-colors enabled:hover:bg-ink-2 disabled:bg-sunken disabled:text-ink-4 disabled:cursor-not-allowed"
                    >
                      {kitchenLoading
                        ? <><Loader2 className="animate-spin w-4 h-4" /> Sending…</>
                        : <><ChefHat className="w-[18px] h-[18px]" /> {paymentOrderId ? 'Send again' : 'Send to kitchen'}</>}
                    </button>
                    <button
                      onClick={handleCharge}
                      title={why}
                      disabled={chargeOff}
                      className="flex-1 h-12 rounded-xl bg-brand text-on-brand text-[14px] font-semibold flex items-center justify-center gap-2 transition-colors enabled:hover:bg-brand-strong disabled:bg-sunken disabled:text-ink-4 disabled:cursor-not-allowed"
                    >
                      {chargeLoading
                        ? <><Loader2 className="animate-spin w-4 h-4" /> Opening…</>
                        : <>Charge <span className="tabular-nums">{formatPKR(combinedTotal)}</span></>}
                    </button>
                  </>
                );
              })()}
            </div>
          </div>
        </OrderPanel>
      </main>

      {/* Modals */}
      {selectedItem && <VariationPicker item={selectedItem} onClose={() => setSelectedItem(null)} />}
      {discountModalOpen && <DiscountModal onClose={() => setDiscountModalOpen(false)} />}

      {isPaymentOpen && checkout && (
        <PaymentModal
          orderId={checkout.orderId}
          orderNumber={checkout.orderNumber}
          orderTotal={searchParams.get('totalAmount') ? Number(searchParams.get('totalAmount')) : combinedTotal}
          // PaymentModal computes its own totals from `items` (falling back
          // to the cart store's `cart` when omitted) — for a "Collect
          // Payment" tap on an order that's already fully sent, `cart` is
          // empty (everything's in `existingItems`), which used to render
          // Subtotal/GST/Total Due as a flat PKR 0.00 regardless of the
          // real order total.
          items={checkout.items}
          orderItems={checkout.summary}
          tableLabel={searchParams.get('tableLabel') ?? undefined}
          tableId={searchParams.get('tableId') ?? undefined}
          customerId={existingOrderData?.customerId || useCartStore.getState().customerId || undefined}
          isOpen={isPaymentOpen}
          onClose={() => setIsPaymentOpen(false)}
          onSuccess={() => {
            // PaymentModal now shows the full receipt itself (see
            // components/PaymentModal.tsx / ReceiptView.tsx) and only calls
            // this once the cashier explicitly taps "Done" — it used to
            // push to /pos/receipt here, which fetched the order via a
            // relative '/api/...' URL that 404'd against the wrong origin,
            // so the receipt screen it landed on was permanently blank.
            setIsPaymentOpen(false);
            clearCart();
            setDiscount(null);
            setPaymentOrderId(null);
            // Belt and braces alongside the draft effect above: a paid order
            // must never be restorable.
            clearCartDraft().catch(console.error);
            router.push('/pos/home');
          }}
        />
      )}

      {voidSheetState.isOpen && (
        <VoidItemBottomSheet
          isOpen={voidSheetState.isOpen}
          item={voidSheetState.item}
          onClose={() => setVoidSheetState({ isOpen: false, item: null })}
          onSuccess={handleVoidSuccess}
          voidRequiresManagerApproval={branding?.pos?.voidRequiresManagerApproval ?? true}
        />
      )}

      <CustomerPickerSheet
        isOpen={customerPickerOpen}
        onClose={() => setCustomerPickerOpen(false)}
        onSelect={(c: PickedCustomer) => setCustomer({ id: c.id, name: c.name })}
      />

      {/* Pick mode — nothing is sent. The choice rides on the cart and is
          applied by sendToKitchen()/handleCharge() once the order exists. */}
      <AssignWaiterSheet
        isOpen={waiterPickerOpen}
        onClose={() => setWaiterPickerOpen(false)}
        branchId={session.branchId || ''}
        currentWaiterId={waiterId}
        tableLabel={selectedTableLabel || undefined}
        onPick={(w) => setWaiter(w)}
      />
    </div>
  );
}

import { Suspense } from 'react';
import { API_URL } from '@/lib/api';
import { Armchair, Banknote, ChefHat, GalleryVerticalEnd, Info, LayoutGrid, Loader2, Minus, NotebookPen, Pause, PauseCircle, Percent, Plus, Printer, Rows3, Search, ShoppingCart, Trash2, UserPlus, X, ConciergeBell } from 'lucide-react';

export default function OrderEntryPage() {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

  if (!isMounted) return (
    <div className="flex-1 flex items-center justify-center bg-[var(--pos-bg-base)] text-white h-full">
      <Loader2 className="animate-spin text-brand w-[36px] h-[36px]" />
    </div>
  );

  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center bg-[var(--pos-bg-base)] text-white h-full">
        <Loader2 className="animate-spin text-brand w-[36px] h-[36px]" />
      </div>
    }>
      <OrderEntryPageContent />
    </Suspense>
  );
}
