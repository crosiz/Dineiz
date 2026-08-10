'use client';

import { useState, useCallback, useEffect } from 'react';
import { useCartStore } from '@/lib/store';
import { useBrandingStore } from '@/lib/branding-store';
import { queueOfflineOrder } from '@/lib/offlineHelpers';
import { registerOrderSync } from '@/lib/syncRegistration';
import { useRouter, useSearchParams } from 'next/navigation';
import { getToken } from '@/lib/pos-session';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type PaymentMethod = 'CASH' | 'CARD' | 'JAZZCASH' | 'SPLIT';

const CASH_SHORTCUTS = [500, 1000, 2000, 5000];
const NUMPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'backspace'];

interface Props {
  onClose: () => void;
  onSuccess?: (orderId: string, method: string) => void;
}

function fmt(n: number) {
  return Math.round(n).toLocaleString('en-PK');
}

export default function CheckoutModal({ onClose, onSuccess }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tableId = searchParams.get('tableId');

  // Store selectors
  const cart              = useCartStore((s) => s.cart);
  const subtotal          = useCartStore((s) => s.combinedSubtotal);
  const discountAmount    = useCartStore((s) => s.combinedDiscountAmount);
  const cashTaxAmount     = useCartStore((s) => s.cashTaxAmount);
  const cardTaxAmount     = useCartStore((s) => s.cardTaxAmount);
  const taxAmount         = useCartStore((s) => s.combinedTaxAmount);
  const total             = useCartStore((s) => s.combinedTotal);
  const discount          = useCartStore((s) => s.discount);
  const orderType         = useCartStore((s) => s.orderType);
  const orderNotes        = useCartStore((s) => s.orderNotes);
  const session           = useCartStore((s) => s.session);
  const clearCart         = useCartStore((s) => s.clearCart);
  const totalItems        = useCartStore((s) => s.combinedTotalItems);
  const combinedItems     = useCartStore((s) => s.combinedItems);
  const setActivePaymentMethod = useCartStore((s) => s.setActivePaymentMethod);
  const customerId        = useCartStore((s) => s.customerId);
  const autoDeals         = useCartStore((s) => s.autoDeals);
  const branding          = useBrandingStore((s) => s.branding);

  const [activeMethod, setActiveMethodLocal] = useState<PaymentMethod>('CASH');
  const [cashTendered, setCashTendered] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // Loyalty State
  const [loyaltyProfile, setLoyaltyProfile] = useState<any>(null);
  const [loyaltySettings, setLoyaltySettings] = useState<any>(null);
  const [useLoyaltyPoints, setUseLoyaltyPoints] = useState(false);

  useEffect(() => {
    async function loadLoyalty() {
      if (!customerId) return;
      try {
        const [profRes, setRes] = await Promise.all([
          fetch(`${API_URL}/api/customers/${customerId}`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
          }).then(r => r.json()),
          fetch(`${API_URL}/api/loyalty/settings`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
          }).then(r => r.json())
        ]);
        if (profRes && setRes?.settings?.isActive) {
          setLoyaltyProfile(profRes);
          setLoyaltySettings(setRes.settings);
        }
      } catch (e) {
        console.error('Failed to load loyalty data', e);
      }
    }
    loadLoyalty();
  }, [customerId]);

  const getTaxRate = (paymentMethod: string): number => {
    switch(paymentMethod) {
      case 'CASH': return branding.cashTaxEnabled !== false ? (branding.cashTaxRate ?? 5) : 0;
      case 'CARD': return branding.cardTaxEnabled !== false ? (branding.cardTaxRate ?? 17) : 0;
      case 'JAZZCASH': return branding.cardTaxEnabled !== false ? (branding.cardTaxRate ?? 17) : 0;
      case 'EASYPAISA': return branding.cardTaxEnabled !== false ? (branding.cardTaxRate ?? 17) : 0;
      default: return 0;
    }
  };

  const getTaxLabel = (paymentMethod: string): string => {
    switch(paymentMethod) {
      case 'CASH': return branding.cashTaxLabel ?? 'GST (Cash)';
      default: return branding.cardTaxLabel ?? 'GST (Card/Digital)';
    }
  };

  // Change payment method — updates both local state AND the store's activePaymentMethod
  // so that taxAmount() / total() recompute immediately
  const selectMethod = useCallback((method: PaymentMethod) => {
    setActiveMethodLocal(method);
    setActivePaymentMethod(method);
  }, [setActivePaymentMethod]);

  // Reactive calculation based on selected method
  const activeTaxRate = getTaxRate(activeMethod);
  const activeTaxLbl  = `${getTaxLabel(activeMethod)} (${activeTaxRate}%)`;
  
  // Calculate Loyalty Discount if toggled
  let loyaltyDiscount = 0;
  let redeemedPoints = 0;
  if (useLoyaltyPoints && loyaltyProfile && loyaltySettings && loyaltySettings.isActive) {
    if (loyaltyProfile.loyaltyPoints >= loyaltySettings.minPointsToRedeem) {
      // Calculate max value based on available points
      const pointsChunks = Math.floor(loyaltyProfile.loyaltyPoints / loyaltySettings.redemptionValuePoints);
      redeemedPoints = pointsChunks * loyaltySettings.redemptionValuePoints;
      loyaltyDiscount = pointsChunks * loyaltySettings.redemptionValuePkr;
    }
  }

  const baseSubtotal = subtotal();
  const baseDiscount = discountAmount();
  const taxableSubtotal = Math.max(0, baseSubtotal - baseDiscount - loyaltyDiscount);
  const activeTaxAmt = Math.round(taxableSubtotal * (activeTaxRate / 100));
  const totalAmt = taxableSubtotal + activeTaxAmt;

  const cashNum  = parseFloat(cashTendered) || 0;
  const change   = Math.max(0, cashNum - totalAmt);

  // ─── Submit ──────────────────────────────────────────────────────────────────

  async function submitOrder() {
    if (activeMethod === 'CASH' && cashNum < totalAmt) {
      setError('Insufficient cash tendered.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    const payments = buildPayments(activeMethod, totalAmt);
    const orderPayload = {
      branchId: session.branchId!,
      type: orderType || 'DINE_IN',
      totalAmount: baseSubtotal,        // item sum (server calculates tax)
      discountAmount: baseDiscount + loyaltyDiscount,
      taxAmount: activeTaxAmt,        // advisory — server will recalculate
      netAmount: totalAmt,            // advisory — server will recalculate
      redeemedPointsAmount: redeemedPoints, // custom loyalty points redemption payload
      customerId: customerId,
      notes: orderNotes || undefined,
      items: cart.map((c) => ({
        itemId: c.itemId,
        quantity: c.quantity,
        unitPrice: c.unitPrice,
        subtotal: c.subtotal,
        notes: c.notes,
        options: c.selectedVariation || c.selectedAddOns.length > 0
          ? { variation: c.selectedVariation, addOns: c.selectedAddOns }
          : undefined,
      })),
      orderDeals: autoDeals.applied.map(deal => ({
        dealId: deal.id,
        dealName: deal.code ? `Promo: ${deal.code}` : (deal.type === 'DEAL' ? 'Deal' : 'Auto Deal'),
        dealType: deal.type,
        discountApplied: deal.amount,
        promoCodeUsed: deal.code || null
      })),
      payments,
    };

    try {
      if (!navigator.onLine) throw new Error('offline');

      const res = await fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        credentials: 'include',
        body: JSON.stringify(orderPayload),
      });

      if (res.ok) {
        const order = await res.json();

        if (tableId) {
          await fetch(`${API_URL}/api/tables/${tableId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body: JSON.stringify({ status: 'dirty' })
          }).catch(() => {});
        }

        if (order.id) {
          if (onSuccess) {
            onSuccess(order.id, activeMethod);
          } else {
            const params = new URLSearchParams({
              orderId: order.id,
              method: activeMethod,
              amountPaid: cashTendered || String(totalAmt),
              change: String(change > 0 ? change : 0),
            });
            if (tableId) params.set('tableId', tableId);
            router.push(`/pos/receipt?${params.toString()}`);
          }
        } else {
          router.push('/pos/home');
        }
      } else {
        const errorData = await res.json().catch(() => null);
        if (res.status === 402 && errorData?.error === 'PLAN_LIMIT_EXCEEDED') {
          throw new Error('PLAN_LIMIT_EXCEEDED');
        }
        throw new Error(`API ${res.status}`);
      }
    } catch (err) {
      if ((err as Error).message === 'PLAN_LIMIT_EXCEEDED') {
        setError('Daily order limit reached for your plan. Please contact your admin to upgrade.');
        setIsSubmitting(false);
        return;
      }
      
      const isOffline = !navigator.onLine || (err as Error).message === 'offline';
      if (isOffline) {
        await queueOfflineOrder({
          tenantId: session.tenantId!,
          branchId: session.branchId!,
          cashierId: session.cashierId || 'cashier-1',
          type: orderType || 'DINE_IN',
          subtotal: subtotal(),
          discountAmount: discountAmount(),
          taxAmount: activeTaxAmt,
          total: totalAmt,
          notes: orderNotes,
          items: cart.map((c) => ({
            itemId: c.itemId,
            itemName: c.name,
            quantity: c.quantity,
            unitPrice: c.unitPrice,
            variationId: c.selectedVariation?.id,
            addonIds: c.selectedAddOns.map((a) => a.id),
            notes: c.notes,
          })),
        });
        await registerOrderSync();
        onClose();
        clearCart();
      } else {
        setError('Failed to submit order. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePrintPreBill() {
    try {
      const { printDocument } = await import('@/lib/print.service');
      await printDocument('CUSTOMER_BILL', {
        orderNumber: 'PRE-BILL',
        tokenNumber: 'PRE-BILL',
        type: (orderType as any) || 'DINE_IN',
        cashierName: session.cashierName ?? 'Operator',
        tenantName: session.restaurantName || 'SwiftServe',
        branchName: session.branchName || 'Main Branch',
        items: cart.map((c) => ({
          name: c.name,
          quantity: c.quantity,
          unitPrice: c.unitPrice,
          subtotal: c.subtotal,
          variationName: c.selectedVariation?.name,
        })),
        subtotal: subtotal(),
        discountAmount: discountAmount(),
        taxAmount: activeTaxAmt,
        total: totalAmt,
        paymentMethod: activeMethod,
        createdAt: new Date(),
        tableLabel: searchParams.get('tableLabel') || '',
      } as any);
    } catch (err) {
      console.error(err);
      setError('Could not generate pre-bill.');
    }
  }

  function buildPayments(method: PaymentMethod, amt: number) {
    if (method === 'CASH')    return [{ amount: amt, method: 'CASH', status: 'COMPLETED' }];
    if (method === 'CARD')    return [{ amount: amt, method: 'CARD', status: 'COMPLETED' }];
    if (method === 'JAZZCASH') return [{ amount: amt, method: 'JAZZCASH', status: 'COMPLETED' }];
    // SPLIT: 50 / 50 placeholder
    return [
      { amount: Math.ceil(amt / 2), method: 'CASH', status: 'COMPLETED' },
      { amount: Math.floor(amt / 2), method: 'CARD', status: 'COMPLETED' },
    ];
  }

  const handleNumpad = (key: string) => {
    if (key === 'backspace') {
      setCashTendered((prev) => prev.slice(0, -1));
    } else {
      setCashTendered((prev) => prev + key);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const methodBtn = (m: PaymentMethod, icon: string, label: string) => (
    <button
      onClick={() => selectMethod(m)}
      className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl transition-all group border-2 ${
        activeMethod === m
          ? 'border-electric-amber bg-electric-amber/5'
          : 'border-outline-variant/10 hover:border-electric-amber'
      }`}
    >
      <span className="material-symbols-outlined text-3xl group-hover:scale-110 transition-transform">{icon}</span>
      <span className="font-bold text-sm">{label}</span>
    </button>
  );

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 z-0" onClick={onClose}></div>

      <div className="relative h-[95vh] bg-sheet-white rounded-t-3xl shadow-2xl flex flex-col slide-up z-10 font-body-md text-midnight overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-outline-variant/20 flex flex-col items-center">
          <div className="w-12 h-1.5 bg-outline-variant/30 rounded-full mb-4"></div>
          <div className="w-full flex justify-between items-start">
            <div className="flex flex-col">
              <h1 className="font-headline-md text-[22px] leading-tight text-midnight font-bold">Checkout</h1>
              <p className="text-body-sm text-outline font-medium">{totalItems()} items</p>
            </div>
            <button className="w-10 h-10 flex items-center justify-center rounded-full bg-outline-variant/10 hover:bg-outline-variant/20 transition-all" onClick={onClose}>
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden relative z-10">
          {/* Left: Order Summary + Totals */}
          <div className="w-full md:w-[400px] flex flex-col px-6 overflow-y-auto custom-scrollbar border-r border-outline-variant/20">

            {/* Items */}
            <div className="mb-6 mt-4">
              <ul className="space-y-3">
                {combinedItems().map((c: any, i: number) => (
                  <li key={i} className="flex justify-between items-start">
                    <div className="flex gap-3">
                      <span className="font-bold text-electric-amber">{c.quantity}×</span>
                      <div>
                        <p className="font-bold text-sm">{c.name}</p>
                        {(c.selectedVariation || c.selectedAddOns.length > 0) && (
                          <p className="text-xs text-outline italic">
                            {c.selectedVariation?.name}
                            {c.selectedAddOns.length > 0 && c.selectedVariation ? ', ' : ''}
                            {c.selectedAddOns.map((a) => a.name).join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="font-bold text-sm">PKR {fmt(c.subtotal)}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Loyalty Redemption Toggle */}
            {loyaltyProfile && loyaltySettings?.isActive && loyaltyProfile.loyaltyPoints >= loyaltySettings.minPointsToRedeem && (
              <div className="mb-4 bg-[#FF5722]/5 border border-[#FF5722]/20 rounded-xl p-4 flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-[#FF5722] text-sm">Loyalty Points</h4>
                  <p className="text-xs text-[#FF5722]/80 font-medium">Available: {loyaltyProfile.loyaltyPoints}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-700">Use Points</span>
                  <button 
                    onClick={() => setUseLoyaltyPoints(!useLoyaltyPoints)}
                    className={`w-12 h-6 rounded-full relative transition-colors ${useLoyaltyPoints ? 'bg-[#FF5722]' : 'bg-gray-300'}`}
                  >
                    <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${useLoyaltyPoints ? 'translate-x-6' : ''}`}></div>
                  </button>
                </div>
              </div>
            )}

            {/* Totals block — updates instantly as payment method changes */}
            <div className="mt-auto space-y-2 pt-4 border-t border-outline-variant/20 pb-6">
              <div className="flex justify-between text-sm text-outline font-medium">
                <span>Subtotal</span>
                <span>PKR {fmt(subtotal())}</span>
              </div>
              {baseDiscount > 0 && (
                <div className="flex justify-between text-sm text-red-500 font-medium">
                  <span>Discount</span>
                  <span>−PKR {fmt(baseDiscount)}</span>
                </div>
              )}
              {loyaltyDiscount > 0 && (
                <div className="flex justify-between text-sm text-[#FF5722] font-bold">
                  <span>Loyalty Discount (-{redeemedPoints} pts)</span>
                  <span>−PKR {fmt(loyaltyDiscount)}</span>
                </div>
              )}

              {/* Active Tax row */}
              <div className="flex justify-between items-center text-sm font-medium">
                <span className="text-outline">{activeTaxLbl}</span>
                <span className={activeMethod === 'CASH' ? 'text-green-600' : 'text-orange-500'}>
                  PKR {fmt(activeTaxAmt)}
                </span>
              </div>

              {/* Dual-tax preview */}
              {branding.cashTaxEnabled !== false && branding.cardTaxEnabled !== false && activeMethod === 'CASH' && (
                <div className="flex justify-between text-xs text-orange-400/70 font-medium transition-opacity">
                  <span>{branding.cardTaxLabel ?? 'GST (Card/Digital)'} ({branding.cardTaxRate ?? 17}%) if card</span>
                  <span>PKR {fmt(Math.round(taxableSubtotal * ((branding.cardTaxRate ?? 17) / 100)))}</span>
                </div>
              )}
              {branding.cashTaxEnabled !== false && branding.cardTaxEnabled !== false && activeMethod !== 'CASH' && (
                <div className="flex justify-between text-xs text-green-500/70 font-medium transition-opacity">
                  <span>{branding.cashTaxLabel ?? 'GST (Cash)'} ({branding.cashTaxRate ?? 5}%) if cash</span>
                  <span>PKR {fmt(Math.round(taxableSubtotal * ((branding.cashTaxRate ?? 5) / 100)))}</span>
                </div>
              )}

              {/* Total due */}
              <div className="flex justify-between items-end pt-3 border-t-2 border-midnight/5">
                <span className="font-bold text-base">Total Due</span>
                <span className="font-clash text-[30px] text-midnight leading-none font-bold">PKR {fmt(totalAmt)}</span>
              </div>

              {/* Cash vs Card comparison pills */}
              {branding.cashTaxEnabled !== false && branding.cardTaxEnabled !== false && branding.showDualTaxOnReceipt !== false && (
                <div className="flex gap-2 pt-1">
                  <div className={`flex-1 rounded-xl px-3 py-2 text-center text-xs font-semibold border-2 transition-all ${
                    activeMethod === 'CASH' ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 text-slate-400'
                  }`}>
                    💵 Cash: PKR {fmt(taxableSubtotal + Math.round(taxableSubtotal * ((branding.cashTaxRate ?? 5) / 100)))}
                  </div>
                  <div className={`flex-1 rounded-xl px-3 py-2 text-center text-xs font-semibold border-2 transition-all ${
                    activeMethod !== 'CASH' ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-slate-200 text-slate-400'
                  }`}>
                    💳 Card: PKR {fmt(taxableSubtotal + Math.round(taxableSubtotal * ((branding.cardTaxRate ?? 17) / 100)))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Payment Methods + Input */}
          <div className="flex-1 bg-white/50 flex flex-col p-6 overflow-y-auto custom-scrollbar">

            {/* Payment Method Grid */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              {methodBtn('CASH', 'payments', 'Cash')}
              {methodBtn('CARD', 'credit_card', 'Card')}
              {methodBtn('JAZZCASH', 'qr_code_2', 'JazzCash')}
              {methodBtn('SPLIT', 'call_split', 'Split')}
            </div>

            {/* Cash input */}
            {activeMethod === 'CASH' && (
              <div className="flex-1 flex flex-col md:flex-row gap-8 mt-4">
                <div className="flex-1 flex flex-col justify-center gap-8">
                  <div className="space-y-2">
                    <label className="font-headline-sm text-sm tracking-widest uppercase opacity-50 font-bold">Cash Received</label>
                    <div className="text-[52px] font-clash font-bold leading-tight border-b-2 border-midnight py-2">
                      <span className="text-outline-variant">PKR</span> <span>{cashTendered || '0'}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="font-headline-sm text-sm tracking-widest uppercase opacity-50 font-bold">Change to Return</label>
                    <div className={`text-[44px] font-clash font-bold leading-tight ${cashNum >= totalAmt ? 'text-sage-green' : 'text-outline-variant'}`}>
                      <span className="opacity-70 text-3xl">PKR</span> {fmt(change)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-2">
                    {CASH_SHORTCUTS.map((amt) => (
                      <button key={amt} onClick={() => setCashTendered(amt.toString())} className="px-5 py-2.5 bg-midnight text-white font-bold rounded-full hover:bg-midnight/80 active:scale-95 transition-all text-sm">
                        {amt.toLocaleString()}
                      </button>
                    ))}
                  </div>
                  {error && <p className="text-red-500 font-bold mt-2 text-sm">{error}</p>}
                </div>
                <div className="w-full md:w-[300px] grid grid-cols-3 gap-3 p-4 bg-midnight/5 rounded-[28px] shrink-0 h-fit">
                  {NUMPAD_KEYS.map((key, idx) => (
                    key === 'backspace'
                      ? <button key={idx} onClick={() => handleNumpad(key)} className="h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center active:scale-95 transition-transform text-midnight">
                          <span className="material-symbols-outlined">backspace</span>
                        </button>
                      : <button key={idx} onClick={() => handleNumpad(key)} className="h-14 bg-white rounded-2xl shadow-sm text-xl font-bold active:scale-95 transition-transform text-midnight">
                          {key}
                        </button>
                  ))}
                </div>
              </div>
            )}

            {/* Card */}
            {activeMethod === 'CARD' && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4">
                <div className="w-28 h-28 rounded-full border-2 border-electric-amber bg-electric-amber/5 flex items-center justify-center">
                  <span className="material-symbols-outlined text-5xl text-electric-amber">credit_card</span>
                </div>
                <h3 className="text-xl font-bold font-clash">Card Payment</h3>
                <p className="text-outline font-medium">Amount Due: <strong>PKR {fmt(totalAmt)}</strong></p>
                <p className="text-xs text-orange-500 font-medium">{cardLabel} ({cardRate}%) applied</p>
                {session.cardTaxNote && (
                  <p className="text-xs text-slate-400 text-center max-w-xs">{session.cardTaxNote}</p>
                )}
                <input type="text" placeholder="Authorization Code (optional)" className="w-72 px-4 py-3 bg-white border border-outline-variant/30 rounded-xl mt-4 outline-none focus:border-electric-amber text-midnight text-sm" />
              </div>
            )}

            {/* JazzCash */}
            {activeMethod === 'JAZZCASH' && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4">
                <div className="w-28 h-28 rounded-full border-2 border-electric-amber bg-electric-amber/5 flex items-center justify-center">
                  <span className="material-symbols-outlined text-5xl text-electric-amber">qr_code_2</span>
                </div>
                <h3 className="text-xl font-bold font-clash">JazzCash / EasyPaisa</h3>
                <p className="text-outline font-medium">Amount Due: <strong>PKR {fmt(totalAmt)}</strong></p>
                <p className="text-xs text-orange-500 font-medium">{cardLabel} ({cardRate}%) applied</p>
              </div>
            )}

            {/* Split */}
            {activeMethod === 'SPLIT' && (
              <div className="flex-1 flex flex-col gap-4 mt-4 max-w-lg">
                <h3 className="font-bold text-lg">Split Payment</h3>
                <p className="text-xs text-slate-500">Cash portion uses {cashLabel} ({cashRate}%). Card portion uses {cardLabel} ({cardRate}%). Tax calculated proportionally.</p>
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 font-medium">
                  Cash Total: PKR {fmt(cashTotal())} &nbsp;|&nbsp; Card Total: PKR {fmt(cardTotal())}
                </div>
                <div className="flex gap-4 items-center">
                  <span className="text-sm font-semibold w-16">Cash</span>
                  <div className="flex items-center flex-1 relative">
                    <span className="absolute left-3 text-sm font-bold opacity-50">PKR</span>
                    <input type="number" defaultValue={Math.ceil(totalAmt / 2)} className="w-full pl-14 pr-4 py-3 bg-white border border-outline-variant/30 rounded-xl outline-none text-midnight" />
                  </div>
                </div>
                <div className="flex gap-4 items-center">
                  <span className="text-sm font-semibold w-16">Card</span>
                  <div className="flex items-center flex-1 relative">
                    <span className="absolute left-3 text-sm font-bold opacity-50">PKR</span>
                    <input type="number" defaultValue={Math.floor(totalAmt / 2)} className="w-full pl-14 pr-4 py-3 bg-white border border-outline-variant/30 rounded-xl outline-none text-midnight" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sticky Bottom Bar */}
        <div className="px-6 py-5 shrink-0 flex flex-col gap-3 border-t border-outline-variant/20 bg-sheet-white">
          <div className="flex gap-3">
            <button
              onClick={submitOrder}
              disabled={isSubmitting || (activeMethod === 'CASH' && cashNum < totalAmt)}
              className={`flex-1 h-14 bg-electric-amber text-midnight rounded-2xl flex items-center justify-center gap-3 font-headline-sm text-base font-bold transition-all active:scale-[0.98] disabled:opacity-50`}
            >
              {isSubmitting
                ? <><span className="material-symbols-outlined animate-spin">progress_activity</span> Processing...</>
                : <><span className="material-symbols-outlined">check_circle</span> Confirm — PKR {fmt(totalAmt)}</>
              }
            </button>
            <button onClick={handlePrintPreBill} className="w-14 h-14 flex items-center justify-center rounded-2xl border-2 border-outline-variant/20 hover:border-electric-amber text-midnight" title="Print pre-bill">
              <span className="material-symbols-outlined">print</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
