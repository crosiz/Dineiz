'use client';

import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { useCartStore } from '@/lib/store';
import { useBrandingStore } from '@/lib/branding-store';
import { getToken } from '@/lib/pos-session';
import { useViews } from '@/lib/core/views';
import { ReceiptView, type ReceiptData } from '@/components/ReceiptView';

type PaymentMethod = 'CASH' | 'CARD' | 'JAZZCASH' | 'EASYPAISA' | 'SPLIT';

// JazzCash/EasyPaisa are recognized payment-method values throughout the
// system (tax categorization, receipts) but the actual gateway integration
// is an unconfigured server scaffold (apps/api/.../payments.routes.ts
// returns 501 without JAZZCASH_MERCHANT_ID). Previously this modal still
// let a cashier "select" them and showed a live-looking QR code polling a
// /payment-status endpoint that doesn't exist anywhere in the API — a
// customer could scan a QR that goes nowhere while the screen sat on
// "Waiting for payment confirmation..." forever. Gate them here so the UI
// is honest about what's actually wired up.
const UNCONFIGURED_METHODS: PaymentMethod[] = ['JAZZCASH', 'EASYPAISA'];

interface PaymentModalProps {
  orderId: string;
  orderNumber?: string;
  orderTotal: number;
  orderItems: string | any[];
  items?: any[];
  isOpen: boolean;
  onClose: () => void;
  tableLabel?: string;
  tableId?: string;
  customerId?: string | null;
  onSuccess: (orderId: string, method: string, amountPaid: number, change: number) => void;
}

export default function PaymentModal({
  orderId,
  orderNumber,
  orderTotal,
  orderItems,
  items,
  isOpen,
  onClose,
  tableLabel,
  tableId,
  customerId,
  onSuccess,
}: PaymentModalProps) {
  const cart = useCartStore((s) => s.cart);
  const session = useCartStore((s) => s.session);

  // An existing order (has an id) is NEVER charged from the live cart — that's
  // empty/stale after send-to-kitchen and is exactly how "Collect Payment"
  // ended up showing PKR 0. Prefer the `items` the caller passed; if it forgot
  // them, pull the real lines straight from the event store; only a brand-new
  // in-cart order (no id yet) falls back to `cart`.
  const viewOrder = useViews((s) => (orderId ? s.orders[orderId] : undefined));
  const displayItems = useMemo(() => {
    if (items && items.length > 0) return items;
    if (viewOrder?.items?.length) {
      return viewOrder.items
        .filter((i: any) => !i.voided)
        .map((i: any) => ({
          quantity: i.qty,
          unitPrice: i.unitPrice,
          subtotal: (i.unitPrice ?? 0) * (i.qty ?? 1),
          name: i.itemName,
        }));
    }
    return orderId ? [] : cart;
  }, [items, viewOrder, cart, orderId]);

  const subtotalFromItems = displayItems.reduce(
    (acc: number, c: any) => acc + (c.subtotal || (c.unitPrice * c.quantity) || 0),
    0,
  );

  // Existing order we can't bill from its own lines — either they never
  // loaded (API unreachable) OR they loaded without prices (a server-seeded
  // orphan order: `viewOrder.items` present but every `unitPrice` undefined,
  // so they sum to 0). Both cases fall back to the known `orderTotal`; the
  // server re-derives the real figure on payment anyway. Checking the SUM,
  // not `.length`, is the fix for "collect payment on an old order and it
  // comes back" — priced-at-zero lines slipped past a `.length === 0` guard
  // and a PKR 0 payment was queued, which the server rejects (422) so the
  // order never actually gets paid.
  const itemsUnavailable = !!orderId && subtotalFromItems <= 0;

  // ── Dual Tax Reactive Logic ──
  const branding = useBrandingStore(s => s.branding);

  const getTaxRate = (paymentMethod: string): number => {
    switch (paymentMethod) {
      case 'CASH': return branding.cashTaxRate ?? 5;
      case 'CARD':
      case 'JAZZCASH':
      case 'EASYPAISA': return branding.cardTaxRate ?? 17;
      default: return branding.cashTaxRate ?? 5;
    }
  };

  const getTaxLabel = (paymentMethod: string): string => {
    switch (paymentMethod) {
      case 'CASH': return branding.cashTaxLabel ?? 'GST (Cash)';
      default: return branding.cardTaxLabel ?? 'GST (Card/Digital)';
    }
  };

  const [activeMethod, setActiveMethod] = useState<PaymentMethod>('CASH');
  const [amountEntered, setAmountEntered] = useState<string>('');
  const [authCode, setAuthCode] = useState<string>('');

  const [splitMethod1, setSplitMethod1] = useState<'CASH' | 'CARD'>('CASH');
  const [splitAmount1, setSplitAmount1] = useState<string>('');
  const [splitMethod2, setSplitMethod2] = useState<'CASH' | 'CARD'>('CARD');

  // ── Loyalty State ──
  const [loyaltyProfile, setLoyaltyProfile] = useState<any>(null);
  const [loyaltySettings, setLoyaltySettings] = useState<any>(null);
  const [useLoyaltyPoints, setUseLoyaltyPoints] = useState(false);
  // Tracked independent of whether the loyalty program is active — the
  // "Message Customer" receipt action only needs a phone number, and
  // shouldn't disappear just because the tenant hasn't turned loyalty on.
  const [customerPhone, setCustomerPhone] = useState<string | null>(null);

  useEffect(() => {
    async function loadLoyalty() {
      if (!customerId) return;
      try {
        const token = getToken();
        const [profRes, setRes] = await Promise.all([
          fetch(`${API_URL}/api/customers/${customerId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }).then(r => r.json()),
          fetch(`${API_URL}/api/loyalty/settings`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }).then(r => r.json())
        ]);
        if (profRes?.phone) setCustomerPhone(profRes.phone);
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

  // Recalculate everything reactively
  const isCash = activeMethod === 'CASH';
  const taxEnabled = isCash ? branding.cashTaxEnabled !== false : branding.cardTaxEnabled !== false;
  const taxRate = taxEnabled ? getTaxRate(activeMethod) : 0;

  // No usable line prices but a known order total → treat that total as gross
  // and back out this method's tax so the recompute lands back on it, not PKR 0.
  const subtotal = subtotalFromItems > 0
    ? subtotalFromItems
    : (itemsUnavailable && orderTotal > 0 ? orderTotal / (1 + taxRate / 100) : subtotalFromItems);

  const discount = useCartStore((s) => s.discount);
  const discountAmount = discount
    ? (discount.type === 'percent' ? subtotal * (discount.value / 100) : discount.value)
    : 0;

  // Calculate Loyalty Discount if toggled
  let loyaltyDiscount = 0;
  let redeemedPoints = 0;
  if (useLoyaltyPoints && loyaltyProfile && loyaltySettings && loyaltySettings.isActive) {
    if (loyaltyProfile.loyaltyPoints >= loyaltySettings.minPointsToRedeem) {
      const pointsChunks = Math.floor(loyaltyProfile.loyaltyPoints / loyaltySettings.redemptionValuePoints);
      redeemedPoints = pointsChunks * loyaltySettings.redemptionValuePoints;
      loyaltyDiscount = pointsChunks * loyaltySettings.redemptionValuePkr;
    }
  }

  const taxableSubtotal = Math.max(0, subtotal - discountAmount - loyaltyDiscount);
  const taxAmount = Math.round(taxableSubtotal * (taxRate / 100));
  const taxLabel = taxEnabled ? `${getTaxLabel(activeMethod)} (${taxRate}%)` : 'Tax Disabled';

  // Override orderTotal prop with locally calculated exact total
  const dynamicTotal = taxableSubtotal + taxAmount;

  const [tipPercent, setTipPercent] = useState<number>(0);
  const [customTip, setCustomTip] = useState<string>('');
  const [showCustomTip, setShowCustomTip] = useState(false);
  const tipAmount = showCustomTip
    ? parseFloat(customTip) || 0
    : parseFloat(((dynamicTotal * tipPercent) / 100).toFixed(2));
  const totalWithTip = dynamicTotal + tipAmount;

  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  // What was actually charged when payment succeeded — captured once so the
  // receipt (and the deferred onSuccess call once the cashier dismisses it)
  // can still show/report it after `activeMethod`/amountEntered have reset.
  const [finalPaymentInfo, setFinalPaymentInfo] = useState<{ method: string; tendered: number; change: number } | null>(null);
  const clearCart = useCartStore((s) => s.clearCart);

  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

  const cashNum = parseFloat(amountEntered) || 0;
  const changeDue = Math.max(0, cashNum - totalWithTip);
  const isCashValid = cashNum >= totalWithTip;

  const splitNum1 = parseFloat(splitAmount1) || 0;
  const splitNum2 = Math.max(0, totalWithTip - splitNum1);
  const isSplitValid = splitNum1 > 0 && splitNum2 > 0 && Math.abs(splitNum1 + splitNum2 - totalWithTip) < 0.01;

  useEffect(() => {
    if (isOpen) {
      setAmountEntered(Math.ceil(totalWithTip).toString());
    }
  }, [isOpen, totalWithTip]);

  // Shared by the printed receipt and the on-screen ReceiptView so both
  // ever only describe the same order once.
  const receiptItems = displayItems.map((c: any) => ({
    name: c.name || c.item?.name || c.itemName || 'Unknown Item',
    quantity: c.quantity,
    unitPrice: c.unitPrice,
    subtotal: c.subtotal || ((c.unitPrice || 0) * c.quantity),
    variationName: c.selectedVariation?.name || c.options?.variation?.name,
    addOnNames: (c.selectedAddOns || c.options?.addOns || []).map((a: any) => a.price ? `${a.name} (+${a.price})` : a.name),
  }));

  const [isPrinting, setIsPrinting] = useState(false);
  const handlePrintReceipt = async (method: string, tendered: number, change: number) => {
    // Routed through print.service.ts's printDocument — this used to call
    // usePrinter().printReceipt directly, which always sends raw ESC/POS
    // bytes over WebUSB regardless of the Admin panel's PDF-mode toggle.
    // Every other receipt/KOT in the app (order screen, floor plan bill,
    // KDS reprint) already goes through printDocument; this was the one
    // path that silently ignored the setting and threw "No thermal
    // printer paired" on any terminal without hardware attached.
    setIsPrinting(true);
    try {
      const { printDocument } = await import('@/lib/print.service');
      await printDocument('PAID_RECEIPT', {
        orderNumber: orderNumber || orderId.slice(-6),
        tokenNumber: orderNumber || orderId.slice(-4),
        type: useCartStore.getState().orderType || 'DINE_IN',
        tableLabel,
        cashierName: session.cashierName ?? undefined,
        tenantName: branding.restaurantName || 'Dineiz',
        branchName: session?.branchName || 'Main Branch',
        items: receiptItems,
        subtotal,
        discountAmount: discountAmount + loyaltyDiscount,
        taxAmount,
        total: totalWithTip,
        paymentMethod: method,
        cashTendered: tendered > 0 ? tendered : undefined,
        changeGiven: change > 0 ? change : undefined,
        dualTaxConfig: {
          cashTaxEnabled: session.cashTaxEnabled,
          cashTaxRate: session.cashTaxRate,
          cashTaxLabel: session.cashTaxLabel,
          cardTaxEnabled: session.cardTaxEnabled,
          cardTaxRate: session.cardTaxRate,
          cardTaxLabel: session.cardTaxLabel,
          showDualTaxOnReceipt: session.showDualTaxOnReceipt,
          taxRoundingMethod: session.taxRoundingMethod,
        },
      } as any);
      toast.success('Receipt sent to printer');
    } catch (e: any) {
      console.warn('Failed to print receipt', e);
      toast.error(e?.message || 'Failed to print receipt. Check printer connection in Settings.');
    } finally {
      setIsPrinting(false);
    }
  };

  // Captured once, right when payment succeeds and before clearCart() runs
  // — the on-screen receipt (and a reprint from it) reads this snapshot
  // rather than the live cart/discount/etc. state, which is emptied out
  // from under it the moment clearCart() fires.
  const [receiptSnapshot, setReceiptSnapshot] = useState<ReceiptData | null>(null);

  const buildReceiptData = (method: string, tendered: number, change: number): ReceiptData => ({
    tenantName: branding.restaurantName || 'Dineiz',
    fbrNtn: branding.fbrNtn,
    receiptHeader: branding.receiptHeader,
    receiptFooter: branding.receiptFooter,
    orderNumber: orderNumber || orderId.slice(-6),
    tableLabel,
    orderType: useCartStore.getState().orderType,
    cashierName: session.cashierName,
    items: receiptItems,
    subtotal,
    discountAmount,
    loyaltyDiscount,
    redeemedPoints,
    taxAmount,
    taxLabel,
    tipAmount,
    total: totalWithTip,
    paymentMethod: method,
    cashTendered: method === 'CASH' ? tendered : undefined,
    changeGiven: method === 'CASH' ? change : undefined,
    createdAt: new Date(),
  });

  const handlePaymentSuccess = async (methodLabel: string, tendered: number = totalWithTip, change: number = 0) => {
    // Snapshot before anything below touches the cart/discount state.
    setReceiptSnapshot(buildReceiptData(methodLabel, tendered, change));
    setFinalPaymentInfo({ method: methodLabel, tendered, change });

    // Settings → Point of Sale → "Auto-print receipt on payment" was never
    // actually consulted here — a receipt printed on every successful
    // payment regardless of the toggle. The manual "Print Receipt" button
    // elsewhere in this modal is unaffected by this check, as it should be.
    let autoPrintReceipt = false;
    try {
      const settings = JSON.parse(localStorage.getItem('pos_tenant_settings') || '{}');
      autoPrintReceipt = settings?.pos?.autoPrintReceipt === true;
    } catch {}
    if (autoPrintReceipt) {
      await handlePrintReceipt(methodLabel, tendered, change);
    }

    setShowSuccess(true);
    clearCart();
    // No auto-dismiss timer — a 2-second window was nowhere near enough
    // time to actually read a receipt, let alone print or share it. The
    // cashier now leaves via an explicit action (Print / Message Customer
    // / Done) in the success screen below.
  };

  const handleDone = () => {
    onClose();
    setShowSuccess(false);
    if (finalPaymentInfo) {
      onSuccess(orderId, finalPaymentInfo.method, finalPaymentInfo.tendered, finalPaymentInfo.change);
    }
  };

  // Local-first: the cash/card exchange already happened physically at the
  // counter by the time this fires (this modal never talks to a real
  // payment gateway — JazzCash/EasyPaisa are gated off above), so recording
  // it server-side doesn't need to block the receipt. We show the receipt
  // immediately; shipping it to the server is the outbox's job now
  // (lib/core/outbox.ts's COLLECT_PAYMENT task, triggered by the
  // PAYMENT_COLLECTED event below) — it has its own retry/backoff and
  // survives this modal closing, unlike the old inline fetch-then-queue.
  const submitPayment = async (payload: any) => {
    // Never queue a PKR 0 payment — the server rejects it (422) and the order
    // silently bounces back onto the board. If we got here with no total,
    // the order's lines didn't resolve; tell the cashier to reopen it.
    if (!(totalWithTip > 0)) {
      toast.error("Nothing to charge — this order's total came through as zero. Reopen it from Tickets.");
      return;
    }
    setIsProcessing(true);
    try {
      const isCash = payload.method === 'CASH';
      const tendered = isCash ? (payload.amount + (payload.change || 0)) : totalWithTip;

      // Flips this order's status to COMPLETED and frees/dirties its table
      // in the shared view store immediately — instant everywhere that
      // store is read — and queues the event for the outbox to ship.
      const { collectPayment } = await import('@/lib/core/commands');
      await collectPayment(orderId, {
        method: payload.method || 'SPLIT',
        total: totalWithTip,
        cashReceived: isCash ? payload.amount + (payload.change || 0) : undefined,
        change: payload.change || 0,
        taxAmount,
        payments: payload.method === 'SPLIT'
          ? payload.payments.map((p: any) => ({
              method: p.method,
              amount: p.amount,
              status: p.status || 'COMPLETED',
              transactionId: p.transactionRef || p.transactionId,
            }))
          : undefined,
        redeemedPointsAmount: redeemedPoints,
      });

      // Paint the receipt now — this is the whole point of local-first.
      await handlePaymentSuccess(payload.method || 'SPLIT', tendered, payload.change || 0);
    } catch (e) {
      toast.error('Payment submission failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirm = () => {
    if (UNCONFIGURED_METHODS.includes(activeMethod)) {
      toast.error(`${activeMethod === 'JAZZCASH' ? 'JazzCash' : 'EasyPaisa'} isn't connected yet — ask a manager to configure it, or choose Cash or Card.`);
      return;
    }
    if (activeMethod === 'CASH') {
      submitPayment({ method: 'CASH', amount: totalWithTip, change: changeDue, tip: tipAmount });
    } else if (activeMethod === 'CARD') {
      if (!authCode) { toast.error('Enter the authorization code from the card terminal.'); return; }
      submitPayment({ method: 'CARD', amount: totalWithTip, transactionRef: authCode, tip: tipAmount });
    } else if (activeMethod === 'SPLIT') {
      submitPayment({
        method: 'SPLIT',
        payments: [
          { method: splitMethod1, amount: splitNum1 },
          { method: splitMethod2, amount: splitNum2 }
        ],
        tip: tipAmount,
      });
    }
  };

  const handleNumpad = (val: string) => {
    if (val === 'backspace') {
      setAmountEntered(prev => prev.slice(0, -1) || '');
    } else if (val === '.') {
      if (!amountEntered.includes('.')) setAmountEntered(prev => prev + '.');
    } else {
      setAmountEntered(prev => prev === '0' ? val : prev + val);
    }
  };

  if (!isOpen) return null;

  if (showSuccess && receiptSnapshot) {
    return (
      <div className="fixed inset-0 bg-[#F8FAFC] flex flex-col items-center z-[60] animate-in fade-in duration-300 overflow-y-auto py-8 px-4">
        <div className="w-20 h-20 bg-[#E9F7F0] border-2 border-[#10B981] rounded-full flex items-center justify-center mb-4 shrink-0 animate-in zoom-in-95 duration-500">
          <span className="material-symbols-outlined text-[#10B981] text-[40px] font-bold">check</span>
        </div>
        <h2 className="text-2xl font-bold text-[#0F172A] mb-1">Payment Successful</h2>
        <p className="text-[#64748B] mb-6">{finalPaymentInfo?.method === 'CASH' && finalPaymentInfo.change > 0 ? `Give ${finalPaymentInfo.change.toFixed(0)} change` : 'Order completed'}</p>

        <ReceiptView data={receiptSnapshot} />

        <div className="w-full max-w-[380px] flex flex-col gap-2.5 mt-6">
          <div className="flex gap-2.5">
            <button
              onClick={() => handlePrintReceipt(finalPaymentInfo?.method || receiptSnapshot.paymentMethod, finalPaymentInfo?.tendered || 0, finalPaymentInfo?.change || 0)}
              disabled={isPrinting}
              className="flex-1 h-[52px] rounded-xl border border-[#CBD5E1] bg-white text-[#0F172A] font-bold flex items-center justify-center gap-2 hover:bg-[#F1F5F9] transition-all disabled:opacity-50"
            >
              <span className="material-symbols-outlined">{isPrinting ? 'hourglass_top' : 'print'}</span>
              {isPrinting ? 'Printing…' : 'Print Receipt'}
            </button>
            {customerPhone && (
              <a
                href={`https://wa.me/${customerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(`Thanks for your order! Your receipt total was PKR ${Math.round(receiptSnapshot.total).toLocaleString()}.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 h-[52px] rounded-xl bg-[#0F7A55] text-white font-bold flex items-center justify-center gap-2 hover:brightness-105 transition-all"
              >
                <span className="material-symbols-outlined">chat</span>
                Message Customer
              </a>
            )}
          </div>
          <button
            onClick={handleDone}
            className="w-full h-[52px] rounded-xl bg-[var(--pos-primary,#F59E0B)] text-white font-bold flex items-center justify-center gap-2 hover:brightness-105 active:scale-[0.98] transition-all shadow-md"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex flex-col justify-end">
      {/* Click outside to close */}
      <div className="absolute inset-0 z-0" onClick={onClose}></div>

      {/* MAIN CHECKOUT OVERLAY */}
      <div className="relative h-[95vh] bg-white rounded-t-3xl shadow-2xl flex flex-col slide-up z-10 font-body-md text-[#0F172A] overflow-hidden border-t border-[#E2E8F0]">

        {/* Drag Handle & Header */}
        <div className="w-full flex flex-col items-center pt-3 pb-4 px-6 shrink-0 relative z-10 bg-[#F8FAFC] border-b border-[#E2E8F0]">
          <div className="w-12 h-1.5 bg-[#CBD5E1] rounded-full mb-4"></div>
          <div className="w-full flex justify-between items-start">
            <div className="flex flex-col">
              <h1 className="font-headline-md text-[22px] leading-tight text-[#0F172A] font-bold">Checkout</h1>
              <p className="text-body-sm text-[#64748B] font-medium mt-0.5">
                {tableLabel ? `Table ${tableLabel}` : 'Takeaway'} · #{orderId.slice(-6)}
              </p>
            </div>
            <button className="w-10 h-10 flex items-center justify-center rounded-full bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0] hover:text-[#0F172A] transition-all" onClick={onClose}>
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex flex-1 overflow-hidden relative z-10 bg-white">
          {/* Left Panel: Order Summary & Totals */}
          <div className="w-full md:w-[400px] flex flex-col px-6 py-6 overflow-y-auto custom-scrollbar border-r border-[#E2E8F0] bg-[#F8FAFC]">
            
            {/* Loyalty Block */}
            {loyaltyProfile && loyaltySettings && loyaltySettings.isActive && (
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

            {/* Order Items Summary */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-headline-sm text-xs tracking-widest uppercase text-[#64748B] font-bold">Order Summary</h2>
              </div>
              <ul className="space-y-4">
                {displayItems.map((c: any, i: number) => (
                  <li key={i} className="flex justify-between items-start">
                    <div className="flex gap-3">
                      <span className="font-bold text-[#D97706] min-w-[20px]">{c.quantity}×</span>
                      <div>
                        <p className="font-bold text-sm text-[#0F172A]">{c.name || c.item?.name || c.itemName || 'Item'}</p>
                        {(c.selectedVariation || c.options?.variation || c.selectedAddOns?.length > 0 || c.options?.addOns?.length > 0) && (
                          <p className="text-xs text-[#64748B] italic mt-0.5">
                            {c.selectedVariation?.name || c.options?.variation?.name}
                            {((c.selectedAddOns?.length > 0 || c.options?.addOns?.length > 0) && (c.selectedVariation || c.options?.variation)) ? ', ' : ''}
                            {(c.selectedAddOns || c.options?.addOns || []).map((a: any) => a.name).join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="font-bold text-sm text-[#0F172A] whitespace-nowrap ml-2">
                      {(c.subtotal || (c.unitPrice * c.quantity) || 0).toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Totals Block */}
            <div className="mt-auto space-y-3 pt-6 border-t border-[#E2E8F0]">
              <div className="flex justify-between text-body-md font-medium">
                <span className="text-[#64748B]">Subtotal</span>
                <span className="text-[#0F172A] font-semibold">{subtotal.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm text-red-500 font-medium">
                  <span>Discount</span>
                  <span>−PKR {Math.round(discountAmount).toLocaleString()}</span>
                </div>
              )}
              {loyaltyDiscount > 0 && (
                <div className="flex justify-between text-sm text-[#FF5722] font-bold">
                  <span>Loyalty Discount (-{redeemedPoints} pts)</span>
                  <span>−PKR {Math.round(loyaltyDiscount).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-medium">
                <span className="text-[#64748B]">{taxLabel}</span>
                <span className="text-[#0F172A] font-semibold">{taxAmount.toFixed(2)}</span>
              </div>
              {tipAmount > 0 && (
                <div className="flex justify-between text-body-md font-medium text-emerald-600">
                  <span className="text-[#64748B]">Tip</span>
                  <span className="font-semibold">+{tipAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-end pt-4 border-t border-[#E2E8F0]">
                <span className="font-headline-sm text-lg font-bold text-[#0F172A]">Total Due</span>
                <span className="font-clash text-[32px] text-[#D97706] leading-none font-bold">{totalWithTip.toFixed(2)}</span>
              </div>
            </div>

            {/* Tip Selector */}
            <div className="mt-8 pb-8">
              <h2 className="font-headline-sm text-xs tracking-widest uppercase text-[#64748B] mb-4 font-bold">Add Tip</h2>
              {showCustomTip ? (
                <div className="flex gap-2 items-center">
                  <div className="flex items-center gap-2 flex-1 relative">
                    <span className="absolute left-4 font-bold text-[#64748B]">PKR</span>
                    <input
                      type="number"
                      value={customTip}
                      onChange={e => setCustomTip(e.target.value)}
                      placeholder="0"
                      className="w-full pl-14 pr-4 py-3 bg-white border border-[#CBD5E1] rounded-xl outline-none focus:border-[var(--pos-primary,#F59E0B)] text-[#0F172A] font-bold"
                      autoFocus
                    />
                  </div>
                  <button
                    onClick={() => { setShowCustomTip(false); setCustomTip(''); setTipPercent(0); }}
                    className="py-3 px-6 min-w-[80px] border border-rose-200 bg-rose-50 rounded-xl font-bold hover:bg-rose-100 text-rose-600 transition-all text-sm shadow-sm"
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {[0, 10, 15, 20].map(pct => (
                    <button
                      key={pct}
                      onClick={() => setTipPercent(pct)}
                      className={`py-3 px-2 border rounded-xl font-bold transition-all shadow-sm ${tipPercent === pct && !showCustomTip ? 'border-[var(--pos-primary,#F59E0B)] bg-amber-50 text-[#D97706]' : 'border-[#CBD5E1] bg-white hover:border-[var(--pos-primary,#F59E0B)] text-[#0F172A] hover:bg-amber-50'}`}
                    >
                      {pct === 0 ? 'None' : `${pct}%`}
                    </button>
                  ))}
                  <button
                    onClick={() => { setShowCustomTip(true); setTipPercent(0); }}
                    className="py-3 px-2 border border-[#CBD5E1] bg-white rounded-xl font-bold hover:border-[var(--pos-primary,#F59E0B)] transition-all text-xs col-span-4 text-[#0F172A] hover:bg-amber-50 shadow-sm"
                  >
                    Custom Amount
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Payment Methods & Numpad */}
          <div className="flex-1 bg-white flex flex-col p-6 overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-5 gap-3 mb-8">
              {[
                { method: 'CASH' as PaymentMethod, icon: 'payments', label: 'Cash' },
                { method: 'CARD' as PaymentMethod, icon: 'credit_card', label: 'Card' },
                { method: 'JAZZCASH' as PaymentMethod, icon: 'qr_code_2', label: 'JazzCash' },
                { method: 'EASYPAISA' as PaymentMethod, icon: 'qr_code_2', label: 'EasyPaisa' },
                { method: 'SPLIT' as PaymentMethod, icon: 'call_split', label: 'Split' },
              ].map(({ method, icon, label }) => {
                const isUnconfigured = UNCONFIGURED_METHODS.includes(method);
                return (
                  <button
                    key={method}
                    onClick={() => { setActiveMethod(method); setAmountEntered(''); }}
                    title={isUnconfigured ? `${label} isn't connected yet` : undefined}
                    className={`relative flex flex-col items-center justify-center gap-2 p-3 rounded-2xl transition-all group border shadow-sm ${activeMethod === method ? 'border-[var(--pos-primary,#F59E0B)] bg-amber-50 text-[#D97706]' : 'border-[#CBD5E1] bg-[#F8FAFC] hover:border-[var(--pos-primary,#F59E0B)] hover:bg-[#F1F5F9] text-[#0F172A]'} ${isUnconfigured ? 'opacity-60' : ''}`}
                  >
                    {isUnconfigured && (
                      <span className="absolute top-1.5 right-1.5 material-symbols-outlined text-[13px] text-[#94A3B8]">lock</span>
                    )}
                    <span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">{icon}</span>
                    <span className="font-bold text-xs">{label}</span>
                  </button>
                );
              })}
            </div>

            {/* Cash Panel */}
            {(activeMethod === 'CASH') && (
              <div className="flex-1 flex flex-col md:flex-row gap-8 mt-4">
                <div className="flex-1 flex flex-col justify-center gap-8">
                  <div className="space-y-2">
                    <label className="font-headline-sm text-xs tracking-widest uppercase text-[#64748B] font-bold">Cash Received</label>
                    <div className="text-[56px] font-clash font-bold leading-tight border-b-2 border-[#E2E8F0] py-2 text-[#0F172A]">
                      <span className="text-[#94A3B8]">PKR</span> <span>{amountEntered || '0'}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="font-headline-sm text-xs tracking-widest uppercase text-[#64748B] font-bold">Change to Return</label>
                    <div className={`text-[48px] font-clash font-bold leading-tight ${cashNum >= totalWithTip ? 'text-emerald-600' : 'text-[#94A3B8]'}`}>
                      <span className="opacity-70 text-3xl">PKR</span> {changeDue.toFixed(2)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-4">
                    <button onClick={() => setAmountEntered('')} className="px-6 py-3 bg-rose-50 border border-rose-200 text-rose-600 font-bold rounded-full hover:bg-rose-100 active:scale-95 transition-all shadow-sm">
                      Clear
                    </button>
                    <button onClick={() => setAmountEntered(Math.ceil(totalWithTip).toString())} className="px-6 py-3 bg-amber-50 border border-[var(--pos-primary,#F59E0B)] text-[#D97706] font-bold rounded-full hover:bg-amber-100 active:scale-95 transition-all shadow-sm">
                      Exact
                    </button>
                    {[500, 1000, 2000, 5000].map(amt => (
                      <button key={amt} onClick={() => setAmountEntered(prev => (Number(prev || 0) + amt).toString())} className="px-6 py-3 bg-[#F1F5F9] border border-[#CBD5E1] text-[#0F172A] font-bold rounded-full hover:bg-[#E2E8F0] active:scale-95 transition-all shadow-sm">
                        +{amt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="w-full md:w-[320px] grid grid-cols-3 gap-3 p-4 bg-[#F8FAFC] rounded-[32px] shrink-0 h-fit border border-[#CBD5E1] shadow-sm">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'backspace'].map((key, idx) => {
                    if (key === 'backspace') {
                      return (
                        <button key={idx} onClick={() => handleNumpad(key)} className="h-16 bg-white border border-[#CBD5E1] rounded-2xl shadow-sm flex items-center justify-center active:scale-95 transition-transform duration-100 text-[#0F172A] hover:bg-[#F1F5F9]">
                          <span className="material-symbols-outlined">backspace</span>
                        </button>
                      );
                    }
                    return (
                      <button key={idx} onClick={() => handleNumpad(key)} className="h-16 bg-white border border-[#CBD5E1] rounded-2xl shadow-sm text-2xl font-bold active:scale-95 transition-transform duration-100 text-[#0F172A] hover:bg-[#F1F5F9]">
                        {key}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Card Panel */}
            {(activeMethod === 'CARD') && (
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="w-32 h-32 rounded-full border-2 border-amber-500 bg-amber-50 flex items-center justify-center mb-6 shadow-sm">
                  <span className="material-symbols-outlined text-6xl text-[#D97706]">credit_card</span>
                </div>
                <h3 className="text-2xl font-bold font-clash text-[#0F172A]">Card Payment</h3>
                <p className="text-[#64748B] font-medium mt-2">Amount Due: PKR {totalWithTip.toFixed(2)}</p>
                <input type="text" value={authCode} onChange={(e) => setAuthCode(e.target.value)} placeholder="Authorization Code" className="w-72 px-4 py-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl mt-6 outline-none focus:border-[var(--pos-primary,#F59E0B)] text-[#0F172A] font-bold" />
              </div>
            )}

            {/* JazzCash & EasyPaisa — gateway isn't configured yet; be
                honest about it instead of showing a QR that goes nowhere. */}
            {(activeMethod === 'JAZZCASH' || activeMethod === 'EASYPAISA') && (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
                <div className="w-32 h-32 rounded-full border-2 border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-center mb-6">
                  <span className="material-symbols-outlined text-6xl text-[#94A3B8]">lock</span>
                </div>
                <h3 className="text-2xl font-bold font-clash text-[#0F172A]">{activeMethod === 'JAZZCASH' ? 'JazzCash' : 'EasyPaisa'} Isn't Connected</h3>
                <p className="text-[#64748B] font-medium mt-2 max-w-sm">
                  This payment gateway hasn't been configured for this branch yet. Ask a manager to set it up, or take payment as Cash or Card instead.
                </p>
              </div>
            )}

            {/* Split Panel */}
            {(activeMethod === 'SPLIT') && (
              <div className="flex-1 flex flex-col gap-6 mt-6 max-w-lg">
                <h3 className="font-bold text-lg text-[#0F172A]">Split Payment — Total: PKR {totalWithTip.toFixed(2)}</h3>
                <div className="flex gap-4 items-center">
                  <select value={splitMethod1} onChange={(e) => setSplitMethod1(e.target.value as any)} className="px-4 py-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl flex-1 outline-none text-[#0F172A] font-semibold">
                    <option value="CASH">Cash</option>
                    <option value="CARD">Card</option>
                  </select>
                  <div className="flex items-center gap-2 flex-1 relative">
                    <span className="absolute left-4 font-bold text-[#64748B]">PKR</span>
                    <input type="number" value={splitAmount1} onChange={(e) => setSplitAmount1(e.target.value)} className="w-full pl-14 pr-4 py-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl outline-none text-[#0F172A] font-bold" />
                  </div>
                </div>
                <div className="flex gap-4 items-center">
                  <select value={splitMethod2} onChange={(e) => setSplitMethod2(e.target.value as any)} className="px-4 py-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl flex-1 outline-none text-[#0F172A] font-semibold">
                    <option value="CASH">Cash</option>
                    <option value="CARD">Card</option>
                  </select>
                  <div className="flex items-center gap-2 flex-1 relative">
                    <span className="absolute left-4 font-bold text-[#64748B]">PKR</span>
                    <input type="text" readOnly value={splitNum2.toFixed(2)} className="w-full pl-14 pr-4 py-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl outline-none text-[#0F172A] font-bold opacity-70" />
                  </div>
                </div>
                {splitNum1 > 0 && !isSplitValid && (
                  <p className="text-rose-600 text-sm font-bold">Split amounts must add up to PKR {totalWithTip.toFixed(2)}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sticky Bottom Bar */}
        <div className="px-6 py-6 shrink-0 flex flex-col gap-4 relative z-10 border-t border-[#E2E8F0] bg-[#F8FAFC]">
          {itemsUnavailable && orderTotal > 0 && totalWithTip > 0 && (
            <p className="text-amber-600 text-[12px] font-semibold text-center">
              Line items couldn’t load — billing the order total. The server confirms the final amount.
            </p>
          )}
          {totalWithTip <= 0 && (
            <p className="text-rose-600 text-sm font-bold text-center">
              This order’s total couldn’t be read. Reopen it from Tickets, or cancel it — payment can’t be collected for PKR 0.
            </p>
          )}
          <div className="flex gap-4">
            <button
              onClick={handleConfirm}
              disabled={totalWithTip <= 0 || isProcessing || UNCONFIGURED_METHODS.includes(activeMethod) || (activeMethod === 'CASH' && !isCashValid) || (activeMethod === 'SPLIT' && !isSplitValid)}
              className={`flex-1 h-[60px] bg-[var(--pos-primary,#F59E0B)] text-white rounded-2xl flex items-center justify-center gap-3 font-headline-sm text-lg font-bold transition-all active:scale-[0.98] shadow-md disabled:opacity-50 disabled:active:scale-100 ${(UNCONFIGURED_METHODS.includes(activeMethod) || (activeMethod === 'CASH' && !isCashValid) || (activeMethod === 'SPLIT' && !isSplitValid)) ? 'opacity-50 cursor-not-allowed' : ''
                }`}
            >
              {isProcessing ? (
                <span className="material-symbols-outlined animate-spin">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined">check_circle</span>
              )}
              {isProcessing ? 'Processing...' : 'Confirm Payment'}
            </button>
            <button
              onClick={() => handlePrintReceipt(activeMethod, cashNum || totalWithTip, changeDue)}
              className="w-[60px] h-[60px] flex items-center justify-center rounded-2xl border border-[#CBD5E1] bg-white transition-all text-[#0F172A] hover:bg-[#F1F5F9] shadow-sm"
            >
              <span className="material-symbols-outlined">print</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
