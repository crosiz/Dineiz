'use client'
import { useViews } from '@/lib/core/views'
import { setTableStatus } from '@/lib/core/commands'
import { cachedRead } from '@/lib/cached-read'
import { Check, Printer, MessageSquare, ArrowRight } from 'lucide-react'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useBrandingStore } from '@/lib/branding-store'
import { useCartStore } from '@/lib/store'
import { getToken } from '@/lib/pos-session'
import { toast } from 'sonner'
import { ReceiptView, type ReceiptData } from '@/components/ReceiptView'
import { API_URL } from '@/lib/api';

// The API is a separate origin (NEXT_PUBLIC_API_URL, :4000) from the POS
// Next server (:3001), and there are no rewrites — these two fetches used
// relative '/api/...' paths, so they 404'd against Next and the order never
// loaded: the receipt rendered with no items and PKR 0 totals, and the
// auto-return countdown (gated on `order`) never even started.
function ReceiptPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const orderId = searchParams.get('orderId')
  const method = searchParams.get('method')
  const amountPaid = Number(searchParams.get('amountPaid') ?? 0)
  const change = Number(searchParams.get('change') ?? 0)
  const tableId = searchParams.get('tableId')
  const tableLabel = searchParams.get('tableLabel')

  const localOrder = useViews(s => Object.values(s.orders).find(o => o.id === orderId || o.serverId === orderId))
  const [loadError, setLoadError] = useState('')
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

  useEffect(() => {
    if (!orderId) { setLoadError('Choose an order from Tickets to view its receipt.'); return; }
    if (localOrder) {
      setOrder({ ...localOrder, totalAmount: localOrder.subtotal, table: { label: localOrder.tableLabel },
        customer: { phone: localOrder.customerPhone }, shift: { user: { name: localOrder.cashierName } },
        items: localOrder.items.filter(i => !i.voided).map(i => ({ itemName: i.itemName, quantity: i.qty, unitPrice: i.unitPrice, subtotal: i.qty * i.unitPrice, options: { variation: { name: i.variationName }, addOns: i.addOns } })),
      });
      return;
    }
    let active = true;
    cachedRead<any>(`/api/orders/${orderId}`).then(({ data }) => { if (active) setOrder(data); })
      .catch(() => { if (active) setLoadError('This receipt is not saved here. Reconnect to retrieve it.'); });
    return () => { active = false; };
  }, [orderId, localOrder])

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
    await setTableStatus(tableId, 'DIRTY')
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
      addOnNames: (it.options?.addOns || []).map((a: any) => a.price ? `${a.name} (+${a.price})` : a.name),
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
    <main className="h-full overflow-y-auto bg-canvas px-4 py-6 pb-24">
      <div className="max-w-[420px] mx-auto">
        <header className="mb-5 text-center">
          <span className="mx-auto mb-3 w-12 h-12 rounded-full bg-ok/10 text-ok grid place-items-center"><Check size={24} /></span>
          <h1 className="text-xl font-semibold text-ink">{order?.status === 'COMPLETED' ? 'Payment received' : 'Order receipt'}</h1>
          <p className="mt-1 text-sm text-ink-3">{order?.orderNumber || 'Saved order'}</p>
        </header>
        {receiptData ? <ReceiptView data={receiptData} /> : <p role="status" className="p-5 border border-line bg-surface rounded-xl text-sm text-ink-3">{loadError || 'Loading receipt…'}</p>}
        <div className="mt-5 flex gap-2">
          <button onClick={handlePrint} disabled={isPrinting || !receiptData} className="min-h-11 flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface text-sm font-semibold disabled:opacity-50"><Printer size={17} />{isPrinting ? 'Printing…' : 'Print receipt'}</button>
          {order?.customer?.phone && <a href={`https://wa.me/${String(order.customer.phone).replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="min-h-11 flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface text-sm font-semibold"><MessageSquare size={17} />Message</a>}
        </div>
        {tableId && <button onClick={async () => { try { await markCleaning(); router.push('/pos/tables'); } catch { toast.error('Could not save the table status. Try again.'); } }} className="mt-2 w-full min-h-11 rounded-xl border border-line bg-surface text-sm font-semibold">Mark table for cleaning</button>}
        <button onClick={() => router.push('/pos/home')} className="mt-3 min-h-12 w-full rounded-xl bg-brand text-on-brand text-sm font-semibold inline-flex items-center justify-center gap-2">Back to home <ArrowRight size={17} /></button>
        {autoRedirect && order && <button onClick={() => setAutoRedirect(false)} className="min-h-11 w-full mt-2 text-xs text-ink-3">Returning in {countdown}s · Stay here</button>}
      </div>
    </main>
  )
}

export default function ReceiptPage() {
  return (
    <Suspense fallback={<div style={{ color: '#0F172A', textAlign: 'center', paddingTop: '50px' }}>Loading...</div>}>
      <ReceiptPageContent />
    </Suspense>
  )
}
