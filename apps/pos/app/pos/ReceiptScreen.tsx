'use client';

import { useCartStore } from '@/lib/store';
import type { PrintOrder } from '@/lib/printer/templates';

interface OrderResult {
  orderNumber: string;
  tokenNumber: string;
  total: number;
}

interface Props {
  result: OrderResult;
  onClose: () => void;
  changeGiven?: number;
}

export default function ReceiptScreen({ result, onClose, changeGiven = 0 }: Props) {
  const session = useCartStore((s) => s.session);
  const cart = useCartStore((s) => s.cart);
  const subtotal = useCartStore((s) => s.subtotal());
  const discountAmount = useCartStore((s) => s.discountAmount());
  const taxAmount = useCartStore((s) => s.taxAmount());
  const orderType = useCartStore((s) => s.orderType);

  const handlePrint = async () => {
    try {
      const { printDocument } = await import('@/lib/print.service');
      await printDocument('PAID_RECEIPT', {
        orderNumber: result.orderNumber,
        tokenNumber: result.tokenNumber,
        type: orderType || 'DINE_IN',
        cashierName: session?.cashierName ?? undefined,
        tenantName: session?.restaurantName || 'Dineiz',
        branchName: session?.branchName || 'Branch',
        items: cart.map((c) => ({
          name: c.name,
          quantity: c.quantity,
          unitPrice: c.unitPrice,
          subtotal: c.subtotal,
          notes: c.notes,
          variationName: c.selectedVariation?.name,
          addOnNames: c.selectedAddOns.map((a) => a.name),
        })),
        subtotal: subtotal,
        discountAmount: discountAmount,
        taxAmount: taxAmount,
        total: result.total,
        paymentMethod: 'CASH', // simplified
        changeGiven: changeGiven > 0 ? changeGiven : undefined,
        createdAt: new Date(),
      } as any);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 bg-[var(--pos-bg-base)] z-[200] flex flex-col items-center animate-entrance-fade font-body-md text-[var(--pos-text-primary)] overflow-hidden">
      {/* TOP NAVIGATION BAR */}
      <header className="w-full h-16 bg-[var(--pos-bg-card)] flex items-center justify-between px-6 border-b border-[#E5E7EB]/10 z-50 shrink-0">
        <button onClick={onClose} className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors font-bold text-sm">
          <span className="material-symbols-outlined">arrow_back</span>
          Back
        </button>
        <h1 className="font-bold text-sm text-on-surface-variant uppercase tracking-widest">Receipt Preview</h1>
        <button className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors font-bold text-sm">
          Share
          <span className="material-symbols-outlined">share</span>
        </button>
      </header>

      <main className="flex-1 py-8 w-full flex flex-col items-center overflow-y-auto no-scrollbar">
        {/* RECEIPT CARD */}
        <div className="w-[400px] bg-[var(--pos-bg-card)] rounded-2xl border border-[#E5E7EB] shadow-[0_10px_30px_-10px_rgba(0,0,0,0.1)] p-6 flex flex-col gap-4 mb-8">
          
          {/* Header */}
          <div className="flex flex-col items-center text-center gap-1">
            <div className="w-12 h-12 mb-2 bg-[#F3F4F6] rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-3xl">restaurant</span>
            </div>
            <h2 className="font-clash font-bold text-2xl text-[var(--pos-text-primary)]">Dineiz</h2>
            <p className="text-sm text-[#6B7280]">{session?.branchName || 'Main Branch'}</p>
            <p className="text-xs text-[#6B7280]/70 mt-1">Thank you for visiting</p>
          </div>
          
          <div className="w-full h-px my-2" style={{ backgroundImage: 'linear-gradient(to right, #3c3329 50%, transparent 50%)', backgroundSize: '10px 1px', backgroundRepeat: 'repeat-x' }}></div>
          
          {/* Order Info Grid */}
          <div className="grid grid-cols-2 gap-y-3">
            <div className="flex flex-col">
              <span className="text-xs text-[#6B7280] uppercase opacity-60 font-bold">Receipt No</span>
              <span className="text-sm font-semibold text-[var(--pos-text-primary)]">{result.orderNumber.substring(0,10)}...</span>
            </div>
            <div className="flex flex-col text-right">
              <span className="text-xs text-[#6B7280] uppercase opacity-60 font-bold">Date</span>
              <span className="text-sm text-[var(--pos-text-primary)]">{new Date().toLocaleDateString()}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-[#6B7280] uppercase opacity-60 font-bold">Token</span>
              <span className="text-sm text-[var(--pos-text-primary)]">{result.tokenNumber}</span>
            </div>
            <div className="flex flex-col text-right">
              <span className="text-xs text-[#6B7280] uppercase opacity-60 font-bold">Time</span>
              <span className="text-sm text-[var(--pos-text-primary)]">{new Date().toLocaleTimeString()}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-[#6B7280] uppercase opacity-60 font-bold">Server</span>
              <span className="text-sm text-[var(--pos-text-primary)]">{session?.cashierName || 'Operator'}</span>
            </div>
          </div>
          
          <div className="w-full h-px my-2" style={{ backgroundImage: 'linear-gradient(to right, #3c3329 50%, transparent 50%)', backgroundSize: '10px 1px', backgroundRepeat: 'repeat-x' }}></div>
          
          {/* Items Table */}
          <table className="w-full text-left">
            <thead>
              <tr className="text-[11px] text-[#6B7280] uppercase tracking-tighter border-b border-[#3c3329]">
                <th className="pb-2 font-semibold">Item</th>
                <th className="pb-2 text-center font-semibold">Qty</th>
                <th className="pb-2 text-right font-semibold">Price</th>
                <th className="pb-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody className="text-sm text-[var(--pos-text-primary)]">
              {cart.map((c, i) => (
                <tr key={i} className={i === cart.length - 1 ? "border-b border-dashed border-[#3c3329]" : ""}>
                  <td className="py-3 pr-2 font-medium">{c.name}</td>
                  <td className="py-3 text-center">{c.quantity}</td>
                  <td className="py-3 text-right">{c.unitPrice.toFixed(0)}</td>
                  <td className="py-3 text-right">{c.subtotal.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {/* Totals */}
          <div className="flex flex-col gap-2 mt-2">
            <div className="flex justify-between text-sm text-[#6B7280]">
              <span>Subtotal</span>
              <span>{subtotal.toFixed(0)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm text-[#10B981]">
                <span>Discount</span>
                <span>-{discountAmount.toFixed(0)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm text-[#6B7280]">
              <span>GST Tax (17%)</span>
              <span>{taxAmount.toFixed(0)}</span>
            </div>
            {changeGiven > 0 && (
              <div className="flex justify-between text-sm text-[#6B7280]">
                <span>Change Given</span>
                <span>{changeGiven.toFixed(0)}</span>
              </div>
            )}
            <div className="flex justify-between items-end mt-4 border-t-2 border-midnight pt-4">
              <div className="flex flex-col">
                <span className="text-xs text-[#6B7280] uppercase tracking-widest font-bold">Total Paid</span>
              </div>
              <span className="font-clash font-bold text-[28px] text-[var(--pos-text-primary)] leading-none">PKR {result.total.toFixed(0)}</span>
            </div>
          </div>
          
          <div className="w-full h-px my-2" style={{ backgroundImage: 'linear-gradient(to right, #3c3329 50%, transparent 50%)', backgroundSize: '10px 1px', backgroundRepeat: 'repeat-x' }}></div>
          
          {/* Footer */}
          <div className="flex flex-col items-center text-center gap-4 py-2">
            <h3 className="font-bold text-[16px] text-[var(--pos-text-primary)]">Thank you for dining with us!</h3>
            <p className="text-[10px] text-[#6B7280]/50 uppercase tracking-[0.2em] mt-2 font-bold">Powered by Dineiz</p>
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div className="w-[400px] grid grid-cols-2 gap-4">
          <button onClick={handlePrint} className="flex items-center justify-center gap-2 py-4 bg-primary text-on-primary font-bold rounded-xl hover:opacity-90 active:scale-95 transition-all">
            <span className="material-symbols-outlined">print</span>
            Print Receipt
          </button>
          <button className="flex items-center justify-center gap-2 py-4 bg-[#25D366] text-white font-bold rounded-xl hover:opacity-90 active:scale-95 transition-all">
            <span className="material-symbols-outlined">chat</span>
            WhatsApp
          </button>
          <button className="flex items-center justify-center gap-2 py-4 bg-[#4A90E2] text-white font-bold rounded-xl hover:opacity-90 active:scale-95 transition-all">
            <span className="material-symbols-outlined">mail</span>
            Email
          </button>
          <button onClick={onClose} className="flex items-center justify-center gap-2 py-4 border border-[#3c3329] text-[#6B7280] font-bold rounded-xl hover:bg-[var(--pos-bg-elevated)] active:scale-95 transition-all">
            <span className="material-symbols-outlined">close</span>
            Done
          </button>
        </div>
        
        <div className="mt-12 mb-8">
          <button onClick={onClose} className="group flex items-center gap-2 font-bold text-xl text-primary hover:text-amber-600 transition-colors">
            New Order 
            <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
          </button>
        </div>
      </main>
    </div>
  );
}
