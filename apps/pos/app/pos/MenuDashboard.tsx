'use client';

import { useState, useEffect, useMemo } from 'react';
import { useCartStore } from '@/lib/store';
import { useMenu, groupByCategory } from '@/hooks/useMenu';

import type { CachedMenuItem } from '@/lib/db';
import CheckoutModal from '@/app/pos/CheckoutModal';
import { VariationPicker, PromoCodeModal, DiscountModal, SplitBillFlow } from './order/components';
import { MenuItemCard } from '@/components/MenuItemCard';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getToken } from '@/lib/pos-session';

interface Props {
  onViewChange: (view: 'home' | 'menu' | 'tickets') => void;
}

export default function MenuDashboard({ onViewChange }: Props) {
  const session = useCartStore(s => s.session);
  const cart = useCartStore(s => s.cart);
  const addItem = useCartStore(s => s.addItem);
  const incrementItem = useCartStore(s => s.incrementItem);
  const decrementItem = useCartStore(s => s.decrementItem);
  const clearCart = useCartStore(s => s.clearCart);
  const subtotal = useCartStore(s => s.subtotal());
  const discountAmount = useCartStore(s => s.discountAmount());
  const taxAmount = useCartStore(s => s.taxAmount());
  const total = useCartStore(s => s.total());
  const totalItems = useCartStore(s => s.totalItems());

  const searchParams = useSearchParams()
  const router = useRouter()
  const orderType = searchParams.get('type') ?? 'dine-in'
  const tableId = searchParams.get('tableId')
  const tableLabel = searchParams.get('tableLabel')
  const guests = searchParams.get('guests')
  const orderId = searchParams.get('orderId')
  const { data: menuItems = [], isLoading } = useMenu(session.tenantId, session.branchId);


  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [timeStr, setTimeStr] = useState('00:00:00');

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTimeStr(now.toTimeString().split(' ')[0]);
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const categories = useMemo(() => groupByCategory(menuItems), [menuItems]);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

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

  const [selectedItem, setSelectedItem] = useState<CachedMenuItem | null>(null);
  const [showPromo, setShowPromo] = useState(false);
  const [showDiscount, setShowDiscount] = useState(false);
  const [showSplitBill, setShowSplitBill] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);

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

  const handleSendToKitchen = async () => {
    if (cart.length === 0) {
      toast.error('Add items first');
      return;
    }
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
      const res = await fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          type: orderType.toUpperCase(),
          tableId: tableId ?? undefined,
          tenantId: session.tenantId,
          branchId: session.branchId,
          cashierId: session.cashierId,
          items: cart,
          subtotal,
          taxAmount,
          discountAmount,
          totalAmount: total
        })
      });
      if (res.ok) {
        const resData = await res.json().catch(() => ({}));
        
        try {
          const { printDocument } = await import('@/lib/print.service');
          await printDocument('KOT', {
            orderNumber: resData.orderNumber || 'NEW',
            tokenNumber: resData.tokenNumber || 'NEW',
            type: orderType.toUpperCase(),
            cashierName: session.cashierName,
            tenantName: session.restaurantName || 'SwiftServe',
            branchName: session.branchName || 'Main Branch',
            items: cart.map((c) => ({
              name: c.name,
              quantity: c.quantity,
              notes: c.notes,
              variationName: c.selectedVariation?.name,
              addOnNames: c.selectedAddOns.map((a) => a.name),
            })),
            createdAt: new Date(),
            tableLabel: tableLabel || undefined,
          } as any);
        } catch (printErr) {
          console.error('Failed to print KOT', printErr);
          toast.error('Order saved but KOT printing failed');
        }

        toast.success(`Order sent to kitchen!`);
        clearCart();
        if (orderType === 'dine-in') {
          router.push('/pos/tables');
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleBack = () => {
    if (cart.length > 0) {
      if (confirm('Leave order? Items in cart will be lost.')) {
        clearCart()
        router.push(orderType === 'dine-in' ? '/pos/tables' : '/pos/home')
      }
    } else {
      router.push(orderType === 'dine-in' ? '/pos/tables' : '/pos/home')
    }
  }

  const handleHold = async () => {
    if (cart.length === 0) return toast.error('Cart is empty');
    // Mock save to held orders (in a real app this would go to IndexedDB)
    clearCart();
    toast.success('Order held — find it in Tickets');
    router.push('/pos/home');
  }

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Top App Bar */}
      <header className="h-[52px] bg-[#111111] border-b border-[#1A1A1A] flex justify-between items-center px-lg shrink-0 z-50">
        <div className="flex items-center">
          <button onClick={handleBack} className="text-[#6B7280] font-medium text-[13px] flex items-center gap-1 hover:text-white transition-colors">
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            {orderType === 'dine-in' ? 'Tables' : 'Home'}
          </button>
        </div>
        <div className="text-[#C9C9C9] font-medium text-[14px] flex items-center gap-1.5">
          {orderType === 'dine-in' && tableId ? (
            <>← Tables <span className="text-[#374151] mx-0.5">•</span> Table {tableLabel} <span className="text-[#374151] mx-0.5">•</span> {guests} guests <span className="text-[#374151] mx-0.5">•</span> Dine-In</>
          ) : (
            <>{orderType.charAt(0).toUpperCase() + orderType.slice(1)} Order <span className="text-[#374151] mx-0.5">•</span> POS</>
          )}
        </div>
        <div className="flex items-center gap-md">
          <div className="font-mono text-[13px] text-[var(--pos-text-muted)]">{timeStr}</div>
          <div className="flex items-center gap-sm">
            <span className="text-[#C9C9C9] text-[13px] font-medium">Staff: {session?.cashierName || 'Alex'}</span>
            <div className="w-8 h-8 rounded-full bg-[var(--pos-primary)] flex items-center justify-center text-[#472a00] font-bold text-xs">
              {session?.cashierName?.[0] || 'A'}
            </div>
          </div>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {/* LEFT - MENU BROWSER (58%) */}
        <section className="w-[58%] flex flex-col bg-background border-r border-outline-variant relative">
          {/* Category Bar */}
          <div className="h-[52px] bg-surface-dim border-b border-outline-variant flex items-center px-md gap-sm overflow-x-auto no-scrollbar shrink-0">
            <button
              onClick={() => setActiveCategoryId(null)}
              className={`px-md h-9 rounded-full font-label-lg whitespace-nowrap ${!activeCategoryId ? 'bg-primary text-on-primary' : 'border border-outline-variant text-on-surface hover:bg-surface-variant'}`}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategoryId(cat.id)}
                className={`px-md h-9 rounded-full font-label-lg whitespace-nowrap ${activeCategoryId === cat.id ? 'bg-primary text-on-primary' : 'border border-outline-variant text-on-surface hover:bg-surface-variant'}`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="p-md bg-surface-dim shrink-0">
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-4 text-on-surface-variant">search</span>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 bg-surface-container-low border border-outline-variant rounded-lg pl-12 pr-4 text-on-surface placeholder:text-outline font-body-md focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                placeholder="Search items or scan barcode..."
                type="text"
              />
            </div>
          </div>

          {/* Menu Grid */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-md pb-24">
            {isLoading ? (
              <div className="grid grid-cols-3 gap-md">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="h-[140px] rounded-2xl bg-surface-container-low border border-outline-variant animate-pulse flex flex-col justify-between p-4">
                    <div className="space-y-2">
                      <div className="h-4 bg-surface-variant rounded-full w-2/3"></div>
                      <div className="h-3 bg-surface-variant rounded-full w-1/2"></div>
                    </div>
                    <div className="h-6 bg-surface-variant rounded-full w-1/3"></div>
                  </div>
                ))}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-on-surface-variant">
                <span className="material-symbols-outlined text-[48px] text-[#534434] mb-2">menu_book</span>
                <span className="font-semibold text-[14px]">No Menu Items Found</span>
                <span className="text-[12px] text-[#6B7280] mt-1">Try logging in again or contact admin.</span>
              </div>
            ) : (
              categories
                .filter(cat => (!activeCategoryId || activeCategoryId === cat.id))
                .map(cat => {
                  const catItems = filteredItems.filter(item => item.categoryId === cat.id);
                  if (catItems.length === 0) return null;
                  
                  return (
                    <div key={cat.id} className="mb-8 last:mb-0">
                      <h3 className="text-xl font-bold font-clash text-on-surface mb-4 flex items-center gap-2">
                        <span className="w-1 h-6 bg-primary rounded-full"></span>
                        {cat.name}
                      </h3>
                      <div className="grid grid-cols-3 gap-md content-start">
                        {catItems.map(item => (
                          <MenuItemCard
                            key={item.id}
                            item={{ ...item, categoryName: cat.name }}
                            cartQty={cart.filter(c => c.itemId === item.id).reduce((s, c) => s + c.quantity, 0)}
                            onTap={handleItemTap}
                          />
                        ))}
                      </div>
                    </div>
                  );
              })
            )}
          </div>

          {/* Floating Buttons */}
          <div className="absolute bottom-6 left-6 flex gap-sm">
            <button onClick={() => router.push('/pos/tables')} className="w-11 h-11 rounded-full bg-surface-container-highest border border-outline-variant flex items-center justify-center text-primary hover:bg-primary-container hover:text-on-primary-container transition-all">
              <span className="material-symbols-outlined">table_chart</span>
            </button>
            <button className="w-11 h-11 rounded-full bg-surface-container-highest border border-outline-variant flex items-center justify-center text-primary hover:bg-primary-container hover:text-on-primary-container transition-all">
              <span className="material-symbols-outlined">dialpad</span>
            </button>
            <button className="w-11 h-11 rounded-full bg-surface-container-highest border border-outline-variant flex items-center justify-center text-primary hover:bg-primary-container hover:text-on-primary-container transition-all">
              <span className="material-symbols-outlined">barcode_scanner</span>
            </button>
          </div>
        </section>

        {/* RIGHT - ORDER CART (42%) */}
        <section className="w-[42%] flex flex-col bg-surface-container-low border-l border-outline-variant">
          {/* Cart Header */}
          <div className="p-lg bg-surface-dim border-b border-outline-variant shrink-0">
            <div className="flex justify-between items-start mb-1">
              <h2 className="font-headline-sm text-on-surface">Current Order</h2>
              <span className="bg-surface-container-highest text-on-surface-variant font-label-md px-2 py-0.5 rounded border border-outline-variant">{orderId ? `#${orderId}` : 'NEW'}</span>
            </div>
            <p className="text-outline text-[12px]">{orderType.toUpperCase()} • Server: {session?.cashierName || 'Alex'}</p>
          </div>

          {/* Items List */}
          <div className="flex-1 overflow-y-auto no-scrollbar p-lg space-y-lg">
            {cart.map((cartItem, idx) => (
              <div key={`${cartItem.itemId}-${idx}`} className="flex items-center gap-md">
                <div className="flex flex-col items-center gap-1">
                  <button onClick={() => incrementItem(cartItem.itemId, cartItem.selectedVariation?.id)} className="w-7 h-7 rounded-full bg-primary-container/20 text-primary border border-primary/30 flex items-center justify-center hover:bg-primary-container transition-colors"><span className="material-symbols-outlined text-sm">add</span></button>
                  <span className="font-bold text-sm">{cartItem.quantity}</span>
                  <button onClick={() => decrementItem(cartItem.itemId, cartItem.selectedVariation?.id)} className="w-7 h-7 rounded-full bg-surface-container-highest border border-outline-variant flex items-center justify-center hover:bg-error-container transition-colors"><span className="material-symbols-outlined text-sm">remove</span></button>
                </div>
                <div className="flex-1">
                  <p className="font-label-lg text-on-surface">{cartItem.name}</p>
                  {cartItem.selectedVariation && (
                    <p className="text-outline text-[12px] italic">{cartItem.selectedVariation.name}</p>
                  )}
                  {cartItem.selectedAddOns.length > 0 && (
                    <p className="text-outline text-[12px] italic">{cartItem.selectedAddOns.map(a => a.name).join(', ')}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-medium text-on-surface">{cartItem.subtotal}</p>
                </div>
              </div>
            ))}
            {cart.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-on-surface-variant opacity-50">
                <span className="material-symbols-outlined text-5xl mb-2">shopping_basket</span>
                <p>Cart is empty</p>
              </div>
            )}
          </div>

          {/* Cart Footer / Totals */}
          <div className="bg-surface-dim border-t border-outline-variant p-lg space-y-md shrink-0">
            <div className="space-y-sm text-sm">
              <div className="flex justify-between text-on-surface-variant">
                <span>Subtotal</span>
                <span>{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[#10b981]">
                <span>Discount</span>
                <span>-{discountAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-on-surface-variant">
                <span>Tax (17% GST)</span>
                <span>{taxAmount.toFixed(2)}</span>
              </div>
            </div>
            <div className="flex justify-between items-end pt-sm border-t border-outline-variant">
              <span className="font-display-lg text-headline-sm uppercase tracking-wider text-outline">Order Total</span>
              <div className="text-right">
                <p className="text-primary-container font-currency-display leading-none text-3xl font-bold">PKR {total.toFixed(2)}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-sm pt-md">
              <div className="grid grid-cols-3 gap-sm">
                <button onClick={() => setShowDiscount(true)} className="h-11 border border-outline-variant rounded-lg font-label-md flex items-center justify-center gap-1 hover:bg-surface-variant text-sm">
                  <span className="material-symbols-outlined text-sm">percent</span> Discount
                </button>
                <button onClick={() => setShowPromo(true)} className="h-11 border border-outline-variant rounded-lg font-label-md flex items-center justify-center gap-1 hover:bg-surface-variant text-sm">
                  <span className="material-symbols-outlined text-sm">notes</span> Note
                </button>
                <button onClick={handleHold} className="h-11 border border-outline-variant rounded-lg font-label-md flex items-center justify-center gap-1 hover:bg-surface-variant text-sm">
                  <span className="material-symbols-outlined text-sm">pause_circle</span> Hold
                </button>
              </div>
              <div className="flex gap-sm h-14 mt-2">
                <button onClick={handleSendToKitchen} className="flex-[0.45] bg-primary-container text-on-primary-container rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all">
                  <span className="material-symbols-outlined">print</span> KITCHEN
                </button>
                <button onClick={() => {
                  if (cart.length === 0) return toast.error('Add items first')
                  setShowCheckout(true)
                }} className="flex-[0.55] bg-on-surface text-surface-container-lowest rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all">
                  <span className="material-symbols-outlined">payments</span> CHARGE
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Modals */}
      {selectedItem && <VariationPicker item={selectedItem} onClose={() => setSelectedItem(null)} />}
      {showPromo && <PromoCodeModal onClose={() => setShowPromo(false)} />}
      {showDiscount && <DiscountModal onClose={() => setShowDiscount(false)} />}
      {showSplitBill && <SplitBillFlow onClose={() => setShowSplitBill(false)} />}
      {showCheckout && <CheckoutModal 
        onClose={() => setShowCheckout(false)} 
        onSuccess={(orderId, method) => {
          setShowCheckout(false);
          clearCart();
          router.push(`/pos/order/success?orderId=${orderId}&method=${method}&tableId=${tableId}&tableLabel=${tableLabel}`);
        }} 
      />}
    </div>
  );
}
