'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useBrandingStore } from '@/lib/branding-store'

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
  const [mounted, setMounted] = useState(false)

  // Read localStorage only on the client to prevent SSR hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Fetch order:
  useEffect(() => {
    if (!orderId) return
    fetch(`/api/orders/${orderId}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('pos_token')}` }
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
    await fetch(`/api/tables/${tableId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('pos_token')}` },
      body: JSON.stringify({ status: 'dirty' })
    }).catch(() => {})
  }

  return (
    <div style={{
      height: '100%', overflow: 'auto', backgroundColor: '#0A0A0F',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'flex-start', padding: '24px 16px',
    }}>
      {/* Success indicator */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{
          width: '80px', height: '80px', borderRadius: '50%',
          backgroundColor: 'rgba(16,185,129,0.12)',
          border: '2.5px solid #10B981',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 12px',
          animation: 'scaleIn 0.4s cubic-bezier(0.34,1.56,0.64,1)',
        }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <h2 style={{ color: 'white', fontSize: '22px', fontWeight: 700, margin: 0 }}>
          Payment Confirmed
        </h2>
        <p style={{ color: '#64748B', fontSize: '13px', marginTop: '4px' }}>
          {tableLabel ? `Table ${tableLabel}` : 'Takeaway'} • {method}
        </p>
      </div>

      {/* Receipt card */}
      <div style={{
        width: '100%', maxWidth: '420px',
        backgroundColor: '#111827',
        border: '1px solid rgba(255,255,255,0.07)',
        borderTop: '3px solid var(--pos-primary, #FF5722)',
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '16px',
        fontFamily: 'Courier New, monospace',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
          <img src="/brand/dineiz-receipt-logo.svg" alt="Dineiz Receipt Logo" style={{ height: '44px', objectFit: 'contain' }} />
        </div>
        <p style={{ textAlign: 'center', fontWeight: 700, fontSize: '14px', color: 'white', margin: '0 0 4px' }}>
          {branding.restaurantName ?? 'Dineiz Go'}
        </p>
        {branding.fbrNtn && (
          <p style={{ textAlign: 'center', fontSize: '10px', color: '#64748B', margin: '0 0 8px' }}>
            NTN: {branding.fbrNtn}
          </p>
        )}

        <div style={{ borderTop: '1px dashed rgba(255,255,255,0.1)', margin: '10px 0' }} />

        {order?.items?.map((item: any, i: number) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>
            <span>{item.quantity}× {item.itemName}</span>
            <span style={{ color: 'white' }}>PKR {item.subtotal?.toLocaleString('en-PK')}</span>
          </div>
        ))}

        <div style={{ borderTop: '1px dashed rgba(255,255,255,0.1)', margin: '10px 0' }} />

        <div style={{ borderTop: '1px dashed rgba(255,255,255,0.1)', margin: '10px 0' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748B' }}>
          <span>Subtotal</span><span>PKR {Math.round(order?.totalAmount ?? 0).toLocaleString('en-PK')}</span>
        </div>
        {order?.discountAmount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748B' }}>
            <span>Discount</span><span>−PKR {Math.round(order.discountAmount).toLocaleString('en-PK')}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748B' }}>
          <span>{order?.appliedTaxLabel || 'GST'}</span>
          <span>PKR {Math.round(order?.taxAmount ?? 0).toLocaleString('en-PK')}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 700, color: 'white', marginTop: '6px' }}>
          <span>TOTAL</span><span style={{ color: 'var(--pos-primary, #FF5722)' }}>PKR {Math.round(order?.netAmount ?? 0).toLocaleString('en-PK')}</span>
        </div>
        {method === 'CASH' && amountPaid > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
              <span>Cash Received</span><span>PKR {Math.round(amountPaid).toLocaleString('en-PK')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#10B981', marginTop: '2px' }}>
              <span>Change</span><span>PKR {Math.round(change).toLocaleString('en-PK')}</span>
            </div>
          </>
        )}

        {branding.receiptFooter && (
          <>
            <div style={{ borderTop: '1px dashed rgba(255,255,255,0.1)', margin: '10px 0' }} />
            <p style={{ textAlign: 'center', fontSize: '10px', color: '#4B5563', fontStyle: 'italic' }}>
              {branding.receiptFooter}
            </p>
          </>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ width: '100%', maxWidth: '420px', display: 'flex', gap: '8px', marginBottom: '8px' }}>
        <button
          onClick={() => window.print()}
          style={{ flex: 1, height: '44px', borderRadius: '10px', backgroundColor: '#1E293B', border: '1px solid rgba(255,255,255,0.08)', color: 'white', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}
        >
          🖨 Print
        </button>
        <button
          onClick={() => {/* WhatsApp flow */}}
          style={{ flex: 1, height: '44px', borderRadius: '10px', backgroundColor: '#065F46', border: 'none', color: 'white', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}
        >
          📱 WhatsApp
        </button>
      </div>

      {tableId && (
        <div style={{ width: '100%', maxWidth: '420px', display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <button
            onClick={async () => { await markCleaning(); router.push('/pos/tables') }}
            style={{ flex: 1, height: '44px', borderRadius: '10px', backgroundColor: '#1E293B', border: '1px solid rgba(245,158,11,0.3)', color: '#F59E0B', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}
          >
            🧹 Mark as Cleaning
          </button>
          <button
            onClick={() => router.push(`/pos/order?type=dine-in&tableId=${tableId}&tableLabel=${tableLabel}`)}
            style={{ flex: 1, height: '44px', borderRadius: '10px', backgroundColor: '#1E293B', border: '1px solid rgba(255,255,255,0.08)', color: 'white', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}
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
          backgroundColor: 'var(--pos-primary, #FF5722)',
          color: 'white', fontSize: '15px', fontWeight: 700,
          cursor: 'pointer', marginBottom: '12px',
          boxShadow: '0 4px 14px rgba(255,87,34,0.35)',
        }}
      >
        ⚡ Start New Order
      </button>

      {/* Auto-redirect countdown */}
      {autoRedirect && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#4B5563', fontSize: '12px', margin: '0 0 4px' }}>
            Returning to home in {countdown}s
          </p>
          <button
            onClick={() => setAutoRedirect(false)}
            style={{ background: 'none', border: 'none', color: '#374151', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline' }}
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
    <Suspense fallback={<div style={{ color: 'white', textAlign: 'center', paddingTop: '50px' }}>Loading...</div>}>
      <ReceiptPageContent />
    </Suspense>
  )
}
