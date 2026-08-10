'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCartStore } from '@/lib/store';
import { usePrinter } from '@/hooks/usePrinter';
import { DineizLogo } from '@/components/ui/DineizLogo';

export default function ReceiptClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const changeParam = searchParams.get('change');
  const changeGiven = changeParam ? parseFloat(changeParam) : 0;
  const tableId = searchParams.get('tableId');
  const tableLabel = searchParams.get('tableLabel');

  const session = useCartStore((s) => s.session);
  const clearCart = useCartStore((s) => s.clearCart);
  
  const [order, setOrder] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareMethod, setShareMethod] = useState<'whatsapp' | 'email'>('whatsapp');
  const [contactInfo, setContactInfo] = useState('');
  
  const [countdown, setCountdown] = useState(30);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const { printReceipt } = usePrinter();

  useEffect(() => {
    if (!orderId) {
      router.push('/pos/home');
      return;
    }

    const fetchOrder = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/orders/${orderId}`, {
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          setOrder(data);
        }
      } catch (err) {
        console.error('Failed to fetch order', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrder();
  }, [orderId, router]);

  // Inactivity timeout
  useEffect(() => {
    const resetTimer = () => {
      setCountdown(30);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
      
      intervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            goHome();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    };

    resetTimer();

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);
    window.addEventListener('scroll', resetTimer);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
      window.removeEventListener('scroll', resetTimer);
    };
  }, []);

  const goHome = () => {
    clearCart();
    router.push('/pos/home');
  };

  const markCleaning = async () => {
    if (!tableId) return;
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/tables/${tableId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.token || localStorage.getItem('pos_token')}` },
        body: JSON.stringify({ status: 'dirty' })
      });
    } catch (err) {
      console.error(err);
    }
    router.push('/pos/home');
  };

  const newOrderSameTable = async () => {
    if (tableId) {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/tables/${tableId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.token || localStorage.getItem('pos_token')}` },
          body: JSON.stringify({ status: 'free' })
        });
      } catch (err) {
        console.error(err);
      }
    }
    router.push(`/pos/order?type=dine-in&tableId=${tableId}&tableLabel=${tableLabel}`);
  };

  const handlePrint = async () => {
    if (!order) return;
    try {
      const { printDocument } = await import('@/lib/print.service');
      // Derive actual payment method from order payments
      const actualPaymentMethod = order.payments?.[0]?.method || 'CASH';
      await printDocument('PAID_RECEIPT', {
        orderNumber: order.orderNumber,
        tokenNumber: order.tokenNumber,
        type: order.type,
        cashierName: session?.cashierName ?? undefined,
        tenantName: session?.restaurantName || 'SwiftServe',
        branchName: session?.branchName || 'Main Branch',
        items: order.items.map((c: any) => ({
          name: c.item?.name || c.itemName || 'Item',
          quantity: c.quantity,
          unitPrice: c.unitPrice,
          subtotal: c.subtotal,
        })),
        subtotal: order.subtotal || order.totalAmount || 0,
        discountAmount: order.discountAmount || 0,
        taxAmount: order.taxAmount || 0,
        total: order.netAmount || order.totalAmount || 0,
        paymentMethod: actualPaymentMethod,
        changeGiven: changeGiven > 0 ? changeGiven : undefined,
        createdAt: order.createdAt,
      } as any);
    } catch (e) {
      console.error(e);
      alert("Print failed.");
    }
  };

  const handleShare = async () => {
    if (!contactInfo || !order) return;
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/orders/${order.id}/send-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: shareMethod, contact: contactInfo }),
        credentials: 'include'
      });
      alert(`Receipt sent via ${shareMethod}!`);
      setShowShareModal(false);
    } catch (err) {
      console.error('Failed to send receipt', err);
      alert('Failed to send receipt. Please try again.');
    }
  };

  if (isLoading || !order) {
    return <div className="h-screen w-screen flex items-center justify-center font-body-md bg-[var(--pos-bg-card)]">Loading receipt...</div>;
  }

  // Derived values from order
  const subtotal = order.subtotal || order.totalAmount || 0;
  const discountAmount = order.discountAmount || 0;
  const taxAmount = order.taxAmount || 0;
  const total = order.netAmount || order.totalAmount || 0;

  // Payment method — derive from actual payments, not hardcoded
  const primaryPayment = order.payments?.[0];
  const paymentMethod: string = primaryPayment?.method || 'CASH';
  const isCardPayment = ['CARD', 'CREDIT_CARD', 'DEBIT_CARD'].includes(paymentMethod);
  const isMobilePayment = ['JAZZCASH', 'EASYPAISA', 'SADAPAY', 'NAYAPAY'].includes(paymentMethod);
  const isCashPayment = paymentMethod === 'CASH';
  const isSplitPayment = order.payments?.length > 1;

  // Payment label
  const getPaymentLabel = (method: string) => {
    const labels: Record<string, string> = {
      'CASH': 'Cash', 'CARD': 'Card', 'CREDIT_CARD': 'Credit Card',
      'DEBIT_CARD': 'Debit Card', 'JAZZCASH': 'JazzCash',
      'EASYPAISA': 'Easypaisa', 'SADAPAY': 'SadaPay', 'NAYAPAY': 'NayaPay',
    };
    return labels[method] || method;
  };

  return (
    <div className="fixed inset-0 bg-[#0D0D0D] z-[200] flex flex-col items-center animate-entrance-fade font-body-md text-[#f0e0d1] overflow-hidden">
      {/* TOP NAVIGATION BAR */}
      <header className="w-full h-16 bg-[#1C1410] flex items-center justify-between px-6 border-b border-[#534434] z-50 shrink-0">
        <button onClick={goHome} className="flex items-center gap-2 text-[#d8c3ad] hover:text-[var(--pos-primary)] transition-colors font-bold text-sm">
          <span className="material-symbols-outlined">arrow_back</span>
          Back to Home
        </button>
        <DineizLogo size="sm" showBadge={true} badgeText="CONFIRMATION" onClick={goHome} />
        <button className="flex items-center gap-2 text-[#d8c3ad] hover:text-[var(--pos-primary)] transition-colors font-bold text-sm" onClick={() => { setShareMethod('whatsapp'); setShowShareModal(true); }}>
          Share
          <span className="material-symbols-outlined">share</span>
        </button>
      </header>

      <main className="flex-1 py-8 w-full flex flex-col items-center overflow-y-auto hide-scrollbar pb-24">
        {/* RECEIPT CARD — Paper-white intentional for print fidelity */}
        <div className="w-[350px] bg-white p-6 flex flex-col font-mono text-sm text-black mb-8 shadow-md">
          
          {/* Header */}
          <div className="text-center mb-2">
            <h2 className="font-bold text-xl uppercase">{session?.restaurantName || 'SwiftServe'}</h2>
          </div>
          
          <div className="border-b border-dashed border-gray-400 my-2"></div>
          
          {/* Order Info */}
          <div>
            <div>Receipt No: #{order.tokenNumber || order.orderNumber?.slice(-8)}</div>
            <div>Date: {new Date(order.createdAt).toLocaleDateString()} {new Date(order.createdAt).toLocaleTimeString()}</div>
            <div>Server: {session?.cashierName || 'Operator'}</div>
            <div>Type: {order.type}</div>
          </div>
          
          <div className="border-b border-dashed border-gray-400 my-2"></div>
          
          {/* Items Table */}
          <div className="flex flex-col w-full">
            <div className="flex justify-between font-bold border-b border-gray-300 pb-1 mb-1">
              <span className="w-1/2">Item</span>
              <span className="w-1/4 text-center">Qty</span>
              <span className="w-1/4 text-right">Total</span>
            </div>
            {order.items?.map((c: any, i: number) => {
              const variationName = c.options?.variation?.name;
              const addOns = c.options?.addOns || [];
              return (
                <div key={i} className="flex flex-col py-1 border-b border-gray-100 last:border-0 border-opacity-20">
                  <div className="flex justify-between">
                    <span className="w-1/2 break-words">{c.item?.name || c.itemName || 'Item'}</span>
                    <span className="w-1/4 text-center">{c.quantity}</span>
                    <span className="w-1/4 text-right">{c.subtotal?.toFixed(0)}</span>
                  </div>
                  {variationName && (
                    <div className="text-xs text-[#d8c3ad] ml-2">({variationName})</div>
                  )}
                  {addOns.map((a: any, idx: number) => (
                    <div key={idx} className="text-xs text-[#d8c3ad] ml-2">
                      + {a.name} {a.price ? `(+${a.price})` : ''}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          
          <div className="border-b border-dashed border-gray-400 my-2"></div>
          
          {/* Totals */}
          <div className="flex flex-col gap-1">
            {session?.showDualTaxOnReceipt ? (
              <>
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>PKR {subtotal.toFixed(0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{session?.cashTaxLabel || 'GST (Cash)'}:</span>
                  <span>PKR {((subtotal - discountAmount) * (session?.cashTaxRate ?? 0.05)).toFixed(0)}</span>
                </div>
                <div className="flex justify-between font-bold mt-1">
                  <span>TOTAL:</span>
                  <span>PKR {(subtotal - discountAmount + (subtotal - discountAmount) * (session?.cashTaxRate ?? 0.05)).toFixed(0)}</span>
                </div>
                
                <div className="border-b border-dashed border-gray-400 my-2"></div>
                
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>PKR {subtotal.toFixed(0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{session?.cardTaxLabel || 'GST (Card)'}:</span>
                  <span>PKR {((subtotal - discountAmount) * (session?.cardTaxRate ?? 0.17)).toFixed(0)}</span>
                </div>
                <div className="flex justify-between font-bold mt-1">
                  <span>TOTAL:</span>
                  <span>PKR {(subtotal - discountAmount + (subtotal - discountAmount) * (session?.cardTaxRate ?? 0.17)).toFixed(0)}</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>PKR {subtotal.toFixed(0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax:</span>
                  <span>PKR {taxAmount.toFixed(0)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg mt-1">
                  <span>TOTAL:</span>
                  <span>PKR {total.toFixed(0)}</span>
                </div>
              </>
            )}
          </div>
          
          <div className="border-b border-dashed border-gray-400 my-2"></div>
          
          {/* Payment Method Section (if paid) */}
          {order.payments && order.payments.length > 0 && (
            <div className="flex flex-col gap-1 mt-2">
              <span className="font-bold uppercase text-xs">Payment</span>
              {order.payments.map((p: any, i: number) => (
                <div key={i} className="flex justify-between">
                  <span>{getPaymentLabel(p.method)}</span>
                  <span>PKR {Number(p.amount).toFixed(0)}</span>
                </div>
              ))}
              {changeGiven > 0 && (
                <>
                  <div className="flex justify-between">
                    <span>Cash Tendered</span>
                    <span>PKR {(total + changeGiven).toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Change Returned</span>
                    <span>PKR {changeGiven.toFixed(0)}</span>
                  </div>
                </>
              )}
            </div>
          )}
          
          <div className="text-center text-xs mt-6">
            Thank you for dining with us!
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div className="w-[400px] grid grid-cols-2 gap-4">
          <button onClick={handlePrint} className="flex items-center justify-center gap-2 py-4 bg-[var(--pos-primary)] text-[#472a00] font-bold rounded-xl hover:brightness-110 active:scale-95 transition-all shadow-[0_4px_14px_rgba(255,193,116,0.3)]">
            <span className="material-symbols-outlined">print</span>
            Print Receipt
          </button>
          <button onClick={() => { setShareMethod('whatsapp'); setShowShareModal(true); }} className="flex items-center justify-center gap-2 py-4 bg-[#25D366] text-white font-bold rounded-xl hover:opacity-90 active:scale-95 transition-all">
            <span className="material-symbols-outlined">chat</span>
            WhatsApp
          </button>
          
          {tableId ? (
            <>
              <button onClick={markCleaning} className="flex items-center justify-center gap-2 py-4 border-2 border-[#f59e0b] text-[#f59e0b] font-bold rounded-xl hover:bg-[#f59e0b]/10 active:scale-95 transition-all">
                <span className="material-symbols-outlined">cleaning_services</span>
                Mark Cleaning
              </button>
              <button onClick={newOrderSameTable} className="flex items-center justify-center gap-2 py-4 border-2 border-[#534434] text-[#f0e0d1] font-bold rounded-xl hover:bg-[#261e15] active:scale-95 transition-all">
                <span className="material-symbols-outlined">add</span>
                Order Same Table
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { setShareMethod('email'); setShowShareModal(true); }} className="flex items-center justify-center gap-2 py-4 bg-[#4A90E2] text-white font-bold rounded-xl hover:opacity-90 active:scale-95 transition-all">
                <span className="material-symbols-outlined">mail</span>
                Email
              </button>
              <button onClick={goHome} className="flex items-center justify-center gap-2 py-4 border-2 border-[#534434] text-[#f0e0d1] font-bold rounded-xl hover:bg-[#261e15] active:scale-95 transition-all">
                <span className="material-symbols-outlined">add</span>
                New Order
              </button>
            </>
          )}
        </div>
        
      </main>

      {/* Auto-navigate toast */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#1C1410] border border-[#534434] px-6 py-3 rounded-full flex items-center gap-4 shadow-lg z-50 animate-entrance-fade">
        <span className="text-[#d8c3ad] text-sm">Returning to home in <strong className="text-[var(--pos-primary)]">{countdown}s</strong></span>
        <button onClick={() => setCountdown(30)} className="text-xs uppercase font-bold text-[#f0e0d1] bg-[#3c3329] px-3 py-1 rounded-md hover:text-[var(--pos-primary)]">Stay</button>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/70 z-[300] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#1C1410] border border-[#534434] p-6 rounded-xl w-full max-w-sm flex flex-col gap-4">
            <h3 className="font-bold text-lg text-[#f0e0d1]">Send via {shareMethod === 'whatsapp' ? 'WhatsApp' : 'Email'}</h3>
            <input 
              type={shareMethod === 'whatsapp' ? 'tel' : 'email'}
              placeholder={shareMethod === 'whatsapp' ? '+92 3XX XXXXXXX' : 'customer@email.com'}
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
              className="bg-[#0D0D0D] border border-[#534434] text-[#f0e0d1] p-3 rounded-lg focus:border-[var(--pos-primary)] focus:outline-none placeholder:text-[#6B7280]"
              autoFocus
            />
            <div className="flex justify-end gap-3 mt-2">
              <button onClick={() => setShowShareModal(false)} className="px-4 py-2 text-[#d8c3ad] hover:text-[#f0e0d1] transition-colors">Cancel</button>
              <button onClick={handleShare} className="px-4 py-2 bg-[var(--pos-primary)] text-[#472a00] rounded-lg font-bold hover:brightness-110 transition-all">Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
