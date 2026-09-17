'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCartStore } from '@/lib/store';
import { useMenu, groupByCategory } from '@/hooks/useMenu';
import { useRouter, useSearchParams } from 'next/navigation';
import { VariationPicker, DiscountModal } from './components';
import type { CachedMenuItem } from '@/lib/db';
import { MenuItemCard, type ViewMode } from '@/components/MenuItemCard';
import { toast } from 'sonner';
import { getDB } from '@/lib/db';
import { v4 as uuid } from 'uuid';
import PaymentModal from '@/components/PaymentModal';
import { useTopBar } from '@/hooks/useTopBar';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { getToken } from '@/lib/pos-session';
import { VoidItemBottomSheet } from './VoidItemBottomSheet';
import * as commands from '@/lib/core/commands';
import { useViews, seedServerOrder } from '@/lib/core/views';
import { useBrandingStore } from '@/lib/branding-store';
import { formatPKR } from '@/lib/utils';
import { saveCartDraft, loadCartDraft, clearCartDraft } from '@/lib/core/drafts';
import { CustomerPickerSheet, type PickedCustomer } from '@/components/CustomerPickerSheet';
import { AssignWaiterSheet } from '@/app/pos/tables/AssignWaiterSheet';

function SwipeableCartItem({ cartItem, incrementItem, decrementItem, removeItem }: any) {
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [swiped, setSwiped] = useState(false);

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => setTouchEnd(e.targetTouches[0].clientX);

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) setSwiped(true);
    if (isRightSwipe) setSwiped(false);
  };

  return (
    <div className="relative overflow-hidden border-b border-line group bg-white">
      {/* Delete Background */}
      <div className="absolute inset-y-0 right-0 w-24 bg-rose-600 flex items-center justify-center">
        <button
          onClick={() => removeItem(cartItem.itemId, cartItem.selectedVariation?.id)}
          className="w-full h-full text-white font-bold flex flex-col items-center justify-center hover:bg-rose-700 transition-colors"
        >
          <Trash2 className="mb-1 w-[20px] h-[20px]" />
          <span className="text-[10px] uppercase tracking-wider">Delete</span>
        </button>
      </div>

      {/* Foreground Content */}
      <div
        className={`relative bg-white py-4 px-6 transition-transform duration-300 ease-out ${swiped ? '-translate-x-24' : 'translate-x-0'}`}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="flex justify-between items-start mb-2">
          <div>
            <h4 className="text-[16px] font-bold text-ink">{cartItem.name}</h4>
            {cartItem.selectedVariation?.name && (
              <span className="text-[13px] text-ink-3 font-medium">{cartItem.selectedVariation.name}</span>
            )}
          </div>
          <span className="font-mono text-[16px] font-bold text-ink">{formatPKR(cartItem.subtotal)}</span>
        </div>
        <div className="flex justify-between items-center mt-2">
          <div className="flex flex-wrap gap-2">
            {cartItem.selectedAddOns.map((addon: any) => (
              <span key={addon.id} className="bg-sunken border border-line-strong text-[11px] font-bold text-ink-2 px-2 py-0.5 rounded-md uppercase">
                +{addon.name}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            {/* h-11/w-11 (44px) — this pair is the single most-tapped control
                in the order flow; it was 28px, well under the touch-target
                minimum every other primary control in this file follows. */}
            <div className="flex items-center bg-canvas rounded-full border border-line-strong h-11 px-1">
              <button onClick={() => decrementItem(cartItem.itemId, cartItem.selectedVariation?.id)} className="w-11 h-11 flex items-center justify-center hover:bg-hover rounded-full text-ink shrink-0">
                <Minus className="w-[14px] h-[14px]" />
              </button>
              <span className="font-mono text-sm px-2 font-bold text-ink">{cartItem.quantity}</span>
              <button onClick={() => incrementItem(cartItem.itemId, cartItem.selectedVariation?.id)} className="w-11 h-11 flex items-center justify-center hover:bg-hover rounded-full text-ink shrink-0">
                <Plus className="w-[14px] h-[14px]" />
              </button>
            </div>
            {/* Desktop delete button */}
            <button
              onClick={() => removeItem(cartItem.itemId, cartItem.selectedVariation?.id)}
              className="w-9 h-9 hidden lg:flex items-center justify-center hover:bg-rose-50 rounded-full text-rose-600 border border-transparent hover:border-rose-200 transition-all"
            >
              <Trash2 className="w-[14px] h-[14px]" />
            </button>
          </div>
        </div>
      </div>
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

  const [cartWidthPercent, setCartWidthPercent] = useState(42);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    const savedWidth = localStorage.getItem('pos_cart_width_percent');
    if (savedWidth) setCartWidthPercent(parseFloat(savedWidth));
  }, []);

  useEffect(() => {
    if (!isResizing) return;
    const handlePointerMove = (e: PointerEvent) => {
      const newPercent = ((window.innerWidth - e.clientX) / window.innerWidth) * 100;
      if (newPercent > 25 && newPercent < 60) {
        setCartWidthPercent(newPercent);
      }
    };
    const handlePointerUp = (e: PointerEvent) => {
      setIsResizing(false);
      const newPercent = ((window.innerWidth - e.clientX) / window.innerWidth) * 100;
      if (newPercent > 25 && newPercent < 60) {
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

  // Strict Cart Mount Rules
  useEffect(() => {
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
      const tracked = useViews.getState().orders[idToLoad];
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
        .catch(() => toast.error('Failed to load order for editing'));
    }
  }, [searchParams]);

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

  // Two layouts. There were five, three of them reachable from a toggle above
  // the grid — a decision a cashier has to make mid-service that changes nothing
  // about the job. Grid for browsing by sight, list for a long menu you know by
  // name.
  // Both layouts are dense now that the card is text-first (see MenuItemCard's
  // header — 1 of 36 items in the seeded tenant has a photo, so an image-shaped
  // card meant two items visible on a phone out of thirty-six). Grid is the
  // fat-finger tablet layout; list packs more in and aligns the price column.
  const gridColsClass = viewMode === 'list'
    ? 'grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-1.5'
    : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-2';

  const [selectedItem, setSelectedItem] = useState<CachedMenuItem | null>(null);

  const handleItemTap = (item: CachedMenuItem) => {
    if (!item.isAvailable) return;
    if (item.variations && item.variations.length > 0) {
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
    if (cart.length === 0) return;
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
        className={`flex-1 sm:flex-none px-4 py-1.5 text-sm font-bold rounded-lg transition-colors ${orderType === 'DINE_IN' ? 'bg-white text-ink shadow-sm' : 'text-ink-3 hover:text-ink'}`}
      >Dine-in</button>
      <button onClick={() => setOrderType('TAKEAWAY')} className={`flex-1 sm:flex-none px-4 py-1.5 text-sm font-bold rounded-lg transition-colors ${orderType === 'TAKEAWAY' ? 'bg-white text-ink shadow-sm' : 'text-ink-3 hover:text-ink'}`}>Takeaway</button>
      <button onClick={() => setOrderType('DELIVERY')} className={`flex-1 sm:flex-none px-4 py-1.5 text-sm font-bold rounded-lg transition-colors ${orderType === 'DELIVERY' ? 'bg-white text-ink shadow-sm' : 'text-ink-3 hover:text-ink'}`}>Delivery</button>
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
    breadcrumb: (
      <div className="flex items-center gap-1.5">
        {paymentOrderId && (
          <span className="px-2 py-0.5 rounded-md bg-sunken border border-line text-[10px] font-bold text-ink-2 uppercase tracking-wider tabular-nums">
            {orderIdDisplay}
          </span>
        )}
        {orderType === 'DINE_IN' && (
          <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider ${selectedTableLabel ? 'bg-sunken border-line text-ink-2' : 'bg-warn/10 border-warn/30 text-warn'}`}>
            {tableDisplay}
          </span>
        )}
        {orderType === 'DINE_IN' && parseInt(guestCount) > 1 && (
          <span className="px-2 py-0.5 rounded-md bg-sunken border border-line text-[10px] font-bold text-ink-2 uppercase tracking-wider">
            {guestCount} guests
          </span>
        )}
      </div>
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
    ),
    rightActions: (
      <button
        onClick={holdOrder}
        disabled={cart.length === 0}
        className="flex items-center justify-center px-4 h-10 rounded-lg bg-sunken hover:bg-hover transition-colors border border-line-strong text-ink font-bold text-[13px] tracking-wide disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
      >
        <Pause className="mr-2 w-[18px] h-[18px]" />
        HOLD
      </button>
    )
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
        {/* LEFT - MENU BROWSER */}
        <section className="w-full lg:flex-1 flex flex-col bg-canvas relative overflow-hidden">
          {/* Order type — the lg:hidden counterpart of centerSlot above,
              here instead of squeezed into the shared header (see
              orderTypeButtons' own comment for why). */}
          <div className="lg:hidden shrink-0 px-3 pt-3">
            <div className="flex bg-sunken border border-line-strong p-1 rounded-xl">
              {orderTypeButtons}
            </div>
          </div>
          {/* Category Bar */}
          <div className="relative shrink-0">
            <div className="h-[52px] bg-white border-b border-line flex items-center px-4 gap-2 overflow-x-auto no-scrollbar relative z-10">
              <button
                onClick={() => setActiveCategoryId(null)}
                className={`px-4 h-11 rounded-full text-[14px] font-semibold whitespace-nowrap transition-colors ${!activeCategoryId ? 'bg-brand text-white shadow-sm' : 'border border-line-strong bg-canvas text-ink-3 hover:bg-sunken hover:text-ink'}`}
              >
                All
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategoryId(cat.id)}
                  className={`px-4 h-11 rounded-full text-[14px] font-semibold whitespace-nowrap transition-colors ${activeCategoryId === cat.id ? 'bg-brand text-white shadow-sm' : 'border border-line-strong bg-canvas text-ink-3 hover:bg-sunken hover:text-ink'}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
            {/* Fade right edge */}
            <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-canvas to-transparent pointer-events-none z-20" />
          </div>

          {/* Search Bar & View Toggle */}
          <div className="p-3 border-b border-line bg-canvas flex gap-2 items-center">
            {/* min-w-0 on both this wrapper and the <input> — flex items
                default to min-width:auto (their content's natural size, and
                a bare <input> has its own non-trivial intrinsic minimum),
                which silently overrode flex-1's ability to shrink and pushed
                this row ~80px past a 360px viewport, clipped by the section's
                overflow-hidden with no visible sign anything was cut off. */}
            <div className="flex-1 min-w-0 flex items-center gap-2 bg-white border border-line-strong rounded-xl px-4 h-11 transition-colors focus-within:border-brand shadow-sm">
              <Search className="text-ink-4 shrink-0 w-[18px] h-[18px]" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search menu items..."
                className="bg-transparent border-none outline-none text-[16px] text-ink flex-1 min-w-0 placeholder:text-ink-4"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="w-8 h-8 -mr-1 flex items-center justify-center text-ink-3 hover:text-ink transition-colors shrink-0">
                  <X className="w-[18px] h-[18px]" />
                </button>
              )}
            </div>

            {/* One toggle, two states — not a three-way segmented control for
                five layouts that all showed the same four facts. */}
            <button
              onClick={() => handleViewChange(viewMode === 'grid' ? 'list' : 'grid')}
              title={viewMode === 'grid' ? 'Switch to list' : 'Switch to grid'}
              aria-label={viewMode === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
              className="shrink-0 grid place-items-center w-11 h-11 rounded-xl border border-line-strong bg-surface text-ink-2 hover:bg-sunken hover:text-ink transition-colors"
            >
              {viewMode === 'grid' ? <Rows3 className="w-[18px] h-[18px]" /> : <LayoutGrid className="w-[18px] h-[18px]" />}
            </button>
          </div>

          {/* Menu Grid — "All" groups items under a category divider per
              section (a flat, undifferentiated grid of the whole menu was
              genuinely hard to scan mid-service); picking one category
              already narrows the grid to just that category, so a divider
              there would just repeat the category chip above it. */}
          <div className="flex-1 overflow-y-auto no-scrollbar p-3 pb-24 lg:pb-3">
            {menuLoading ? (
              // Mirrors the real tile, at the real height — a skeleton that
              // predicts a different shape than what arrives is just filler.
              <div className={`grid content-start ${gridColsClass}`}>
                {Array.from({ length: 18 }).map((_, i) => (
                  <div key={i} className="rounded-xl border border-line bg-surface min-h-[76px] p-2.5 flex flex-col justify-between animate-pulse">
                    <div className="h-3.5 bg-sunken rounded w-4/5" />
                    <div className="h-3 bg-sunken rounded w-1/3" />
                  </div>
                ))}
              </div>
            ) : !activeCategoryId ? (
              <div className="flex flex-col gap-7">
                {categories.map(cat => {
                  const catItems = filteredItems.filter(i => i.categoryId === cat.id);
                  if (catItems.length === 0) return null;
                  return (
                    <section key={cat.id}>
                      <div className="flex items-center gap-2.5 mb-3">
                        <h3 className="text-[13px] font-bold text-ink uppercase tracking-widest">{cat.name}</h3>
                        <span className="text-[12px] font-bold text-ink-4">{catItems.length}</span>
                        <div className="h-px flex-1 bg-hover" />
                      </div>
                      <div className={`grid content-start ${gridColsClass}`}>
                        {catItems.map(item => (
                          <MenuItemCard
                            key={item.id}
                            item={item}
                            cartQty={cart.filter(c => c.itemId === item.id).reduce((s, c) => s + c.quantity, 0)}
                            onTap={handleItemTap}
                            viewMode={viewMode}
                            onToggleAvailable={canToggleAvailability ? handleToggleAvailability : undefined}
                            isTogglingAvailable={togglingItemId === item.id}
                          />
                        ))}
                      </div>
                    </section>
                  );
                })}
                {filteredItems.length === 0 && (
                  <div className="text-center text-ink-4 py-10 font-medium">No menu items match your search.</div>
                )}
              </div>
            ) : (
              <div className={`grid content-start ${gridColsClass}`}>
                {filteredItems.map(item => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    cartQty={cart.filter(c => c.itemId === item.id).reduce((s, c) => s + c.quantity, 0)}
                    onTap={handleItemTap}
                    viewMode={viewMode}
                    onToggleAvailable={canToggleAvailability ? handleToggleAvailability : undefined}
                    isTogglingAvailable={togglingItemId === item.id}
                  />
                ))}
                {filteredItems.length === 0 && (
                  <div className="col-span-full text-center text-ink-4 py-10 font-medium">No menu items match your search.</div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Floating Mobile Cart Button */}
        <div className="lg:hidden absolute bottom-4 left-4 right-4 z-40">
          <button
            onClick={() => setIsCartDrawerOpen(true)}
            className="w-full bg-brand text-white h-14 rounded-2xl font-bold flex items-center justify-between px-6 shadow-lg active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center gap-3">
              <div className="bg-black/20 px-2.5 py-1 rounded-md text-sm shadow-inner flex items-center gap-1">
                {existingItems.length > 0 ? (
                  <>
                    {existingItems.reduce((acc, c) => acc + c.quantity, 0)}
                    {cart.length > 0 && (
                      <span className="text-green-300 font-black">+{cart.reduce((acc, c) => acc + c.quantity, 0)}</span>
                    )}
                  </>
                ) : (
                  cart.reduce((acc, c) => acc + c.quantity, 0)
                )}
              </div>
              <span className="tracking-wide">View Order</span>
            </div>
            <span className="text-lg tracking-tight">{formatPKR(combinedTotal)}</span>
          </button>
        </div>

        {/* Drawer overlay for mobile */}
        {isCartDrawerOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
            onClick={() => setIsCartDrawerOpen(false)}
          />
        )}

        {/* RESIZER HANDLE */}
        <div
          className="hidden lg:flex w-2 cursor-col-resize hover:bg-amber-100 active:bg-amber-200 items-center justify-center border-l border-r border-line z-50 shrink-0 relative transition-colors group"
          onPointerDown={(e) => { e.preventDefault(); setIsResizing(true); }}
        >
          <div className="w-0.5 h-10 bg-hover group-hover:bg-brand rounded-full transition-colors" />
          <div className="absolute inset-y-0 -left-2 -right-2 z-10 cursor-col-resize" />
        </div>

        {/* RIGHT - ORDER CART. overflow-hidden is load-bearing on mobile: this
            is `fixed`, so it escapes POSLayout's own overflow-hidden ancestor
            entirely (fixed positioning clips only to the viewport) — without
            its own overflow-hidden, a cart with enough items (or a keyboard-
            shortened viewport) could push the shrink-0 footer's KITCHEN/
            CHARGE buttons below the box's bottom edge and off the bottom of
            the screen with no way to scroll to them, since flex-shrink:0
            siblings don't yield space to the flex-1 item and nothing bounded
            the total. The flex-1 item below also needs min-h-0 for the same
            reason (see its comment). */}
        <section className={`
          fixed lg:relative inset-x-0 bottom-0 lg:inset-auto z-[110] lg:z-auto
          w-full lg:w-[var(--cart-width)] h-[85dvh] lg:h-auto shrink-0 flex flex-col bg-white overflow-hidden
          border-t lg:border-t-0 border-line
          transition-transform duration-300 ease-in-out
          ${isCartDrawerOpen ? 'translate-y-0' : 'translate-y-full lg:translate-y-0'}
          rounded-t-3xl lg:rounded-none shadow-2xl lg:shadow-none
        `}>
          {/* Mobile Drawer Handle */}
          <div className="w-full h-10 flex items-center justify-center lg:hidden cursor-pointer shrink-0 border-b border-line bg-canvas rounded-t-3xl" onClick={() => setIsCartDrawerOpen(false)}>
            <div className="w-12 h-1.5 bg-hover rounded-full" />
          </div>

          {/* Cart Header */}
          <div className="p-6 lg:p-6 pb-4 pt-4 lg:pt-6 bg-canvas border-b border-line shrink-0">
            <div className="flex justify-between items-start mb-1">
              <h2 className="text-[20px] font-bold text-ink flex items-center gap-2">
                Current Order
                {cart.length > 0 && existingItems.length > 0 && (
                  <span className="bg-ok text-white text-[12px] px-2 py-0.5 rounded-full font-bold shadow-sm animate-in zoom-in">
                    +{cart.reduce((acc, c) => acc + c.quantity, 0)}
                  </span>
                )}
              </h2>
              <button onClick={startNewOrder} className="bg-white text-ink-2 text-[12px] font-bold px-2.5 py-1 rounded border border-line-strong uppercase tracking-wider hover:bg-sunken transition-colors shadow-sm">New Order</button>
            </div>
            {/* Counts UNITS, not lines. It used to read `cart.length +
                existingItems.length`, so two of the same dish showed as
                "1 items total" — wrong number and wrong grammar. A cashier
                reading this back to a customer wants how many things are on
                the order. */}
            <p className="text-ink-3 text-[12px] font-medium mb-3">
              {(() => {
                const units =
                  cart.reduce((n, c) => n + (c.quantity || 0), 0) +
                  existingItems.reduce((n: number, c: any) => n + (c.quantity || 0), 0);
                if (units === 0) return 'No items added yet';
                return `${units} ${units === 1 ? 'item' : 'items'}`;
              })()}
            </p>

            {/* Customer attach — real customer search/create backed by
                /api/customers, wired to the same customerId PaymentModal
                already reads for loyalty point redemption. Previously
                there was no way to attach a customer to a walk-in order at
                all, so loyalty redemption only ever worked for orders that
                arrived pre-tagged (e.g. from WhatsApp/QR). */}
            {customerId ? (
              <div className="flex items-center justify-between gap-2 bg-white border border-line rounded-xl px-3 py-2">
                <button onClick={() => setCustomerPickerOpen(true)} className="flex items-center gap-2 min-w-0 text-left">
                  <div className="w-6 h-6 rounded-full bg-brand/10 flex items-center justify-center text-brand font-bold text-[10px] shrink-0">
                    {(customerName || 'C').charAt(0).toUpperCase()}
                  </div>
                  <span className="text-[13px] font-bold text-ink truncate">{customerName || 'Customer'}</span>
                </button>
                <button onClick={() => setCustomer(null)} className="text-ink-4 hover:text-danger transition-colors shrink-0" title="Remove customer">
                  <X className="w-[16px] h-[16px]" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCustomerPickerOpen(true)}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-line-strong text-ink-3 hover:text-ink hover:border-brand hover:bg-white text-[12px] font-bold transition-all"
              >
                <UserPlus className="w-[16px] h-[16px]" />
                Attach Customer
              </button>
            )}

            {/* Who's serving it.
                A dine-in order is usually taken by one person and rung up by
                another, and until now the only place to say so was the floor
                plan's table sheet — which needs an order to already exist, so
                it was impossible to answer the question at the moment it comes
                up: while punching. Dine-in only; a takeaway has no waiter.
                Deliberately built as the twin of the customer control above so
                there's one thing to learn, not two. */}
            {orderType === 'DINE_IN' && (
              <div className="mt-2">
                {waiterId ? (
                  <div className="flex items-center justify-between gap-2 bg-white border border-line rounded-xl px-3 py-2">
                    <button onClick={() => setWaiterPickerOpen(true)} className="flex items-center gap-2 min-w-0 text-left">
                      <div
                        className="w-6 h-6 rounded-full grid place-items-center text-white font-bold text-[10px] shrink-0"
                        style={{ backgroundColor: waiterColor || 'var(--pos-text-secondary)' }}
                      >
                        {(waiterName || 'W').charAt(0).toUpperCase()}
                      </div>
                      <span className="text-[13px] font-bold text-ink truncate">{waiterName}</span>
                    </button>
                    <button
                      onClick={() => setWaiter(null)}
                      className="text-ink-4 hover:text-danger transition-colors shrink-0"
                      title="Remove waiter"
                    >
                      <X className="w-[16px] h-[16px]" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setWaiterPickerOpen(true)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-line-strong text-ink-3 hover:text-ink hover:border-brand hover:bg-white text-[12px] font-bold transition-all"
                  >
                    <ConciergeBell className="w-[16px] h-[16px]" />
                    Assign Waiter
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Order-context warning — blocks Kitchen/Charge until resolved */}
          {!orderType && (
            <div className="mx-6 mt-4 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2.5 shrink-0">
              <Info className="text-amber-600 w-[20px] h-[20px]" />
              <p className="text-[13px] font-semibold text-brand-strong">Select Dine-in, Takeaway, or Delivery above to continue.</p>
            </div>
          )}
          {needsTable && (
            <div className="mx-6 mt-4 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-2.5 shrink-0">
              <div className="flex items-center gap-2.5">
                <Armchair className="text-amber-600 w-[20px] h-[20px]" />
                <p className="text-[13px] font-semibold text-brand-strong">This dine-in order needs a table.</p>
              </div>
              <button
                onClick={() => router.push('/pos/tables')}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[12px] font-bold transition-colors"
              >
                Select Table
              </button>
            </div>
          )}

          {/* Cart Items — min-h-0 overrides a flex item's default min-height:
              auto (= its content size), which would otherwise refuse to
              shrink below "every item unwrapped" and defeat both this
              overflow-y-auto and the parent's new overflow-hidden bound. */}
          <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar bg-white">
            {existingItems.length > 0 && (
              <div className="border-b border-line">
                <div className="bg-sunken px-6 py-2 border-b border-line flex justify-between items-center">
                  <span className="text-[12px] font-bold text-ink-3 uppercase tracking-wider">Already in Order</span>
                  <span className="bg-hover text-ink-2 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">Sent</span>
                </div>
                {existingItems.map((i: any, idx: number) => (
                  <div key={idx} className="px-6 py-3 border-b border-line last:border-b-0 bg-canvas">
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <h4 className="text-[14px] font-semibold text-ink-3">{i.quantity}x {i.itemName || i.item?.name}</h4>
                        {i.variationName && <span className="text-[12px] text-ink-4">{i.variationName}</span>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[14px] text-ink-3">{formatPKR(i.subtotal || (i.quantity * i.unitPrice))}</span>
                        <button
                          onClick={() => setVoidSheetState({ isOpen: true, item: i })}
                          className="w-8 h-8 flex items-center justify-center rounded-full text-rose-500 hover:bg-rose-100 transition-colors"
                        >
                          <Trash2 className="w-[14px] h-[14px]" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {cart.length > 0 && existingItems.length > 0 && (
              <div className="bg-canvas px-6 py-2 border-b border-line">
                <span className="text-[12px] font-bold text-ink uppercase tracking-wider">Adding Now</span>
              </div>
            )}

            {cart.length === 0 && existingItems.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-ink-4">
                <ShoppingCart className="mb-4 text-ink-4 w-[48px] h-[48px]" />
                <p className="font-bold text-lg text-ink">Your cart is empty</p>
                {/* `selectedTableId` — a raw UUID — used to be interpolated
                    straight into this sentence, so a dine-in order read "for
                    Table cmsuv8x…" and a takeaway one read "for Table ." with a
                    dangling full stop. Use the label, and only when there is one. */}
                <p className="text-sm mt-1 max-w-[240px] text-ink-3">
                  {selectedTableLabel
                    ? `Pick items from the menu to start Table ${selectedTableLabel}'s order.`
                    : 'Pick items from the menu to start this order.'}
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

          {/* Order Note */}
          {showKitchenNote && (
            <div className="px-6 py-4 bg-canvas shrink-0 border-t border-line animate-in slide-in-from-bottom-2">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-bold text-ink">Kitchen Note</span>
                <button
                  onClick={() => { setShowKitchenNote(false); setOrderNote(''); }}
                  className="text-ink-3 hover:text-ink transition-colors"
                >
                  <X className="w-[14px] h-[14px]" />
                </button>
              </div>
              <textarea
                value={orderNote}
                onChange={(e) => setOrderNote(e.target.value)}
                placeholder="Add special instructions for the kitchen..."
                className="w-full bg-white border border-line-strong rounded-lg p-3 text-sm text-ink placeholder:text-ink-4 focus:outline-none focus:border-brand transition-colors resize-none h-16 shadow-sm"
              />
            </div>
          )}

          {/* Cart Footer / Totals */}
          <div className="bg-canvas border-t border-line p-6 space-y-4 shrink-0">
            <div className="space-y-2 text-sm text-ink-3 font-medium">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="text-ink font-semibold">{formatPKR(combinedSubtotal)}</span>
              </div>
              {combinedTaxAmount > 0 && (
                <div className="flex justify-between">
                  <span>{taxLabel}</span>
                  <span className="text-ink font-semibold">{formatPKR(combinedTaxAmount)}</span>
                </div>
              )}
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Discount</span>
                  <span>- {formatPKR(discountAmount)}</span>
                </div>
              )}
            </div>

            <div className="flex justify-between items-end pt-2 border-t border-line">
              <span className="text-[16px] font-bold uppercase tracking-wider text-ink">Order Total</span>
              <div className="text-right">
                <p className="text-brand text-[36px] font-extrabold leading-none">{formatPKR(combinedTotal)}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-4">
              <div className="grid grid-cols-4 gap-2">
                <button className="h-11 border border-line-strong bg-white text-ink rounded-lg text-[12px] font-bold flex items-center justify-center gap-1 hover:bg-sunken transition-colors shadow-sm" onClick={() => setDiscountModalOpen(true)}>
                  <Percent className="w-[14px] h-[14px]" /> Discount
                </button>
                <button className={`h-11 border rounded-lg text-[12px] font-bold flex items-center justify-center gap-1 transition-colors shadow-sm ${showKitchenNote || orderNote ? 'border-brand bg-amber-50 text-brand' : 'border-line-strong bg-white text-ink hover:bg-sunken'}`} onClick={() => setShowKitchenNote(!showKitchenNote)}>
                  <NotebookPen className="w-[14px] h-[14px]" /> Note
                </button>
                <button className="h-11 border border-line-strong bg-white text-ink rounded-lg text-[12px] font-bold flex items-center justify-center gap-1 hover:bg-sunken transition-colors shadow-sm" onClick={() => {
                  if (cart.length === 0) return;
                  setConfirmClearOpen(true);
                }}>
                  <Trash2 className="w-[14px] h-[14px]" /> Clear
                </button>
                <button className="h-11 border border-line-strong bg-white text-ink rounded-lg text-[12px] font-bold flex items-center justify-center gap-1 hover:bg-sunken transition-colors shadow-sm" onClick={holdOrder}>
                  <PauseCircle className="w-[14px] h-[14px]" /> Hold
                </button>
              </div>

              <div className="flex gap-2 h-14 mt-2">
                <button
                  onClick={sendToKitchen}
                  title={needsTable ? 'Select a table first' : !orderType ? 'Select an order type first' : undefined}
                  disabled={cart.length === 0 || kitchenLoading || orderStatus === 'COMPLETED' || !canSubmitOrder}
                  className={`flex-1 h-[52px] rounded-xl font-bold text-[14px] flex items-center justify-center gap-2 transition-all shadow-sm ${cart.length === 0 || kitchenLoading || orderStatus === 'COMPLETED' || !canSubmitOrder
                      ? 'bg-hover text-ink-4 cursor-not-allowed'
                      : paymentOrderId
                        ? 'bg-sunken border border-line-strong text-ink cursor-pointer hover:bg-hover'
                        : 'bg-sunken border border-line-strong text-ink cursor-pointer hover:bg-hover'
                    }`}
                >
                  {kitchenLoading ? (
                    <><Loader2 className="animate-spin w-[18px] h-[18px]" /> SENDING...</>
                  ) : (
                    <><Printer className="w-[18px] h-[18px]" /> {paymentOrderId ? 'RE-SEND' : 'KITCHEN'}</>
                  )}
                </button>
                <button
                  onClick={handleCharge}
                  title={needsTable ? 'Select a table first' : !orderType ? 'Select an order type first' : undefined}
                  disabled={cart.length === 0 || chargeLoading || !canSubmitOrder}
                  style={{
                    flex: 1,
                    height: '52px',
                    borderRadius: '12px',
                    border: 'none',
                    cursor: (cart.length > 0 && !chargeLoading && canSubmitOrder) ? 'pointer' : 'not-allowed',
                    backgroundColor: (cart.length > 0 && !chargeLoading && canSubmitOrder) ? 'var(--pos-primary, #F59E0B)' : '#E2E8F0',
                    color: (cart.length > 0 && !chargeLoading && canSubmitOrder) ? 'white' : '#94A3B8',
                    fontSize: '14px',
                    fontWeight: 700,
                    opacity: (cart.length > 0 && !chargeLoading && canSubmitOrder) ? 1 : 0.5,
                    boxShadow: (cart.length > 0 && !chargeLoading && canSubmitOrder) ? '0 4px 14px rgba(245,158,11,0.35)' : 'none',
                    transition: 'all 0.15s ease',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  }}
                >
                  {chargeLoading
                    ? <><Loader2 className="animate-spin w-[18px] h-[18px]" /> CREATING...</>
                    : <><Banknote className="w-[18px] h-[18px]" /> CHARGE</>
                  }
                </button>
              </div>
            </div>
          </div>
        </section>
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
import { Armchair, Banknote, GalleryVerticalEnd, Info, LayoutGrid, Loader2, Minus, NotebookPen, Pause, PauseCircle, Percent, Plus, Printer, Rows3, Search, ShoppingCart, Trash2, UserPlus, X, ConciergeBell } from 'lucide-react';

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
