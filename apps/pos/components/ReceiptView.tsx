'use client';

// Pure presentational receipt — the single implementation of "what a
// receipt looks like" in the POS, mounted in two places:
//   1. PaymentModal's success screen, right after a payment completes
//      (see components/PaymentModal.tsx) — fed straight from the totals
//      PaymentModal already computed, no refetch, cannot land empty.
//   2. app/pos/receipt/page.tsx, for reprints/deep links — fed from a
//      fetched order.
// Keeping one component for both means the two flows can no longer drift
// into two different "receipt" experiences (they used to: paying from the
// order screen pushed to a broken /pos/receipt; paying from the floor plan
// showed no receipt at all).

export interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  variationName?: string | null;
  addOnNames?: string[];
}

export interface ReceiptData {
  tenantName: string;
  fbrNtn?: string | null;
  receiptHeader?: string | null;
  receiptFooter?: string | null;
  orderNumber: string;
  tableLabel?: string | null;
  orderType?: string | null;
  cashierName?: string | null;
  items: ReceiptItem[];
  subtotal: number;
  discountAmount?: number;
  loyaltyDiscount?: number;
  redeemedPoints?: number;
  taxAmount: number;
  taxLabel: string;
  tipAmount?: number;
  total: number;
  paymentMethod: string;
  cashTendered?: number;
  changeGiven?: number;
  createdAt: Date;
}

const money = (n: number) => `PKR ${Math.round(n).toLocaleString('en-PK')}`;

const typeLabel = (t?: string | null) => {
  if (!t) return 'Takeaway';
  if (t.toUpperCase() === 'DINE_IN') return 'Dine-in';
  if (t.toUpperCase() === 'DELIVERY') return 'Delivery';
  return 'Takeaway';
};

export function ReceiptView({ data }: { data: ReceiptData }) {
  return (
    <div className="w-full max-w-[380px] mx-auto bg-white border border-[#E2E8F0] border-t-[3px] border-t-[var(--pos-primary,#F59E0B)] rounded-2xl p-6 shadow-sm font-mono text-[#0F172A]">
      <div className="text-center mb-4">
        <p className="font-bold text-[15px] tracking-tight">{data.tenantName}</p>
        {data.fbrNtn && <p className="text-[10px] text-[#64748B] mt-0.5">NTN: {data.fbrNtn}</p>}
        {data.receiptHeader && <p className="text-[10px] text-[#64748B] mt-1">{data.receiptHeader}</p>}
      </div>

      <div className="border-t border-dashed border-[#CBD5E1] my-3" />

      <div className="space-y-1 text-[11px] text-[#64748B]">
        <div className="flex justify-between"><span>Order</span><span className="text-[#0F172A] font-semibold">#{data.orderNumber}</span></div>
        <div className="flex justify-between"><span>Type</span><span className="text-[#0F172A] font-semibold">{typeLabel(data.orderType)}{data.tableLabel ? ` · Table ${data.tableLabel}` : ''}</span></div>
        {data.cashierName && <div className="flex justify-between"><span>Cashier</span><span className="text-[#0F172A] font-semibold">{data.cashierName}</span></div>}
        <div className="flex justify-between"><span>Time</span><span className="text-[#0F172A] font-semibold">{data.createdAt.toLocaleString('en-PK', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span></div>
      </div>

      <div className="border-t border-dashed border-[#CBD5E1] my-3" />

      <div className="space-y-2.5">
        {data.items.map((item, i) => (
          <div key={i} className="text-[12px]">
            <div className="flex justify-between gap-2">
              <span className="text-[#0F172A]">{item.quantity}× {item.name}</span>
              <span className="text-[#0F172A] font-semibold whitespace-nowrap">{money(item.subtotal)}</span>
            </div>
            {(item.variationName || (item.addOnNames && item.addOnNames.length > 0)) && (
              <p className="text-[10px] text-[#94A3B8] italic pl-3">
                {[item.variationName, ...(item.addOnNames || [])].filter(Boolean).join(', ')}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-dashed border-[#CBD5E1] my-3" />

      <div className="space-y-1.5 text-[12px]">
        <div className="flex justify-between text-[#64748B]">
          <span>Subtotal</span><span className="text-[#0F172A] font-semibold">{money(data.subtotal)}</span>
        </div>
        {!!data.discountAmount && data.discountAmount > 0 && (
          <div className="flex justify-between text-emerald-600 font-semibold">
            <span>Discount</span><span>−{money(data.discountAmount)}</span>
          </div>
        )}
        {!!data.loyaltyDiscount && data.loyaltyDiscount > 0 && (
          <div className="flex justify-between text-[#FF5722] font-semibold">
            <span>Loyalty (−{data.redeemedPoints} pts)</span><span>−{money(data.loyaltyDiscount)}</span>
          </div>
        )}
        <div className="flex justify-between text-[#64748B]">
          <span>{data.taxLabel}</span><span className="text-[#0F172A] font-semibold">{money(data.taxAmount)}</span>
        </div>
        {!!data.tipAmount && data.tipAmount > 0 && (
          <div className="flex justify-between text-[#64748B]">
            <span>Tip</span><span className="text-[#0F172A] font-semibold">{money(data.tipAmount)}</span>
          </div>
        )}
      </div>

      <div className="border-t border-dashed border-[#CBD5E1] my-3" />

      <div className="flex justify-between items-baseline">
        <span className="font-bold text-[14px] uppercase tracking-wide">Total</span>
        <span className="font-bold text-[22px] text-[var(--pos-primary,#F59E0B)]">{money(data.total)}</span>
      </div>

      {data.paymentMethod === 'CASH' && data.cashTendered !== undefined ? (
        <div className="space-y-1 text-[12px] mt-2 text-[#64748B]">
          <div className="flex justify-between"><span>Cash</span><span className="text-[#0F172A] font-semibold">{money(data.cashTendered)}</span></div>
          <div className="flex justify-between"><span>Change</span><span className="text-[#0F172A] font-semibold">{money(data.changeGiven || 0)}</span></div>
        </div>
      ) : (
        <div className="flex justify-between text-[12px] mt-2 text-[#64748B]">
          <span>Paid via</span><span className="text-[#0F172A] font-semibold">{data.paymentMethod}</span>
        </div>
      )}

      {data.receiptFooter && (
        <>
          <div className="border-t border-dashed border-[#CBD5E1] my-3" />
          <p className="text-center text-[10px] text-[#94A3B8] italic">{data.receiptFooter}</p>
        </>
      )}
    </div>
  );
}
