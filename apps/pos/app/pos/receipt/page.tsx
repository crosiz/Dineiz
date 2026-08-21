'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useBrandingStore } from '@/lib/branding-store'
import { useCartStore } from '@/lib/store'
import { getToken } from '@/lib/pos-session'
import { toast } from 'sonner'
import { ReceiptView, type ReceiptData } from '@/components/ReceiptView'

// The API is a separate origin (NEXT_PUBLIC_API_URL, :4000) from the POS
// Next server (:3001), and there are no rewrites — these two fetches used
// relative '/api/...' paths, so they 404'd against Next and the order never
// loaded: the receipt rendered with no items and PKR 0 totals, and the
// auto-return countdown (gated on `order`) never even started.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function ReceiptPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const orderId = searchParams.get('orderId')
  const method = searchParams.get('method')
  const amountPaid = Number(searchParams.get('amountPaid') ?? 0)
  const change = Number(searchParams.get('change') ?? 0)
  const tableId = searchParams.get('tableId')
  const tableLabel = searchParams.get('tableLabel')

  const [order, setOrder] = useState<any>(null)
  const [countdown, setCountdown] = useState(30)
  const [autoRedirect, setAutoRedirect] = useState(true)
  const branding = useBrandingStore(s => s.branding)
  const session = useCartStore(s => s.session)
  const [mounted, setMounted] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)

  // Read localStorage only on the client to prevent SSR hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Fetch order:
  useEffect(() => {
    if (!orderId) return
    fetch(`${API_URL}/api/orders/${orderId}`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    })
    .then(r => r.json())
    .then(setOrder)
    .catch(() => {})
  }, [orderId])

  // Fix #20: start countdown only AFTER order data has loaded
  useEffect(() => {
    if (!autoRedirect || !order) return
    const interval = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { router.push('/pos/home'); return 0 }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [autoRedirect, order, router])

  // Prevent back navigation:
  useEffect(() => {
    window.history.pushState(null, '', window.location.href)
    const onPop = () => router.push('/pos/home')
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [router])

  const markCleaning = async () => {
    if (!tableId) return
    await fetch(`${API_URL}/api/tables/${tableId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
      body: JSON.stringify({ status: 'dirty' })
    }).catch(() => {})
  }

  // Same shape PaymentModal builds for the on-screen receipt right after a
  // payment — this is the "reprint" mount of that same ReceiptView, fed
  // from the fetched order instead of live checkout state.
  const receiptData: ReceiptData | null = order ? {
    tenantName: branding.restaurantName || 'Dineiz',
    fbrNtn: branding.fbrNtn,
    receiptHeader: branding.receiptHeader,
    receiptFooter: branding.receiptFooter,
    orderNumber: order.orderNumber || orderId?.slice(-6) || '',
    tableLabel: order.table?.label || tableLabel || undefined,
    orderType: order.type,
    cashierName: order.shift?.user?.name,
    items: (order.items || []).map((it: any) => ({
      name: it.item?.name || it.itemName || 'Item',
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      subtotal: it.subtotal ?? ((it.unitPrice || 0) * (it.quantity || 1)),
      variationName: it.options?.variation?.name,
      addOnNames: (it.options?.addOns || []).map((a: any) => a.name),
    })),
    subtotal: order.totalAmount ?? 0,
    discountAmount: order.discountAmount ?? 0,
    taxAmount: order.taxAmount ?? 0,
    taxLabel: order.appliedTaxLabel || 'GST',
    total: order.netAmount ?? 0,
    paymentMethod: method || order.payments?.[0]?.method || 'CASH',
    // Cash tendered/change aren't persisted on the order once payment
    // completes — only what's in this page's own query string (populated
    // right after a fresh payment) has them; a reprint later just won't
    // show this line, falling back to "Paid via {method}".
    cashTendered: method === 'CASH' && amountPaid > 0 ? amountPaid : undefined,
    changeGiven: method === 'CASH' && amountPaid > 0 ? change : undefined,
    createdAt: order.createdAt ? new Date(order.createdAt) : new Date(),
  } : null

  const handlePrint = async () => {
    if (!receiptData) return
    setIsPrinting(true)
    try {
      const { printDocument } = await import('@/lib/print.service')
      await printDocument('PAID_RECEIPT', {
        orderNumber: receiptData.orderNumber,
        tokenNumber: receiptData.orderNumber,
        type: receiptData.orderType || 'DINE_IN',
        tableLabel: receiptData.tableLabel,
        cashierName: receiptData.cashierName ?? undefined,
        tenantName: receiptData.tenantName,
        branchName: session?.branchName || 'Main Branch',
        items: receiptData.items,
        subtotal: receiptData.subtotal,
        discountAmount: receiptData.discountAmount ?? 0,
        taxAmount: receiptData.taxAmount,
        total: receiptData.total,
        paymentMethod: receiptData.paymentMethod,
        cashTendered: receiptData.cashTendered,
        changeGiven: receiptData.changeGiven,
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
      } as any)
      toast.success('Receipt sent to printer')
    } catch (e: any) {
      toast.error(e?.message || 'Failed to print receipt. Check printer connection in Settings.')
    } finally {
      setIsPrinting(false)
    }
  }

  return (
    <div style={{
      height: '100%', overflow: 'auto', backgroundColor: '#F8FAFC',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'flex-start', padding: '24px 16px',
    }}>
      {/* Success indicator */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{
          width: '80px', height: '80px', borderRadius: '50%',
          backgroundColor: '#E9F7F0',
          border: '2.5px solid #10B981',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 12px',
          animation: 'scaleIn 0.4s cubic-bezier(0.34,1.56,0.64,1)',
        }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <h2 style={{ color: '#0F172A', fontSize: '22px', fontWeight: 700, margin: 0 }}>
          Payment Confirmed
        </h2>
        <p style={{ color: '#64748B', fontSize: '13px', marginTop: '4px' }}>
          {tableLabel ? `Table ${tableLabel}` : 'Takeaway'} • {method}
        </p>
      </div>

      {/* Receipt — same ReceiptView component PaymentModal renders right
          after a payment completes; see components/ReceiptView.tsx. */}
      <div style={{ width: '100%', maxWidth: '420px', marginBottom: '16px' }}>
        {receiptData ? (
          <ReceiptView data={receiptData} />
        ) : (
          <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: '13px', padding: '24px' }}>Loading receipt…</div>
        )}
      </div>

      {/* Action buttons — WhatsApp only shows when we actually have a
          number to send to (e.g. WhatsApp-sourced orders); previously this
          button rendered unconditionally with an empty onClick and did
          nothing when tapped — and separately read order?.customerPhone,
          a flat field getOrder() never returns (the phone is nested under
          order.customer.phone), so it never showed at all. */}
      <div style={{ width: '100%', maxWidth: '420px', display: 'flex', gap: '8px', marginBottom: '8px' }}>
        <button
          onClick={handlePrint}
          disabled={isPrinting || !receiptData}
          style={{ flex: 1, height: '44px', borderRadius: '10px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A', fontSize: '13px', cursor: isPrinting ? 'default' : 'pointer', fontWeight: 600, opacity: isPrinting || !receiptData ? 0.6 : 1 }}
        >
          {isPrinting ? '⏳ Printing…' : '🖨 Print'}
        </button>
        {order?.customer?.phone && (
          <a
            href={`https://wa.me/${String(order.customer.phone).replace(/\D/g, '')}?text=${encodeURIComponent(`Thanks for your order! Your receipt total was PKR ${Math.round(order?.netAmount ?? 0).toLocaleString('en-PK')}.`)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ flex: 1, height: '44px', borderRadius: '10px', backgroundColor: '#0F7A55', border: 'none', color: 'white', fontSize: '13px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
          >
            📱 WhatsApp
          </a>
        )}
      </div>

      {tableId && (
        <div style={{ width: '100%', maxWidth: '420px', display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <button
            onClick={async () => { await markCleaning(); router.push('/pos/tables') }}
            style={{ flex: 1, height: '44px', borderRadius: '10px', backgroundColor: '#FFF8EC', border: '1px solid rgba(245,158,11,0.3)', color: '#B4770B', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}
          >
            🧹 Mark as Cleaning
          </button>
          <button
            onClick={() => router.push(`/pos/order?type=dine-in&tableId=${tableId}&tableLabel=${tableLabel}`)}
            style={{ flex: 1, height: '44px', borderRadius: '10px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}
          >
            + New Order {tableLabel}
          </button>
        </div>
      )}

      {/* New Order button */}
      <button
        onClick={() => router.push('/pos/home')}
        style={{
          width: '100%', maxWidth: '420px', height: '52px',
          borderRadius: '12px', border: 'none',
          backgroundColor: 'var(--pos-primary, #F59E0B)',
          color: 'white', fontSize: '15px', fontWeight: 700,
          cursor: 'pointer', marginBottom: '12px',
          boxShadow: '0 4px 14px rgba(245,158,11,0.3)',
        }}
      >
        ⚡ Start New Order
      </button>

      {/* Auto-redirect countdown */}
      {autoRedirect && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#94A3B8', fontSize: '12px', margin: '0 0 4px' }}>
            Returning to home in {countdown}s
          </p>
          <button
            onClick={() => setAutoRedirect(false)}
            style={{ background: 'none', border: 'none', color: '#64748B', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Cancel auto-redirect
          </button>
        </div>
      )}

      <style>{`
        @keyframes scaleIn {
          from { transform: scale(0.5); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

export default function ReceiptPage() {
  return (
    <Suspense fallback={<div style={{ color: '#0F172A', textAlign: 'center', paddingTop: '50px' }}>Loading...</div>}>
      <ReceiptPageContent />
    </Suspense>
  )
}
