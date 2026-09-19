'use client';

import { Modal } from '@/components/ui/Modal';
import { useState, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { useCartStore } from '@/lib/store';
import { useBrandingStore } from '@/lib/branding-store';
import { getToken } from '@/lib/pos-session';
import { useViews, resolveLocalOrderId } from '@/lib/core/views';
import { ReceiptView, type ReceiptData } from '@/components/ReceiptView';
import { OrderTypeBadge } from '@/components/OrderStatusBadge';
import { formatPKR } from '@/lib/utils';
import { API_URL } from '@/lib/api';
import { resolveTaxConfig, isCardMethod, roundMoney } from '@/lib/pricing';
import { Banknote, Check, CheckCircle2, CreditCard, Delete, Loader2, Lock, MessageSquare, Printer, QrCode, Split, X } from 'lucide-react';
import { ServiceIllustration } from '@/components/ServiceIllustration';

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
  // `orderId` may be a client id OR a server id (a "Settle" deep link carries
  // the server id) — resolve to the view store's key either way.
  const viewOrder = useViews((s) => (orderId ? s.orders[resolveLocalOrderId(orderId)] : undefined));

  // For an order with an id, the EVENT STORE copy is authoritative: its lines
  // carry `unitPrice` straight from the ITEM_ADDED events this terminal wrote.
  // The `items` prop is the order screen's `[...existingItems, ...cart]`,
  // stitched from async fetches whose line `subtotal` is sometimes pre-tax and
  // sometimes post-tax depending on which endpoint won the race — that made the
  // total read 900.14 on open and then jump to 945 a minute later. Prefer the
  // event store; the prop and the cart are fallbacks.
  const viewItemsPriced = useMemo(() => {
    if (!orderId || !viewOrder?.items?.length) return null;
    const mapped = viewOrder.items
      .filter((i: any) => !i.voided)
      .map((i: any) => ({
        quantity: i.qty,
        unitPrice: i.unitPrice,
        subtotal: (i.unitPrice ?? 0) * (i.qty ?? 1),
        name: i.itemName,
      }));
    return mapped.some((m) => m.subtotal > 0) ? mapped : null;
  }, [orderId, viewOrder]);

  const displayItems = useMemo(() => {
    if (viewItemsPriced) return viewItemsPriced;
    if (items && items.length > 0) return items;
    return orderId ? [] : cart;
  }, [viewItemsPriced, items, cart, orderId]);

  // True when displayItems came from the event store — then the sum is the
  // real pre-tax subtotal and needs no cross-check against `orderTotal`.
  const itemsFromEventStore = !!viewItemsPriced;

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
  // order never actually gets paid. (Superseded by `itemsTrustworthy` below,
  // which also catches a partially-loaded line list, not just an empty one.)

  // ── Dual Tax Reactive Logic ──
  const branding = useBrandingStore(s => s.branding);

  // Configuration comes from lib/pricing.ts's resolver, not from a local
  // reading of `branding` — this file had its own copy of the rate/label
  // lookup with its own defaults, and it read only the top level of the
  // branding blob, so a rate delivered under `branding.pos.*` silently became
  // the hardcoded 5%/17%. It also ignored `taxRoundingMethod` entirely, while
  // the server (order.service.ts's applyRounding) honours it — so a tenant on
  // FLOOR/CEIL had the client and server disagree by a rupee on every bill.
  //
  // Rates are kept as PERCENTS in this component (it displays "(5%)" and
  // divides by 100 in several places); the resolver returns decimals.
  const taxCfg = useMemo(() => resolveTaxConfig(branding), [branding]);
  const getTaxRate = (paymentMethod: string): number =>
    (isCardMethod(paymentMethod) ? taxCfg.cardTaxRate : taxCfg.cashTaxRate) * 100;
  const getTaxLabel = (paymentMethod: string): string =>
    isCardMethod(paymentMethod) ? taxCfg.cardTaxLabel : taxCfg.cashTaxLabel;

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
  const taxEnabled = isCardMethod(activeMethod) ? taxCfg.cardTaxEnabled : taxCfg.cashTaxEnabled;
  const taxRate = taxEnabled ? getTaxRate(activeMethod) : 0;

  // What we can bill from the visible lines:
  //  - straight from the event store → the sum IS the real pre-tax subtotal,
  //    trust it outright (no cross-check — the `orderTotal` prop is a stale
  //    downstream figure and was the one that flipped 900 → 945).
  //  - from the `items` prop / cart → only trust it if the tax-inclusive total
  //    it implies lands within 5% of the known `orderTotal`; a partially-loaded
  //    list undercounts (was: 9-item PKR 6,300 order billed PKR 735).
  const impliedGross = subtotalFromItems + Math.round(subtotalFromItems * (taxRate / 100));
  const itemsTrustworthy =
    subtotalFromItems > 0 &&
    (itemsFromEventStore ||
      !orderId ||
      orderTotal <= 0 ||
      Math.abs(impliedGross - orderTotal) <= Math.max(2, orderTotal * 0.05));

  // Fallback: we only know the gross `orderTotal`. Split it so subtotal + tax
  // === orderTotal EXACTLY (no rounding drift — that drift is what showed
  // "Total Due 900.14" for a PKR 900 order). `dynamicTotal` is pinned to
  // `orderTotal` below in this case.
  const fallbackTax = orderTotal > 0 ? orderTotal - Math.round(orderTotal / (1 + taxRate / 100)) : 0;
  const subtotal = itemsTrustworthy
    ? subtotalFromItems
    : (orderTotal > 0 ? orderTotal - fallbackTax : subtotalFromItems);

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
  // roundMoney, not Math.round — the server applies the tenant's configured
  // taxRoundingMethod (order.service.ts's applyRounding) and this side ignored
  // it, so FLOOR/CEIL tenants saw the client and server differ by a rupee.
  const taxAmount = itemsTrustworthy
    ? roundMoney(taxableSubtotal * (taxRate / 100), taxCfg.taxRoundingMethod)
    : Math.max(0, fallbackTax - roundMoney((discountAmount + loyaltyDiscount) * (taxRate / 100), taxCfg.taxRoundingMethod));
  const taxLabel = taxEnabled ? `${getTaxLabel(activeMethod)} (${taxRate}%)` : 'Tax Disabled';

  // When we're billing from the known gross `orderTotal` (items not trustworthy),
  // the total to charge IS `orderTotal` minus any discount — pinned exactly, no
  // reconstructed subtotal+tax that drifts by a rupee (the "900.14" bug).
  const dynamicTotal = itemsTrustworthy || orderTotal <= 0
    ? taxableSubtotal + taxAmount
    : Math.max(0, Math.round(orderTotal) - discountAmount - loyaltyDiscount);

  const [tipPercent, setTipPercent] = useState<number>(0);
  const [customTip, setCustomTip] = useState<string>('');
  const [showCustomTip, setShowCustomTip] = useState(false);
  const tipAmount = showCustomTip
    ? parseFloat(customTip) || 0
    : parseFloat(((dynamicTotal * tipPercent) / 100).toFixed(2));
  const totalWithTip = dynamicTotal + tipAmount;

  const paymentInFlight = useRef(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  // What was actually charged when payment succeeded — captured once so the
  // receipt (and the deferred onSuccess call once the cashier dismisses it)
  // can still show/report it after `activeMethod`/amountEntered have reset.
  const [finalPaymentInfo, setFinalPaymentInfo] = useState<{ method: string; tendered: number; change: number } | null>(null);
  const clearCart = useCartStore((s) => s.clearCart);


  const cashNum = parseFloat(amountEntered) || 0;
  const changeDue = Math.max(0, cashNum - totalWithTip);
  const isCashValid = cashNum >= totalWithTip;

  const splitNum1 = parseFloat(splitAmount1) || 0;
  const splitNum2 = Math.max(0, totalWithTip - splitNum1);
  const isSplitValid = splitNum1 > 0 && splitNum2 > 0 && Math.abs(splitNum1 + splitNum2 - totalWithTip) < 0.01;

  // Pre-fill the exact amount once, when the sheet opens — not on every
  // totalWithTip recalc. Tip%, a custom tip, or toggling loyalty redemption
  // all change totalWithTip, and re-running this on that dependency
  // overwrote whatever the cashier had already typed with the new total,
  // silently discarding a real tendered amount mid-transaction.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isOpen) {
      setAmountEntered(Math.ceil(totalWithTip).toString());
    }
  }, [isOpen]);

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
    if (paymentInFlight.current) return;
    // Never queue a PKR 0 payment — the server rejects it (422) and the order
    // silently bounces back onto the board. If we got here with no total,
    // the order's lines didn't resolve; tell the cashier to reopen it.
    if (!(totalWithTip > 0)) {
      toast.error("Nothing to charge — this order's total came through as zero. Reopen it from Tickets.");
      return;
    }
    paymentInFlight.current = true;
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
        transactionRef: payload.transactionRef,
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
      toast.error(e instanceof Error ? e.message : 'Could not save payment. Check this order before trying again.');
    } finally {
      paymentInFlight.current = false;
      setIsProcessing(false);
    }
  };

  const handleConfirm = () => {
    if (UNCONFIGURED_METHODS.includes(activeMethod)) {
      toast.error(`${activeMethod === 'JAZZCASH' ? 'JazzCash' : 'EasyPaisa'} isn't connected yet — ask a manager to configure it, or choose Cash or Card.`);
      return;
    }
    if (activeMethod === 'CASH') {
      if (!isCashValid) return;
      submitPayment({ method: 'CASH', amount: totalWithTip, change: changeDue, tip: tipAmount });
    } else if (activeMethod === 'CARD') {
      if (!authCode) { toast.error('Enter the authorization code from the card terminal.'); return; }
      submitPayment({ method: 'CARD', amount: totalWithTip, transactionRef: authCode, tip: tipAmount });
    } else if (activeMethod === 'SPLIT') {
      if (!isSplitValid) return;
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

  const orderLabel = `#${orderNumber || orderId.slice(-6)}`;
  const changeText = finalPaymentInfo?.method === 'CASH' && finalPaymentInfo.change > 0
    ? `Give ${formatPKR(Math.round(finalPaymentInfo.change))} change`
    : 'The order is complete.';

  if (showSuccess && receiptSnapshot) {
    return (
      <Modal isOpen label="Payment received" onClose={handleDone} className="max-w-[520px]"><div className="flex flex-col items-center overflow-y-auto py-6 px-4">
        <ServiceIllustration kind="payment" className="w-36 h-[115px] mb-2 shrink-0" />
        <h2 className="text-[20px] font-semibold text-ink">Payment received</h2>
        <p className={`mt-1 mb-6 text-[15px] ${finalPaymentInfo?.method === 'CASH' && (finalPaymentInfo?.change ?? 0) > 0 ? 'font-semibold text-ink' : 'text-ink-3'}`}>
          {changeText}
        </p>

        <ReceiptView data={receiptSnapshot} />

        <div className="w-full max-w-[380px] flex flex-col gap-2.5 mt-6">
          <div className="flex gap-2.5">
            <button
              onClick={() => handlePrintReceipt(finalPaymentInfo?.method || receiptSnapshot.paymentMethod, finalPaymentInfo?.tendered || 0, finalPaymentInfo?.change || 0)}
              disabled={isPrinting}
              className="flex-1 h-12 rounded-xl border border-line-strong bg-surface text-ink text-[14px] font-semibold flex items-center justify-center gap-2 hover:bg-sunken disabled:opacity-50"
            >
              {isPrinting ? <Loader2 className="animate-spin w-4 h-4" /> : <Printer className="w-4 h-4" />}
              {isPrinting ? 'Printing…' : 'Print receipt'}
            </button>
            {customerPhone && (
              <a
                href={`https://wa.me/${customerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(`Thanks for your order! Your receipt total was PKR ${Math.round(receiptSnapshot.total).toLocaleString()}.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 h-12 rounded-xl border border-line-strong bg-surface text-ink text-[14px] font-semibold flex items-center justify-center gap-2 hover:bg-sunken"
              >
                <MessageSquare className="w-4 h-4 text-ok" />
                Message
              </a>
            )}
          </div>
          <button
            onClick={handleDone}
            className="w-full h-12 rounded-xl bg-brand text-on-brand text-[15px] font-semibold hover:bg-brand-strong"
          >
            Done
          </button>
        </div>
      </div></Modal>
    );
  }

  const unconfigured = UNCONFIGURED_METHODS.includes(activeMethod);
  const confirmDisabled =
    totalWithTip <= 0 || isProcessing || unconfigured ||
    (activeMethod === 'CASH' && !isCashValid) ||
    (activeMethod === 'SPLIT' && !isSplitValid);
  // The button says what it will do, or what's missing — never just "Confirm".
  const confirmLabel = isProcessing
    ? 'Processing…'
    : unconfigured
      ? 'Not connected'
      : activeMethod === 'CASH'
        ? (isCashValid
            ? `Collect ${formatPKR(totalWithTip)}${changeDue > 0 ? ` · change ${formatPKR(Math.round(changeDue))}` : ''}`
            : `Enter at least ${formatPKR(totalWithTip)}`)
        : activeMethod === 'SPLIT'
          ? (isSplitValid ? `Collect ${formatPKR(totalWithTip)}` : 'Split must add up to the total')
          : `Charge ${formatPKR(totalWithTip)} to card`;

  const quick = [500, 1000, 2000, 5000];
  const keyCls = 'h-14 rounded-xl bg-sunken border border-line text-ink text-[20px] font-semibold tabular-nums hover:bg-hover active:scale-[0.97] transition';
  const segCls = (active: boolean) =>
    `h-11 rounded-lg text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-colors ${
      active ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(15,23,42,0.08)]' : 'text-ink-3 hover:text-ink'
    }`;

  return (
    <Modal isOpen onClose={isProcessing ? undefined : onClose} label={`Charge order ${orderLabel}`} sheetOnMobile className="md:max-w-[1000px] h-[95dvh] md:h-[min(780px,calc(100dvh-32px))] md:flex-row">
        {/* ── The bill ─────────────────────────────────────────────────── */}
        <aside className="md:w-[360px] shrink-0 flex flex-col bg-canvas border-b md:border-b-0 md:border-r border-line max-h-[42%] md:max-h-none">
          <header className="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[18px] font-semibold text-ink">Charge</h1>
              <div className="mt-1 flex items-center gap-2 text-[13px] text-ink-3">
                <span className="tabular-nums whitespace-nowrap">{orderLabel}</span>
                <OrderTypeBadge type={tableLabel ? 'DINE_IN' : (useCartStore.getState().orderType || 'TAKEAWAY')} tableLabel={tableLabel} size="sm" />
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="md:hidden w-11 h-11 grid place-items-center rounded-lg text-ink-3 hover:bg-sunken hover:text-ink shrink-0"
            >
              <X className="w-[18px] h-[18px]" />
            </button>
          </header>

          <ul className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-5 divide-y divide-line">
            {displayItems.map((c: any, i: number) => {
              const mods = [
                c.selectedVariation?.name || c.options?.variation?.name,
                ...(c.selectedAddOns || c.options?.addOns || []).map((a: any) => `+ ${a.name}`),
              ].filter(Boolean).join(' · ');
              return (
                <li key={i} className="py-2.5 flex gap-3">
                  <span className="w-6 shrink-0 text-right text-[13.5px] font-semibold text-ink tabular-nums">{c.quantity}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] text-ink truncate">{c.name || c.item?.name || c.itemName || 'Item'}</p>
                    {mods && <p className="text-[12px] text-ink-3 truncate">{mods}</p>}
                  </div>
                  <span className="text-[13.5px] text-ink-2 tabular-nums shrink-0">{formatPKR(c.subtotal || (c.unitPrice * c.quantity) || 0)}</span>
                </li>
              );
            })}
          </ul>

          <div className="px-5 pt-3 pb-5 border-t border-line bg-canvas">
            {loyaltyProfile && loyaltySettings && loyaltySettings.isActive && (
              <label className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5 cursor-pointer">
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-semibold text-ink">Use loyalty points</span>
                  <span className="block text-[12px] text-ink-3 tabular-nums">{loyaltyProfile.loyaltyPoints} available</span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={useLoyaltyPoints}
                  onClick={() => setUseLoyaltyPoints(!useLoyaltyPoints)}
                  className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${useLoyaltyPoints ? 'bg-brand' : 'bg-line-strong'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${useLoyaltyPoints ? 'translate-x-5' : ''}`} />
                </button>
              </label>
            )}
            <dl className="space-y-1.5 text-[13.5px]">
              <div className="flex justify-between"><dt className="text-ink-3">Subtotal</dt><dd className="text-ink-2 tabular-nums">{formatPKR(subtotal)}</dd></div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-ok"><dt>Discount</dt><dd className="tabular-nums">− {formatPKR(discountAmount)}</dd></div>
              )}
              {loyaltyDiscount > 0 && (
                <div className="flex justify-between text-ok"><dt>Loyalty ({redeemedPoints} pts)</dt><dd className="tabular-nums">− {formatPKR(loyaltyDiscount)}</dd></div>
              )}
              <div className="flex justify-between"><dt className="text-ink-3">{taxLabel}</dt><dd className="text-ink-2 tabular-nums">{formatPKR(taxAmount)}</dd></div>
              {tipAmount > 0 && (
                <div className="flex justify-between"><dt className="text-ink-3">Tip</dt><dd className="text-ink-2 tabular-nums">+ {formatPKR(tipAmount)}</dd></div>
              )}
              <div className="flex justify-between items-baseline pt-2.5 mt-1 border-t border-line">
                <dt className="text-[15px] font-semibold text-ink">Total due</dt>
                <dd className="text-[26px] font-bold text-ink tabular-nums tracking-tight">{formatPKR(totalWithTip)}</dd>
              </div>
            </dl>
          </div>
        </aside>

        {/* ── Taking the money ─────────────────────────────────────────── */}
        <section className="flex-1 min-w-0 min-h-0 flex flex-col">
          <div className="px-5 md:px-6 pt-5 flex items-center gap-3">
            <div className="flex-1 grid grid-cols-3 sm:grid-cols-5 gap-0.5 p-1 rounded-xl bg-sunken border border-line">
              {[
                { method: 'CASH' as PaymentMethod, Icon: Banknote, label: 'Cash' },
                { method: 'CARD' as PaymentMethod, Icon: CreditCard, label: 'Card' },
                { method: 'SPLIT' as PaymentMethod, Icon: Split, label: 'Split' },
                { method: 'JAZZCASH' as PaymentMethod, Icon: QrCode, label: 'JazzCash' },
                { method: 'EASYPAISA' as PaymentMethod, Icon: QrCode, label: 'EasyPaisa' },
              ].map(({ method, Icon, label }) => {
                const locked = UNCONFIGURED_METHODS.includes(method);
                return (
                  <button
                    key={method}
                    onClick={() => { setActiveMethod(method); setAmountEntered(''); }}
                    title={locked ? `${label} isn't connected yet` : undefined}
                    className={`${segCls(activeMethod === method)} ${locked ? 'opacity-55' : ''}`}
                  >
                    {locked ? <Lock className="w-3.5 h-3.5" /> : <Icon className="w-4 h-4" />}
                    <span className="truncate">{label}</span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="hidden md:grid w-10 h-10 place-items-center rounded-lg text-ink-3 hover:bg-sunken hover:text-ink shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tip */}
          <div className="px-5 md:px-6 pt-3 flex items-center gap-3">
            <span className="text-[13px] font-medium text-ink-3 w-8 shrink-0">Tip</span>
            {showCustomTip ? (
              <div className="flex-1 flex items-center gap-2">
                <label className="flex-1 h-10 px-3 flex items-center gap-2 rounded-lg border border-line-strong focus-within:border-ink bg-surface">
                  <span className="text-[12.5px] font-semibold text-ink-3">PKR</span>
                  <input
                    type="number"
                    value={customTip}
                    onChange={(e) => setCustomTip(e.target.value)}
                    placeholder="0"
                    className="w-full bg-transparent outline-none focus:shadow-none text-[15px] font-semibold text-ink tabular-nums"
                    autoFocus
                  />
                </label>
                <button
                  onClick={() => { setShowCustomTip(false); setCustomTip(''); setTipPercent(0); }}
                  className="h-10 px-3 rounded-lg text-[13px] font-semibold text-ink-3 hover:bg-sunken hover:text-ink"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex-1 grid grid-cols-5 gap-0.5 p-1 rounded-xl bg-sunken border border-line">
                {[0, 10, 15, 20].map((pct) => (
                  <button key={pct} onClick={() => setTipPercent(pct)} className={segCls(tipPercent === pct)}>
                    {pct === 0 ? 'None' : `${pct}%`}
                  </button>
                ))}
                <button onClick={() => { setShowCustomTip(true); setTipPercent(0); }} className={segCls(false)}>
                  Custom
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-5 md:px-6 py-5">
            {activeMethod === 'CASH' && (
              <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex-1 min-w-0 flex flex-col gap-4">
                  {/* Stacked, not side by side: beside the keypad at tablet width
                      two 28px amounts didn't fit and "Received" truncated. */}
                  <div className="rounded-xl border border-line divide-y divide-line">
                    <div className="px-4 py-3 flex items-baseline justify-between gap-3">
                      <p className="text-[13px] text-ink-3">Received</p>
                      <p className="text-[26px] font-bold text-ink tabular-nums tracking-tight whitespace-nowrap">
                        {formatPKR(Number(amountEntered || 0))}
                      </p>
                    </div>
                    <div className="px-4 py-3 flex items-baseline justify-between gap-3">
                      <p className="text-[13px] text-ink-3">Change</p>
                      <p className={`text-[26px] font-bold tabular-nums tracking-tight whitespace-nowrap ${isCashValid ? 'text-ok' : 'text-ink-4'}`}>
                        {isCashValid ? formatPKR(Math.round(changeDue)) : '—'}
                      </p>
                    </div>
                  </div>
                  {!isCashValid && cashNum > 0 && (
                    <p className="-mt-1.5 text-[13px] text-ink-3">
                      {formatPKR(Math.ceil(totalWithTip - cashNum))} more to cover the total.
                    </p>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setAmountEntered(Math.ceil(totalWithTip).toString())}
                      className="h-11 rounded-lg border border-ink text-ink text-[13.5px] font-semibold hover:bg-sunken"
                    >
                      Exact
                    </button>
                    {quick.map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setAmountEntered((prev) => (Number(prev || 0) + amt).toString())}
                        className="h-11 rounded-lg border border-line-strong text-ink-2 text-[13.5px] font-semibold tabular-nums hover:bg-sunken hover:text-ink"
                      >
                        + {amt.toLocaleString('en-US')}
                      </button>
                    ))}
                    <button
                      onClick={() => setAmountEntered('')}
                      className="h-11 rounded-lg text-[13.5px] font-semibold text-ink-3 hover:bg-sunken hover:text-ink"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="lg:w-[300px] shrink-0 grid grid-cols-3 gap-2 content-start">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'backspace'].map((key) =>
                    key === 'backspace' ? (
                      <button key={key} onClick={() => handleNumpad('backspace')} className={`${keyCls} grid place-items-center text-ink-2`} aria-label="Delete">
                        <Delete className="w-5 h-5" />
                      </button>
                    ) : key === '00' ? (
                      <button key={key} onClick={() => setAmountEntered((prev) => (prev ? `${prev}00` : prev))} className={keyCls}>00</button>
                    ) : (
                      <button key={key} onClick={() => handleNumpad(key)} className={keyCls}>{key}</button>
                    ),
                  )}
                </div>
              </div>
            )}

            {activeMethod === 'CARD' && (
              <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center">
                <span className="w-14 h-14 rounded-2xl bg-sunken text-ink-2 grid place-items-center mb-4">
                  <CreditCard className="w-7 h-7" />
                </span>
                <p className="text-[15px] text-ink-3">Take on the card machine</p>
                <p className="mt-0.5 text-[28px] font-bold text-ink tabular-nums tracking-tight">{formatPKR(totalWithTip)}</p>
                <label className="mt-5 w-full max-w-[320px] text-left">
                  <span className="block text-[13px] font-medium text-ink-2 mb-1.5">Authorization code</span>
                  <input
                    type="text"
                    value={authCode}
                    onChange={(e) => setAuthCode(e.target.value)}
                    placeholder="From the card slip"
                    className="w-full h-12 px-3.5 rounded-xl border border-line-strong focus:border-ink focus:shadow-none bg-surface outline-none text-[15px] font-semibold text-ink placeholder:text-ink-4 placeholder:font-normal tracking-wide"
                  />
                </label>
              </div>
            )}

            {unconfigured && (
              <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center px-6">
                <span className="w-14 h-14 rounded-2xl bg-sunken text-ink-3 grid place-items-center mb-4">
                  <Lock className="w-6 h-6" />
                </span>
                <p className="text-[16px] font-semibold text-ink">{activeMethod === 'JAZZCASH' ? 'JazzCash' : 'EasyPaisa'} isn’t connected yet</p>
                <p className="mt-1.5 max-w-sm text-[13.5px] text-ink-3 leading-relaxed">
                  A manager can set it up for this branch. Until then, take this payment as cash or card.
                </p>
              </div>
            )}

            {activeMethod === 'SPLIT' && (
              <div className="max-w-[520px] flex flex-col gap-3">
                <p className="text-[13.5px] text-ink-3">Split {formatPKR(totalWithTip)} across two payments.</p>
                {[
                  { m: splitMethod1, setM: setSplitMethod1, value: splitAmount1, editable: true },
                  { m: splitMethod2, setM: setSplitMethod2, value: String(Math.round(splitNum2)), editable: false },
                ].map((row, i) => (
                  <div key={i} className="flex flex-col sm:flex-row items-stretch gap-2.5">
                    <div className="grid grid-cols-2 gap-0.5 p-1 rounded-xl bg-sunken border border-line w-[168px] shrink-0">
                      {(['CASH', 'CARD'] as const).map((m) => (
                        <button key={m} onClick={() => row.setM(m)} className={segCls(row.m === m)}>
                          {m === 'CASH' ? 'Cash' : 'Card'}
                        </button>
                      ))}
                    </div>
                    <label className={`flex-1 h-12 px-3.5 flex items-center gap-2 rounded-xl border ${row.editable ? 'border-line-strong focus-within:border-ink bg-surface' : 'border-line bg-sunken'}`}>
                      <span className="text-[12.5px] font-semibold text-ink-3">PKR</span>
                      {row.editable ? (
                        <input
                          type="number"
                          value={splitAmount1}
                          onChange={(e) => setSplitAmount1(e.target.value)}
                          placeholder="0"
                          className="w-full bg-transparent outline-none focus:shadow-none text-[16px] font-semibold text-ink tabular-nums"
                        />
                      ) : (
                        <span className="text-[16px] font-semibold text-ink-2 tabular-nums">{Number(row.value).toLocaleString('en-US')}</span>
                      )}
                    </label>
                  </div>
                ))}
                {splitNum1 > 0 && !isSplitValid && (
                  <p className="text-[13px] font-medium text-danger">The two amounts must add up to {formatPKR(totalWithTip)}.</p>
                )}
              </div>
            )}
          </div>

          <footer className="px-5 md:px-6 py-4 border-t border-line flex flex-col gap-2.5 shrink-0">
            {!!orderId && !itemsTrustworthy && orderTotal > 0 && totalWithTip > 0 && (
              <p className="text-[12.5px] text-ink-3 text-center">
                Billing the order’s full total ({formatPKR(Math.round(orderTotal))}); the server confirms the final amount.
              </p>
            )}
            {totalWithTip <= 0 && (
              <p className="text-[13px] font-medium text-danger text-center">
                This order’s total couldn’t be read. Reopen it from Tickets or cancel it; payment can’t be taken for PKR 0.
              </p>
            )}
            <div className="flex gap-2.5">
              <button
                onClick={() => handlePrintReceipt(activeMethod, cashNum || totalWithTip, changeDue)}
                title="Print the bill"
                aria-label="Print the bill"
                className="w-12 h-12 grid place-items-center rounded-xl border border-line-strong text-ink-2 hover:bg-sunken hover:text-ink shrink-0"
              >
                <Printer className="w-5 h-5" />
              </button>
              <button
                onClick={handleConfirm}
                disabled={confirmDisabled}
                className="flex-1 h-12 rounded-xl bg-brand text-on-brand text-[15px] font-semibold flex items-center justify-center gap-2 transition-colors enabled:hover:bg-brand-strong disabled:bg-sunken disabled:text-ink-3 disabled:cursor-not-allowed tabular-nums"
              >
                {isProcessing && <Loader2 className="animate-spin w-4 h-4" />}
                {confirmLabel}
              </button>
            </div>
          </footer>
        </section>
    </Modal>
  );
}
