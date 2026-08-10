'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/lib/store';

export default function OrderSuccessPage() {
  const router = useRouter();
  const session = useCartStore((s) => s.session);
  const selectedTableId = useCartStore((s) => (s as any).selectedTableId) || '07';
  
  const [progress, setProgress] = useState(100);
  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);

  useEffect(() => {
    const duration = 30000;
    const interval = 100;
    const decrement = (interval / duration) * 100;
    
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= 0) {
          clearInterval(timer);
          router.push('/pos/tables');
          return 0;
        }
        return prev - decrement;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [router]);

  // Dummy Data for the preview
  const branding = {
    restaurantName: 'The Grand Bistro',
    fbrEnabled: true,
    fbrNtn: '1234567-8',
    receiptFooter: 'THANK YOU FOR DINING WITH US!',
    dineinTaxRate: 17
  };
  
  const branchAddress = 'Plot 45-C, Khayaban-e-Bukhari, Phase 6, DHA, Karachi';
  const order = {
    orderNumber: 'SS-9921',
    tableLabel: selectedTableId,
    createdAt: new Date().toISOString(),
    customerPhone: '',
    items: [
      { id: 1, itemName: 'Double Smash Burger', qty: 2, unitPrice: 1600 },
      { id: 2, itemName: 'Margherita Pizza (12")', qty: 1, unitPrice: 1850 },
      { id: 3, itemName: 'Loaded Fries', qty: 1, unitPrice: 750 }
    ],
    subtotal: 5800,
    taxAmount: 986,
    total: 6786,
    tableId: selectedTableId
  };
  const cashierName = session?.cashierName || 'Ahmed';
  const cashReceived = 7137;
  const change = cashReceived - order.total;

  // Print Receipt:
  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) return;
    
    const html = `
      <html>
        <head><title>Receipt</title></head>
        <body style="font-family: monospace; width: 240px; margin: 0 auto; padding: 10px;">
          <h2 style="text-align: center;">${branding.restaurantName}</h2>
          <p style="text-align: center;">Order: #${order.orderNumber}<br/>Total: PKR ${order.total}</p>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.print(); printWindow.close(); };
  };

  // WhatsApp:
  const handleWhatsApp = () => {
    if (order.customerPhone) {
      const msg = encodeURIComponent(
        `Your order #${order.orderNumber} at ${branding.restaurantName} is complete.\n` +
        `Total: PKR ${order.total.toLocaleString()}\nThank you!`
      );
      window.open(`https://wa.me/92${order.customerPhone.replace(/^0/, '')}?text=${msg}`);
    } else {
      setWhatsAppModalOpen(true);
    }
  };

  // Email:
  const handleEmail = () => setEmailModalOpen(true);

  // No Receipt:
  const handleNoReceipt = () => router.push('/pos/tables');

  // Mark as Cleaning:
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const handleMarkCleaning = async () => {
    try {
      await fetch(`${API_URL}/api/tables/${order.tableId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'dirty' })
      });
    } catch(e) {}
    router.push('/pos/tables');
  };

  // New Order Same Table:
  const handleNewOrderSameTable = () => {
    router.push(`/pos/order?tableId=${order.tableId}&tableLabel=${order.tableLabel}&type=dine-in`);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[var(--pos-bg-base)] text-[#f0e0d1] selection:bg-primary selection:text-on-primary">
      {/* Top App Bar */}
      <header className="flex justify-between items-center w-full px-8 py-4 max-w-full bg-[#19120a] border-b border-[#534434] z-50">
        <div className="flex items-center gap-4">
          <span className="material-symbols-outlined text-[#ffc174]">table_restaurant</span>
          <h1 className="text-[20px] font-bold text-[#ffc174] tracking-tight">
            Table {selectedTableId} · Payment Complete
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[14px] font-semibold text-[#f0e0d1]">{session?.cashierName || 'Ahmed'}</p>
            <p className="text-[12px] font-medium text-[#d8c3ad]">Cashier</p>
          </div>
          <div className="h-10 w-10 rounded-full bg-[#3c3329] flex items-center justify-center border border-[#534434]">
            <span className="material-symbols-outlined text-[#d8c3ad]">person</span>
          </div>
        </div>
      </header>

      {/* Main Scrollable Content */}
      <main className="flex-1 overflow-y-auto px-8 py-6 space-y-6 pb-32">
        {/* Success Banner */}
        <section className="w-full bg-[#0F1F14] border border-[#534434]/30 rounded-xl p-6 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <div className="h-16 w-16 bg-[var(--pos-primary)]/20 rounded-full flex items-center justify-center text-[var(--pos-primary)] border-2 border-[#f59e0b]/50">
              <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            </div>
            <div>
              <h2 className="text-[24px] font-bold text-white">Payment Received</h2>
              <p className="text-[18px] text-[#d8c3ad]/80">PKR 7,137 · Cash · <span className="text-[#ffc174]">Change: PKR 863</span></p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 border-l border-[#534434]/50 pl-6">
            <span className="text-[10px] font-bold tracking-[0.2em] text-[#d8c3ad] uppercase">FBR Fiscal Status</span>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-[var(--pos-primary)]"></div>
              <p className="text-[14px] font-semibold text-[#f0e0d1]">INV-20250529001234</p>
            </div>
            <p className="text-[10px] text-[#d8c3ad]/60 font-mono tracking-wider">SYNCED WITH POS-FBR-SERVICE</p>
          </div>
        </section>

        <div className="flex gap-12 justify-center max-w-5xl mx-auto">
          {/* Left Column: Receipt Preview */}
          <div className="flex flex-col shrink-0" style={{ minWidth: '240px', width: '240px' }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[var(--pos-text-secondary)] text-xs font-medium uppercase tracking-wider">
                Receipt Preview
              </span>
            </div>

            {/* Thermal receipt paper */}
            <div
              className="bg-[var(--pos-bg-card)] text-[var(--pos-text-primary)] rounded-lg overflow-hidden shadow-xl"
              style={{
                width: '240px',       // fixed thermal receipt width
                fontFamily: 'Courier New, Courier, monospace',
                fontSize: '11px',
                lineHeight: '1.4',
              }}
            >
              <div className="p-4">
                {/* Restaurant name */}
                <p className="text-center font-bold text-[13px] uppercase mb-0.5">
                  {branding.restaurantName || session?.restaurantName || "RESTAURANT"}
                </p>
                {/* NTN if FBR enabled */}
                {branding.fbrEnabled && branding.fbrNtn && (
                  <p className="text-center text-[10px] text-[var(--pos-text-muted)]">
                    NTN: {branding.fbrNtn}
                  </p>
                )}
                {/* Address */}
                <p className="text-center text-[10px] text-[var(--pos-text-muted)]">{branchAddress}</p>

                <div className="border-t border-dashed border-[var(--pos-border-strong)] my-2" />

                {/* Order meta */}
                <div className="flex justify-between text-[10px]">
                  <span>Order:</span><span>#{order.orderNumber}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span>Table:</span><span>{order.tableLabel ?? 'Takeaway'}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span>Date:</span>
                  <span>{new Date(order.createdAt).toLocaleDateString('en-PK')}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span>Time:</span>
                  <span>{new Date(order.createdAt).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span>Cashier:</span><span>{cashierName}</span>
                </div>

                <div className="border-t border-dashed border-[var(--pos-border-strong)] my-2" />

                {/* Items */}
                {order.items.map(item => (
                  <div key={item.id} className="flex justify-between text-[11px] mb-1">
                    <span className="flex-1 mr-2">{item.qty}x {item.itemName}</span>
                    <span className="font-mono whitespace-nowrap">
                      {(item.unitPrice * item.qty).toLocaleString()}
                    </span>
                  </div>
                ))}

                <div className="border-t border-dashed border-[var(--pos-border-strong)] my-2" />

                {/* Totals */}
                <div className="flex justify-between text-[10px] text-[var(--pos-text-secondary)]">
                  <span>Subtotal</span><span>{order.subtotal.toLocaleString()}</span>
                </div>
                {order.taxAmount > 0 && (
                  <div className="flex justify-between text-[10px] text-[var(--pos-text-secondary)]">
                    <span>GST ({branding.dineinTaxRate}%)</span>
                    <span>{order.taxAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-[12px] mt-1">
                  <span>TOTAL</span>
                  <span>PKR {order.total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[10px] text-[var(--pos-text-secondary)] mt-2 border-t border-dashed border-[var(--pos-border-strong)] pt-1">
                  <span>Cash</span><span>PKR {cashReceived.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[10px] text-[var(--pos-text-secondary)]">
                  <span>Change</span><span>PKR {change.toLocaleString()}</span>
                </div>

                {/* FBR QR */}
                {branding.fbrEnabled && (
                  <>
                    <div className="border-t border-dashed border-[var(--pos-border-strong)] my-2" />
                    <div className="flex justify-center mb-1">
                      <div className="w-16 h-16 bg-[var(--pos-bg-elevated)] border border-[var(--pos-border-strong)] rounded
                        flex items-center justify-center text-[8px] text-gray-400 text-center">
                        FBR<br/>QR
                      </div>
                    </div>
                    <p className="text-center text-[9px] text-gray-400">✓ FBR Integrated POS</p>
                  </>
                )}

                {/* Footer */}
                {branding.receiptFooter && (
                  <>
                    <div className="border-t border-dashed border-[var(--pos-border-strong)] my-2" />
                    <p className="text-center text-[10px] text-[var(--pos-text-muted)] italic">
                      {branding.receiptFooter}
                    </p>
                  </>
                )}

                <p className="text-center text-[9px] text-gray-300 mt-2">
                  Powered by Dineiz POS
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Actions */}
          <div className="flex-1 space-y-8 max-w-2xl">
            {/* Send Receipt Section */}
            <div className="space-y-4">
              <p className="text-[14px] font-semibold text-[#d8c3ad] flex items-center gap-2">
                <span className="material-symbols-outlined">ios_share</span>
                SEND RECEIPT
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={handlePrint} className="flex items-center justify-center gap-4 py-8 px-6 bg-[#ffc174] text-[#472a00] text-[20px] font-bold rounded-xl hover:brightness-110 active:scale-[0.98] transition-all border border-[#f59e0b] shadow-lg">
                  <span className="material-symbols-outlined text-3xl">print</span>
                  Print Receipt
                </button>
                <button onClick={handleWhatsApp} className="flex items-center justify-center gap-4 py-8 px-6 bg-[#25D366] text-white text-[20px] font-bold rounded-xl hover:brightness-110 active:scale-[0.98] transition-all shadow-lg">
                  <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>chat</span>
                  WhatsApp
                </button>
                <button onClick={handleEmail} className="flex items-center justify-center gap-4 py-8 px-6 bg-[#3c3329] text-[#f0e0d1] text-[20px] font-bold rounded-xl border border-[#534434] hover:bg-[#41382e] transition-all">
                  <span className="material-symbols-outlined text-3xl">mail</span>
                  Email
                </button>
                <button onClick={handleNoReceipt} className="flex items-center justify-center gap-4 py-8 px-6 bg-transparent text-[#d8c3ad] text-[20px] font-bold rounded-xl border border-[#534434]/30 hover:border-[#ffb4ab] transition-all">
                  <span className="material-symbols-outlined text-3xl">block</span>
                  No Receipt
                </button>
              </div>
            </div>

            {/* Table Actions */}
            <div className="space-y-4">
              <p className="text-[14px] font-semibold text-[#d8c3ad] flex items-center gap-2 uppercase tracking-widest">
                Table {selectedTableId} Actions
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={handleMarkCleaning} className="flex flex-col items-center justify-center gap-2 p-6 bg-[#261e15] rounded-xl border border-[#534434] hover:bg-[#31281f] transition-all group">
                  <span className="material-symbols-outlined text-4xl text-[#d8c3ad] group-hover:text-[#ffc174]">cleaning_services</span>
                  <span className="text-[14px] font-semibold">Mark as Cleaning</span>
                </button>
                <button onClick={handleNewOrderSameTable} className="flex flex-col items-center justify-center gap-2 p-6 bg-[#261e15] rounded-xl border border-[#534434] hover:bg-[#31281f] transition-all group">
                  <span className="material-symbols-outlined text-4xl text-[#d8c3ad] group-hover:text-[#ffc174]">add_box</span>
                  <span className="text-[14px] font-semibold">New Order · Table {selectedTableId}</span>
                </button>
              </div>
            </div>

            {/* Primary CTA */}
            <div className="pt-8 border-t border-[#534434]/30">
              <button 
                onClick={() => router.push('/pos/tables')}
                className="w-full bg-[var(--pos-primary)] text-[#613b00] py-8 rounded-xl text-[24px] font-bold flex items-center justify-center gap-4 hover:brightness-110 active:scale-95 transition-all shadow-xl"
              >
                Start Next Order
                <span className="material-symbols-outlined text-3xl">arrow_forward</span>
              </button>
              
              {/* Progress Bar */}
              <div className="mt-4 h-2 w-full bg-[#3c3329] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[var(--pos-primary)]/60 shadow-[0_0_10px_rgba(245,158,11,0.5)] transition-all duration-100 ease-linear"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <p className="text-center mt-2 text-[12px] font-medium text-[#d8c3ad]/50">Auto-advancing in {Math.ceil((progress / 100) * 30)} seconds...</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
