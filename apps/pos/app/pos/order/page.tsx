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
import { queueOfflineOrder, queueItemAdd } from '@/lib/offlineHelpers';
import { registerOrderSync } from '@/lib/syncRegistration';
import { CustomerPickerSheet, type PickedCustomer } from '@/components/CustomerPickerSheet';

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
    <div className="relative overflow-hidden border-b border-[#E2E8F0] group bg-white">
      {/* Delete Background */}
      <div className="absolute inset-y-0 right-0 w-24 bg-rose-600 flex items-center justify-center">
        <button
          onClick={() => removeItem(cartItem.itemId, cartItem.selectedVariation?.id)}
          className="w-full h-full text-white font-bold flex flex-col items-center justify-center hover:bg-rose-700 transition-colors"
        >
          <span className="material-symbols-outlined mb-1">delete</span>
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
            <h4 className="text-[16px] font-bold text-[#0F172A]">{cartItem.name}</h4>
            {cartItem.selectedVariation?.name && (
              <span className="text-[13px] text-[#64748B] font-medium">{cartItem.selectedVariation.name}</span>
            )}
          </div>
          <span className="font-mono text-[16px] font-bold text-[#0F172A]">PKR {cartItem.subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center mt-2">
          <div className="flex flex-wrap gap-2">
            {cartItem.selectedAddOns.map((addon: any) => (
              <span key={addon.id} className="bg-[#F1F5F9] border border-[#CBD5E1] text-[11px] font-bold text-[#475569] px-2 py-0.5 rounded-md uppercase">
                +{addon.name}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            <div className="flex items-center bg-[#F8FAFC] rounded-full border border-[#CBD5E1] h-9 px-1">
              <button onClick={() => decrementItem(cartItem.itemId, cartItem.selectedVariation?.id)} className="w-7 h-7 flex items-center justify-center hover:bg-[#E2E8F0] rounded-full text-[#0F172A]">
                <span className="material-symbols-outlined text-sm">remove</span>
              </button>
              <span className="font-mono text-sm px-3 font-bold text-[#0F172A]">{cartItem.quantity}</span>
              <button onClick={() => incrementItem(cartItem.itemId, cartItem.selectedVariation?.id)} className="w-7 h-7 flex items-center justify-center hover:bg-[#E2E8F0] rounded-full text-[#0F172A]">
                <span className="material-symbols-outlined text-sm">add</span>
              </button>
            </div>
            {/* Desktop delete button */}
            <button
              onClick={() => removeItem(cartItem.itemId, cartItem.selectedVariation?.id)}
              className="w-9 h-9 hidden lg:flex items-center justify-center hover:bg-rose-50 rounded-full text-rose-600 border border-transparent hover:border-rose-200 transition-all"
            >
              <span className="material-symbols-outlined text-sm">delete</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// OrderItem.options is a free-form JSON snapshot (packages/db/prisma/schema.prisma)
// deliberately taken at order time so a later menu price/name edit never
// changes a historical order. It previously only stored the variation ID
// (no name) and dropped addons entirely, so receipts/KOTs had nothing to
// render for them. This is the single shape every order-item payload in this
// file should use — matches what ClientTableMap.tsx / receipt/page.tsx / the
// print templates already read from a fetched order.
function buildItemOptions(item: { selectedVariation?: { id: string; name: string }; selectedAddOns?: { id: string; name: string; price: number }[] }) {
  const hasVariation = !!item.selectedVariation;
  const hasAddOns = !!item.selectedAddOns?.length;
  if (!hasVariation && !hasAddOns) return undefined;
  return {
    variation: hasVariation ? { id: item.selectedVariation!.id, name: item.selectedVariation!.name } : undefined,
    addOns: hasAddOns ? item.selectedAddOns!.map(a => ({ id: a.id, name: a.name, price: a.price })) : undefined,
  };
}

function OrderEntryPageContent() {
  const router = useRouter();
  const session = useCartStore(s => s.session);
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

  const setExistingOrderData = useCartStore(s => s.setExistingOrderData);
  const setExistingItems = useCartStore(s => s.setExistingItems);

  // Auto-refresh existing order to sync remote void approvals and KDS status
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (paymentOrderId) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/orders/${paymentOrderId}`, {
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
      const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
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
    const saved = localStorage.getItem('pos_view_mode') as ViewMode | null;
    if (saved) setViewMode(saved);
  }, []);

  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('pos_view_mode', mode);
  };

  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);

  const [confirmNewOrderOpen, setConfirmNewOrderOpen] = useState(false);
  // Fix #5: clear-cart confirmation via ConfirmModal instead of confirm()
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const [heldOrderId, setHeldOrderId] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState<string | null>(null);

  // Strict Cart Mount Rules
  useEffect(() => {
    const existingOrderId = searchParams.get('orderId');
    const heldOrderIdParam = searchParams.get('heldOrderId');
    const isHeld = searchParams.get('isHeld') === 'true' || !!heldOrderIdParam;
    
    // Normalize the ID to use
    const idToLoad = heldOrderIdParam || existingOrderId;

    if (!idToLoad) {
      // RULE 1: FRESH ORDER
      useCartStore.getState().clearCart();
      const type = searchParams.get('type');
      if (type) {
        const uppercaseType = type.toUpperCase().replace('-', '_');
        useCartStore.setState({ orderType: uppercaseType as any });
      }
      const tId = searchParams.get('tableId');
      const tLabel = searchParams.get('tableLabel');
      if (tId) useCartStore.setState({ selectedTableId: tId });
      if (tLabel) useCartStore.setState({ selectedTableLabel: tLabel });
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
        useCartStore.setState({ cart: order.cart || [] });
        useCartStore.getState().setSourceOrderId(order.id);
        setHeldOrderId(order.id);
        
        // After loading, delete the held order record so it cannot be double-loaded
        getDB().heldOrders.delete(order.id).catch(console.error);

        if (searchParams.get('checkout') === 'true') {
          setPaymentOrderId(order.id);
          setIsPaymentOpen(true);
        }
      }).catch(() => toast.error('Failed to load local held order'));
    } else {
      // RULE 2: Load from API
      fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/orders/${idToLoad}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      })
        .then(r => r.json())
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
            setIsPaymentOpen(true);
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

  const gridColsClass = viewMode === 'compact' ? 'grid-cols-1' :
    viewMode === 'detailed' ? 'grid-cols-1 xl:grid-cols-2 gap-4' :
      viewMode === 'large' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3' :
        viewMode === 'minimal' ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-2' :
          'grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4';

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
          tokenNumber: order.tokenNumber || 'NEW',
          type: orderTypeStr,
          cashierName: sessionObj.cashierName || sessionObj.userId,
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
    // Kept synchronous (not optimistic) — the kitchen may already be
    // cooking this order, so we don't assume the append succeeded until
    // the server confirms it. What changes here vs. before: a failure
    // while offline is now queued for retry instead of just failing.
    if (isAppending) {
      setKitchenLoading(true);
      const body = JSON.stringify({
        items: cartItems.map(item => ({
          itemId: item.itemId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.unitPrice * item.quantity,
          options: buildItemOptions(item),
          notes: item.notes ?? undefined,
        }))
      });

      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/orders/${paymentOrderId}/items`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`,
          },
          body,
        });
        if (!res.ok) throw new Error(await res.text());

        const order = await res.json();
        setOrderNote('');
        toast.success(`Order #${order.orderNumber || order.id?.slice(-6) || 'sent'} updated!`);
        printKOT(order, orderTypeStr, sessionObj, cartItems, notes);

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
        const isOffline = !navigator.onLine || (err as Error).message === 'offline';
        if (isOffline) {
          try {
            await queueItemAdd({ orderId: paymentOrderId!, body });
            toast.success('No connection — items saved locally and will sync automatically.');
            clearCart();
            setDiscount(null);
            router.push('/pos/home');
          } catch (queueErr) {
            console.error('Failed to queue item add', queueErr);
            toast.error('Failed to save items offline. Please retry.');
          }
        } else {
          toast.error('Failed to send order. Check connection.');
        }
      } finally {
        setKitchenLoading(false);
      }
      return;
    }

    // ── Brand-new order — local-first / optimistic ─────────────────────────
    // Paint the ticket onto Tickets/Home instantly and navigate away before
    // the network round trip resolves; reconcile the temp id/order number
    // once the POST actually lands, in the background.
    const localId = uuid();
    const optimisticOrder = {
      id: localId,
      orderNumber: 'Sending…',
      tokenNumber: null,
      status: 'IN_KITCHEN',
      type: orderTypeStr,
      tableId,
      tableLabel: selectedTableLabel || undefined,
      items: cartItems.map(c => ({
        id: `${localId}-${c.itemId}`,
        itemId: c.itemId,
        name: c.name,
        quantity: c.quantity,
        unitPrice: c.unitPrice,
        subtotal: c.subtotal,
        item: { name: c.name },
      })),
      subtotal,
      taxAmount,
      discountAmount,
      netAmount: total,
      totalAmount: subtotal,
      total,
      notes,
      createdAt: new Date().toISOString(),
      cashierId: sessionObj.userId || sessionObj.cashierId,
      shiftId: shift.shiftId ?? null,
    };

    // Prepend even if this query has no data yet (e.g. its first-ever fetch
    // never landed because we're fully offline) — otherwise the ticket
    // would silently fail to appear anywhere until a later successful sync.
    menuQueryClient.setQueriesData({ queryKey: ['swr-active-orders'] }, (old: any) =>
      [optimisticOrder, ...(Array.isArray(old) ? old : [])]
    );

    toast.success('Order sent to kitchen!');
    if (isHeld && rawOrderId) {
      try {
        const db = getDB();
        if (db.heldOrders) await db.heldOrders.delete(rawOrderId);
      } catch (e) { console.error('Failed to delete held order', e); }
    }
    setOrderNote('');
    clearCart();
    setDiscount(null);
    router.push('/pos/home');

    const body = JSON.stringify({
      type: orderTypeStr,
      tableId,
      branchId: sessionObj.branchId,
      tenantId: sessionObj.tenantId,
      cashierId: sessionObj.userId || sessionObj.cashierId,
      shiftId: shift.shiftId ?? null,
      items: cartItems.map(item => ({
        itemId: item.itemId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.unitPrice * item.quantity,
        options: buildItemOptions(item),
        notes: item.notes ?? undefined,
      })),
      totalAmount: subtotal,
      taxAmount,
      discountAmount,
      netAmount: total,
      notes,
      status: 'IN_KITCHEN',
    });

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
        },
        body,
      });
      if (!res.ok) throw new Error(await res.text());

      const order = await res.json();
      // Reconcile: swap the temp ticket for the real one wherever it landed.
      menuQueryClient.setQueriesData({ queryKey: ['swr-active-orders'] }, (old: any) =>
        Array.isArray(old) ? old.map((o: any) => (o.id === localId ? { ...optimisticOrder, ...order } : o)) : old
      );
      printKOT(order, orderTypeStr, sessionObj, cartItems, notes);
    } catch (err) {
      // Never silently drop an order the cashier already walked away from —
      // queue it the same way an upfront-detected offline failure already
      // does, regardless of whether navigator.onLine agrees (a request can
      // fail for reasons other than being offline, e.g. a cold Neon DB
      // timing out). The ticket already on screen gets removed and
      // re-added via the offline queue's own sync, so the visible list
      // stays consistent with what's actually pending.
      menuQueryClient.setQueriesData({ queryKey: ['swr-active-orders'] }, (old: any) =>
        Array.isArray(old) ? old.filter((o: any) => o.id !== localId) : old
      );

      let offlineModeEnabled = true;
      try {
        const settings = JSON.parse(localStorage.getItem('pos_tenant_settings') || '{}');
        if (settings?.pos?.offlineMode === false) offlineModeEnabled = false;
      } catch {}

      if (!offlineModeEnabled) {
        toast.error('Order failed to send and offline mode is off — please check with a manager.');
        return;
      }

      try {
        await queueOfflineOrder({
          tenantId: sessionObj.tenantId,
          branchId: sessionObj.branchId,
          cashierId: sessionObj.userId || sessionObj.cashierId || 'cashier-1',
          shiftId: shift.shiftId ?? undefined,
          type: (orderTypeStr as 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY'),
          tableId: tableId ?? undefined,
          subtotal,
          discountAmount,
          taxAmount,
          total,
          notes,
          items: cartItems.map(item => ({
            itemId: item.itemId,
            itemName: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            variationId: item.selectedVariation?.id,
            addonIds: item.selectedAddOns?.map((a) => a.id),
            notes: item.notes,
          })),
        });
        await registerOrderSync();
        toast.info('Order could not reach the server — saved locally and will sync automatically.');
      } catch (queueErr) {
        console.error('Failed to queue offline order', queueErr);
        toast.error('Order failed to send and could not be saved offline. Please check with a manager.');
      }
    }
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
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/orders/held`, {
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
      setChargeLoading(true);
      try {
        const sessionObj = JSON.parse(localStorage.getItem('pos_session') ?? '{}');
        const shift = JSON.parse(localStorage.getItem('pos_shift') ?? '{}');
        const orderTypeStr = orderType || 'DINE_IN';
        const tableId = selectedTableId;

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`,
          },
          body: JSON.stringify({
            type: orderTypeStr,
            tableId: (tableId && tableId !== 'undefined') ? tableId : null,
            branchId: sessionObj.branchId,
            tenantId: sessionObj.tenantId,
            cashierId: sessionObj.userId || sessionObj.cashierId,
            shiftId: shift.shiftId ?? null,
            items: cart.map(item => ({
              itemId: item.itemId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal: item.unitPrice * item.quantity,
              options: buildItemOptions(item),
              notes: item.notes ?? undefined,
            })),
            totalAmount: subtotal,
            taxAmount,
            discountAmount,
            netAmount: total,
            notes: orderNote,
          }),
        });

        if (res.ok) {
          const order = await res.json();
          setPaymentOrderId(order.id);
          setPaymentOrderNumber(order.orderNumber);
          setIsPaymentOpen(true);

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
        } else {
          toast.error('Could not create order. Check connection.');
        }
      } catch {
        toast.error('Could not create order. Check connection.');
      } finally {
        setChargeLoading(false);
      }
    } else if (cart.length > 0) {
      // We have an existing order but there are un-sent items in the cart
      setChargeLoading(true);
      const isHeld = searchParams.get('isHeld') === 'true';
      const isActuallyEdit = !!paymentOrderId && !isHeld;
      const isAppending = isActuallyEdit && existingOrderData;
      const body = JSON.stringify({
        items: cart.map(item => ({
          itemId: item.itemId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.unitPrice * item.quantity,
          options: buildItemOptions(item),
          notes: item.notes ?? undefined,
        })),
      });

      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/orders${isAppending ? `/${paymentOrderId}/items` : ''}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`,
          },
          body,
        });

        if (!res.ok) throw new Error('Could not append items');
        setIsPaymentOpen(true);
      } catch (err) {
        const isOffline = !navigator.onLine || (err as Error).message === 'offline';
        if (isOffline && isAppending) {
          try {
            await queueItemAdd({ orderId: paymentOrderId!, body });
            toast.success('No connection — items saved locally and will sync automatically. Charge again once synced.');
          } catch (queueErr) {
            console.error('Failed to queue item add', queueErr);
            toast.error('Failed to save items offline. Please retry.');
          }
        } else {
          toast.error('Could not update order. Check connection.');
        }
      } finally {
        setChargeLoading(false);
      }
    } else {
      setIsPaymentOpen(true);
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

  useTopBar({
    pageTitle: paymentOrderId ? `Edit Order` : (selectedTableLabel ? `New Order — ${selectedTableLabel}` : 'New Order — No table selected'),
    breadcrumb: (
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="px-2 py-0.5 rounded-md bg-[#F1F5F9] border border-[#E2E8F0] text-[10px] font-bold text-[#475569] uppercase tracking-wider">{orderIdDisplay}</span>
        <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider ${selectedTableLabel ? 'bg-[#F1F5F9] border-[#E2E8F0] text-[#475569]' : 'bg-amber-50 border-amber-200 text-[#B45309]'}`}>{tableDisplay}</span>
        <span className="px-2 py-0.5 rounded-md bg-[#F1F5F9] border border-[#E2E8F0] text-[10px] font-bold text-[#475569] uppercase tracking-wider">{orderTypeDisplay}</span>
        <span className="px-2 py-0.5 rounded-md bg-[#F1F5F9] border border-[#E2E8F0] text-[10px] font-bold text-[#475569] uppercase tracking-wider">{guestCount} {parseInt(guestCount) === 1 ? 'guest' : 'guests'}</span>
      </div>
    ),
    showBackButton: true,
    backPath: '/pos/tables',
    centerSlot: (
      <div className="flex bg-[#F1F5F9] border border-[#CBD5E1] p-1 rounded-xl">
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
          className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-colors ${orderType === 'DINE_IN' ? 'bg-white text-[#0F172A] shadow-sm' : 'text-[#64748B] hover:text-[#0F172A]'}`}
        >Dine-in</button>
        <button onClick={() => setOrderType('TAKEAWAY')} className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-colors ${orderType === 'TAKEAWAY' ? 'bg-white text-[#0F172A] shadow-sm' : 'text-[#64748B] hover:text-[#0F172A]'}`}>Takeaway</button>
        <button onClick={() => setOrderType('DELIVERY')} className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-colors ${orderType === 'DELIVERY' ? 'bg-white text-[#0F172A] shadow-sm' : 'text-[#64748B] hover:text-[#0F172A]'}`}>Delivery</button>
      </div>
    ),
    rightActions: (
      <button
        onClick={holdOrder}
        disabled={cart.length === 0}
        className="flex items-center justify-center px-4 h-10 rounded-lg bg-[#F1F5F9] hover:bg-[#E2E8F0] transition-colors border border-[#CBD5E1] text-[#0F172A] font-bold text-[13px] tracking-wide disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
      >
        <span className="material-symbols-outlined mr-2 text-[18px]">pause</span>
        HOLD
      </button>
    )
  });

  return (
    <div className="flex flex-col h-full select-none bg-[#F8FAFC] text-[#0F172A] overflow-hidden font-body-md">
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

      <main
        className="flex flex-col lg:flex-row flex-1 overflow-hidden"
        style={{ '--cart-width': `${cartWidthPercent}%` } as React.CSSProperties}
      >
        {/* LEFT - MENU BROWSER */}
        <section className="w-full lg:flex-1 flex flex-col bg-[#F8FAFC] relative overflow-hidden">
          {/* Category Bar */}
          <div className="relative shrink-0">
            <div className="h-[52px] bg-white border-b border-[#E2E8F0] flex items-center px-4 gap-2 overflow-x-auto no-scrollbar relative z-10">
              <button
                onClick={() => setActiveCategoryId(null)}
                className={`px-4 h-9 rounded-full text-[14px] font-semibold whitespace-nowrap transition-colors ${!activeCategoryId ? 'bg-[var(--pos-primary,#F59E0B)] text-white shadow-sm' : 'border border-[#CBD5E1] bg-[#F8FAFC] text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]'}`}
              >
                All
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategoryId(cat.id)}
                  className={`px-4 h-9 rounded-full text-[14px] font-semibold whitespace-nowrap transition-colors ${activeCategoryId === cat.id ? 'bg-[var(--pos-primary,#F59E0B)] text-white shadow-sm' : 'border border-[#CBD5E1] bg-[#F8FAFC] text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]'}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
            {/* Fade right edge */}
            <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#F8FAFC] to-transparent pointer-events-none z-20" />
          </div>

          {/* Search Bar & View Toggle */}
          <div className="p-3 border-b border-[#E2E8F0] bg-[#F8FAFC] flex gap-2 items-center">
            <div className="flex-1 flex items-center gap-2 bg-white border border-[#CBD5E1] rounded-xl px-4 h-10 transition-colors focus-within:border-[var(--pos-primary,#F59E0B)] shadow-sm">
              <span className="material-symbols-outlined text-[#94A3B8] text-[18px]">search</span>
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search menu items..."
                className="bg-transparent border-none outline-none text-[14px] text-[#0F172A] flex-1 placeholder:text-[#94A3B8]"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="flex items-center justify-center text-[#64748B] hover:text-[#0F172A] transition-colors">
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              )}
            </div>

            {/* View Toggle */}
            <div className="flex items-center bg-[#F1F5F9] rounded-lg border border-[#CBD5E1] p-1 shrink-0 h-10 relative">
              <button
                onClick={() => handleViewChange('grid')}
                className={`w-8 h-full rounded flex items-center justify-center transition-colors ${viewMode === 'grid' ? 'bg-white text-[#0F172A] shadow-sm' : 'text-[#64748B] hover:text-[#0F172A]'}`}
                title="Grid View"
              >
                <span className="material-symbols-outlined text-[18px]">grid_view</span>
              </button>
              <button
                onClick={() => handleViewChange('compact')}
                className={`w-8 h-full rounded flex items-center justify-center transition-colors ${viewMode === 'compact' ? 'bg-white text-[#0F172A] shadow-sm' : 'text-[#64748B] hover:text-[#0F172A]'}`}
                title="Compact View"
              >
                <span className="material-symbols-outlined text-[18px]">view_list</span>
              </button>
              <button
                onClick={() => handleViewChange('large')}
                className={`w-8 h-full rounded flex items-center justify-center transition-colors ${viewMode === 'large' ? 'bg-white text-[#0F172A] shadow-sm' : 'text-[#64748B] hover:text-[#0F172A]'}`}
                title="Hero View"
              >
                <span className="material-symbols-outlined text-[18px]">web_stories</span>
              </button>
            </div>
          </div>

          {/* Menu Grid — "All" groups items under a category divider per
              section (a flat, undifferentiated grid of the whole menu was
              genuinely hard to scan mid-service); picking one category
              already narrows the grid to just that category, so a divider
              there would just repeat the category chip above it. */}
          <div className="flex-1 overflow-y-auto no-scrollbar p-3 pb-24 lg:pb-3">
            {menuLoading ? (
              <div className={`grid gap-2.5 content-start ${gridColsClass}`}>
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="bg-white border border-[#E2E8F0] rounded-2xl h-[220px] animate-pulse flex flex-col overflow-hidden">
                    <div className="h-[120px] bg-[#F1F5F9]"></div>
                    <div className="p-3 space-y-2">
                      <div className="h-4 bg-[#E2E8F0] rounded w-3/4"></div>
                      <div className="h-3 bg-[#E2E8F0] rounded w-1/2"></div>
                    </div>
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
                        <h3 className="text-[13px] font-bold text-[#0F172A] uppercase tracking-widest">{cat.name}</h3>
                        <span className="text-[12px] font-bold text-[#94A3B8]">{catItems.length}</span>
                        <div className="h-px flex-1 bg-[#E2E8F0]" />
                      </div>
                      <div className={`grid gap-2.5 content-start ${gridColsClass}`}>
                        {catItems.map(item => (
                          <MenuItemCard
                            key={item.id}
                            item={{ ...item, categoryName: cat.name }}
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
                  <div className="text-center text-[#94A3B8] py-10 font-medium">No menu items match your search.</div>
                )}
              </div>
            ) : (
              <div className={`grid gap-2.5 content-start ${gridColsClass}`}>
                {filteredItems.map(item => (
                  <MenuItemCard
                    key={item.id}
                    item={{
                      ...item,
                      categoryName: categories.find(c => c.id === item.categoryId)?.name
                    }}
                    cartQty={cart.filter(c => c.itemId === item.id).reduce((s, c) => s + c.quantity, 0)}
                    onTap={handleItemTap}
                    viewMode={viewMode}
                    onToggleAvailable={canToggleAvailability ? handleToggleAvailability : undefined}
                    isTogglingAvailable={togglingItemId === item.id}
                  />
                ))}
                {filteredItems.length === 0 && (
                  <div className="col-span-full text-center text-[#94A3B8] py-10 font-medium">No menu items match your search.</div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Floating Mobile Cart Button */}
        <div className="lg:hidden absolute bottom-4 left-4 right-4 z-40">
          <button
            onClick={() => setIsCartDrawerOpen(true)}
            className="w-full bg-[var(--pos-primary,#F59E0B)] text-white h-14 rounded-2xl font-bold flex items-center justify-between px-6 shadow-lg active:scale-[0.98] transition-transform"
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
            <span className="text-lg tracking-tight">PKR {combinedTotal.toFixed(2)}</span>
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
          className="hidden lg:flex w-2 cursor-col-resize hover:bg-amber-100 active:bg-amber-200 items-center justify-center border-l border-r border-[#E2E8F0] z-50 shrink-0 relative transition-colors group"
          onPointerDown={(e) => { e.preventDefault(); setIsResizing(true); }}
        >
          <div className="w-0.5 h-10 bg-[#CBD5E1] group-hover:bg-[var(--pos-primary,#F59E0B)] rounded-full transition-colors" />
          <div className="absolute inset-y-0 -left-2 -right-2 z-10 cursor-col-resize" />
        </div>

        {/* RIGHT - ORDER CART */}
        <section className={`
          fixed lg:relative inset-x-0 bottom-0 lg:inset-auto z-[110] lg:z-auto
          w-full lg:w-[var(--cart-width)] h-[85vh] lg:h-auto shrink-0 flex flex-col bg-white 
          border-t lg:border-t-0 border-[#E2E8F0]
          transition-transform duration-300 ease-in-out
          ${isCartDrawerOpen ? 'translate-y-0' : 'translate-y-full lg:translate-y-0'}
          rounded-t-3xl lg:rounded-none shadow-2xl lg:shadow-none
        `}>
          {/* Mobile Drawer Handle */}
          <div className="w-full h-10 flex items-center justify-center lg:hidden cursor-pointer shrink-0 border-b border-[#E2E8F0] bg-[#F8FAFC] rounded-t-3xl" onClick={() => setIsCartDrawerOpen(false)}>
            <div className="w-12 h-1.5 bg-[#CBD5E1] rounded-full" />
          </div>

          {/* Cart Header */}
          <div className="p-6 lg:p-6 pb-4 pt-4 lg:pt-6 bg-[#F8FAFC] border-b border-[#E2E8F0] shrink-0">
            <div className="flex justify-between items-start mb-1">
              <h2 className="text-[20px] font-bold text-[#0F172A] flex items-center gap-2">
                Current Order
                {cart.length > 0 && existingItems.length > 0 && (
                  <span className="bg-[#10b981] text-white text-[12px] px-2 py-0.5 rounded-full font-bold shadow-sm animate-in zoom-in">
                    +{cart.reduce((acc, c) => acc + c.quantity, 0)}
                  </span>
                )}
              </h2>
              <button onClick={startNewOrder} className="bg-white text-[#475569] text-[12px] font-bold px-2.5 py-1 rounded border border-[#CBD5E1] uppercase tracking-wider hover:bg-[#F1F5F9] transition-colors shadow-sm">New Order</button>
            </div>
            <p className="text-[#64748B] text-[12px] font-medium mb-3">{cart.length === 0 && existingItems.length === 0 ? 'No items added yet' : `${cart.length + existingItems.length} items total`}</p>

            {/* Customer attach — real customer search/create backed by
                /api/customers, wired to the same customerId PaymentModal
                already reads for loyalty point redemption. Previously
                there was no way to attach a customer to a walk-in order at
                all, so loyalty redemption only ever worked for orders that
                arrived pre-tagged (e.g. from WhatsApp/QR). */}
            {customerId ? (
              <div className="flex items-center justify-between gap-2 bg-white border border-[#E2E8F0] rounded-xl px-3 py-2">
                <button onClick={() => setCustomerPickerOpen(true)} className="flex items-center gap-2 min-w-0 text-left">
                  <div className="w-6 h-6 rounded-full bg-[var(--pos-primary,#F59E0B)]/10 flex items-center justify-center text-[var(--pos-primary,#F59E0B)] font-bold text-[10px] shrink-0">
                    {(customerName || 'C').charAt(0).toUpperCase()}
                  </div>
                  <span className="text-[13px] font-bold text-[#0F172A] truncate">{customerName || 'Customer'}</span>
                </button>
                <button onClick={() => setCustomer(null)} className="text-[#94A3B8] hover:text-[#DC2626] transition-colors shrink-0" title="Remove customer">
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCustomerPickerOpen(true)}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-[#CBD5E1] text-[#64748B] hover:text-[#0F172A] hover:border-[var(--pos-primary,#F59E0B)] hover:bg-white text-[12px] font-bold transition-all"
              >
                <span className="material-symbols-outlined text-[16px]">person_add</span>
                Attach Customer
              </button>
            )}
          </div>

          {/* Order-context warning — blocks Kitchen/Charge until resolved */}
          {!orderType && (
            <div className="mx-6 mt-4 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2.5 shrink-0">
              <span className="material-symbols-outlined text-amber-600 text-[20px]">info</span>
              <p className="text-[13px] font-semibold text-[#92400E]">Select Dine-in, Takeaway, or Delivery above to continue.</p>
            </div>
          )}
          {needsTable && (
            <div className="mx-6 mt-4 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-2.5 shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-amber-600 text-[20px]">table_restaurant</span>
                <p className="text-[13px] font-semibold text-[#92400E]">This dine-in order needs a table.</p>
              </div>
              <button
                onClick={() => router.push('/pos/tables')}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[12px] font-bold transition-colors"
              >
                Select Table
              </button>
            </div>
          )}

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto no-scrollbar bg-white">
            {existingItems.length > 0 && (
              <div className="border-b border-[#E2E8F0]">
                <div className="bg-[#F1F5F9] px-6 py-2 border-b border-[#E2E8F0] flex justify-between items-center">
                  <span className="text-[12px] font-bold text-[#64748B] uppercase tracking-wider">Already in Order</span>
                  <span className="bg-[#E2E8F0] text-[#475569] text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">Sent</span>
                </div>
                {existingItems.map((i: any, idx: number) => (
                  <div key={idx} className="px-6 py-3 border-b border-[#F1F5F9] last:border-b-0 bg-[#F8FAFC]">
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <h4 className="text-[14px] font-semibold text-[#64748B]">{i.quantity}x {i.itemName || i.item?.name}</h4>
                        {i.variationName && <span className="text-[12px] text-[#94A3B8]">{i.variationName}</span>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[14px] text-[#64748B]">PKR {(i.subtotal || (i.quantity * i.unitPrice)).toFixed(2)}</span>
                        <button
                          onClick={() => setVoidSheetState({ isOpen: true, item: i })}
                          className="w-8 h-8 flex items-center justify-center rounded-full text-rose-500 hover:bg-rose-100 transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {cart.length > 0 && existingItems.length > 0 && (
              <div className="bg-[#F8FAFC] px-6 py-2 border-b border-[#E2E8F0]">
                <span className="text-[12px] font-bold text-[#0F172A] uppercase tracking-wider">Adding Now</span>
              </div>
            )}

            {cart.length === 0 && existingItems.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-[#94A3B8]">
                <span className="material-symbols-outlined text-5xl mb-4 text-[#CBD5E1]">shopping_cart_checkout</span>
                <p className="font-bold text-lg text-[#0F172A]">Your cart is empty</p>
                <p className="text-sm mt-1 max-w-[240px] text-[#64748B]">Select items from the menu to start building the order for Table {selectedTableId}.</p>
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
            <div className="px-6 py-4 bg-[#F8FAFC] shrink-0 border-t border-[#E2E8F0] animate-in slide-in-from-bottom-2">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-bold text-[#0F172A]">Kitchen Note</span>
                <button
                  onClick={() => { setShowKitchenNote(false); setOrderNote(''); }}
                  className="text-[#64748B] hover:text-[#0F172A] transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
              <textarea
                value={orderNote}
                onChange={(e) => setOrderNote(e.target.value)}
                placeholder="Add special instructions for the kitchen..."
                className="w-full bg-white border border-[#CBD5E1] rounded-lg p-3 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[var(--pos-primary,#F59E0B)] transition-colors resize-none h-16 shadow-sm"
              />
            </div>
          )}

          {/* Cart Footer / Totals */}
          <div className="bg-[#F8FAFC] border-t border-[#E2E8F0] p-6 space-y-4 shrink-0">
            <div className="space-y-2 text-sm text-[#64748B] font-medium">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="text-[#0F172A] font-semibold">PKR {combinedSubtotal.toFixed(2)}</span>
              </div>
              {combinedTaxAmount > 0 && (
                <div className="flex justify-between">
                  <span>{taxLabel}</span>
                  <span className="text-[#0F172A] font-semibold">PKR {combinedTaxAmount.toFixed(2)}</span>
                </div>
              )}
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Discount</span>
                  <span>- PKR {discountAmount.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className="flex justify-between items-end pt-2 border-t border-[#E2E8F0]">
              <span className="text-[16px] font-bold uppercase tracking-wider text-[#0F172A]">Order Total</span>
              <div className="text-right">
                <p className="text-[#D97706] text-[36px] font-extrabold leading-none">PKR {combinedTotal.toFixed(2)}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-4">
              <div className="grid grid-cols-4 gap-2">
                <button className="h-11 border border-[#CBD5E1] bg-white text-[#0F172A] rounded-lg text-[12px] font-bold flex items-center justify-center gap-1 hover:bg-[#F1F5F9] transition-colors shadow-sm" onClick={() => setDiscountModalOpen(true)}>
                  <span className="material-symbols-outlined text-sm">percent</span> Discount
                </button>
                <button className={`h-11 border rounded-lg text-[12px] font-bold flex items-center justify-center gap-1 transition-colors shadow-sm ${showKitchenNote || orderNote ? 'border-[var(--pos-primary,#F59E0B)] bg-amber-50 text-[#D97706]' : 'border-[#CBD5E1] bg-white text-[#0F172A] hover:bg-[#F1F5F9]'}`} onClick={() => setShowKitchenNote(!showKitchenNote)}>
                  <span className="material-symbols-outlined text-sm">edit_note</span> Note
                </button>
                <button className="h-11 border border-[#CBD5E1] bg-white text-[#0F172A] rounded-lg text-[12px] font-bold flex items-center justify-center gap-1 hover:bg-[#F1F5F9] transition-colors shadow-sm" onClick={() => {
                  if (cart.length === 0) return;
                  setConfirmClearOpen(true);
                }}>
                  <span className="material-symbols-outlined text-sm">delete</span> Clear
                </button>
                <button className="h-11 border border-[#CBD5E1] bg-white text-[#0F172A] rounded-lg text-[12px] font-bold flex items-center justify-center gap-1 hover:bg-[#F1F5F9] transition-colors shadow-sm" onClick={holdOrder}>
                  <span className="material-symbols-outlined text-sm">pause_circle</span> Hold
                </button>
              </div>

              <div className="flex gap-2 h-14 mt-2">
                <button
                  onClick={sendToKitchen}
                  title={needsTable ? 'Select a table first' : !orderType ? 'Select an order type first' : undefined}
                  disabled={cart.length === 0 || kitchenLoading || orderStatus === 'COMPLETED' || !canSubmitOrder}
                  className={`flex-1 h-[52px] rounded-xl font-bold text-[14px] flex items-center justify-center gap-2 transition-all shadow-sm ${cart.length === 0 || kitchenLoading || orderStatus === 'COMPLETED' || !canSubmitOrder
                      ? 'bg-[#E2E8F0] text-[#94A3B8] cursor-not-allowed'
                      : paymentOrderId
                        ? 'bg-[#F1F5F9] border border-[#CBD5E1] text-[#0F172A] cursor-pointer hover:bg-[#E2E8F0]'
                        : 'bg-[#F1F5F9] border border-[#CBD5E1] text-[#0F172A] cursor-pointer hover:bg-[#E2E8F0]'
                    }`}
                >
                  {kitchenLoading ? (
                    <><span className="material-symbols-outlined animate-spin text-lg">progress_activity</span> SENDING...</>
                  ) : (
                    <><span className="material-symbols-outlined text-lg">print</span> {paymentOrderId ? 'RE-SEND' : 'KITCHEN'}</>
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
                    ? <><span className="material-symbols-outlined animate-spin text-lg">progress_activity</span> CREATING...</>
                    : <><span className="material-symbols-outlined text-lg">payments</span> CHARGE</>
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

      {isPaymentOpen && paymentOrderId && (
        <PaymentModal
          orderId={paymentOrderId}
          orderNumber={paymentOrderNumber || undefined}
          orderTotal={searchParams.get('totalAmount') ? Number(searchParams.get('totalAmount')) : combinedTotal}
          orderItems={[...existingItems.map(c => `${c.quantity}x ${c.itemName || c.item?.name}`), ...cart.map(c => `${c.quantity}x ${c.name}`)].join(' · ')}
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
          voidRequiresManagerApproval={(session as any)?.tenantBranding?.voidRequiresManagerApproval ?? true}
        />
      )}

      <CustomerPickerSheet
        isOpen={customerPickerOpen}
        onClose={() => setCustomerPickerOpen(false)}
        onSelect={(c: PickedCustomer) => setCustomer({ id: c.id, name: c.name })}
      />
    </div>
  );
}

import { Suspense } from 'react';

export default function OrderEntryPage() {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

  if (!isMounted) return (
    <div className="flex-1 flex items-center justify-center bg-[var(--pos-bg-base)] text-white h-full">
      <span className="material-symbols-outlined animate-spin text-4xl text-[var(--pos-primary)]">progress_activity</span>
    </div>
  );

  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center bg-[var(--pos-bg-base)] text-white h-full">
        <span className="material-symbols-outlined animate-spin text-4xl text-[var(--pos-primary)]">progress_activity</span>
      </div>
    }>
      <OrderEntryPageContent />
    </Suspense>
  );
}
