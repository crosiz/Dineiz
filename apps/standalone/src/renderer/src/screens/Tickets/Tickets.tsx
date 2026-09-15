import { useCallback, useEffect, useState } from 'react'
import * as PosLogic from '@dineiz/pos-logic'
import ConfirmDialog from '../../components/ConfirmDialog'

type OrderSummary = Awaited<ReturnType<typeof window.dineiz.orders.listActive>>[number]

interface TicketsProps {
  userId: string
  isManager: boolean
  onCharge: (orderId: string) => void
  /** Bump this from the parent whenever something outside this screen (e.g. a
   * payment completed from here) changes order state, so the list refetches
   * instead of showing whatever it happened to fetch on mount. */
  refreshSignal: number
}

const STATUS_LABEL: Record<OrderSummary['status'], string> = {
  PENDING: 'Held',
  IN_KITCHEN: 'In Kitchen',
  READY: 'Ready',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled'
}

const STATUS_COLOR: Record<OrderSummary['status'], string> = {
  PENDING: 'text-[var(--pos-text-muted)] bg-[var(--pos-bg-elevated)]',
  IN_KITCHEN: 'text-[var(--pos-blue)] bg-blue-50',
  READY: 'text-[var(--pos-green)] bg-green-50',
  COMPLETED: 'text-[var(--pos-text-muted)] bg-[var(--pos-bg-elevated)]',
  CANCELLED: 'text-[var(--pos-red)] bg-red-50'
}

export default function Tickets({ userId, isManager, onCharge, refreshSignal }: TicketsProps) {
  const [orders, setOrders] = useState<OrderSummary[] | null>(null)
  const [voidingOrderId, setVoidingOrderId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const list = await window.dineiz.orders.listActive()
    setOrders(list)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh, refreshSignal])

  async function handleSendToKitchen(orderId: string): Promise<void> {
    try {
      await window.dineiz.orders.sendToKitchen({ orderId })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleMarkReady(orderId: string): Promise<void> {
    try {
      await window.dineiz.orders.markReady({ orderId })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function confirmVoid(): Promise<void> {
    if (!voidingOrderId) return
    try {
      await window.dineiz.orders.void({ orderId: voidingOrderId, reason: 'Voided from Tickets', userId })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setVoidingOrderId(null)
    }
  }

  if (!orders) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-[var(--pos-text-secondary)]">Loading tickets…</p>
      </div>
    )
  }

  const voidingOrder = orders.find((o) => o.id === voidingOrderId) ?? null

  return (
    <div className="h-full overflow-y-auto p-4">
      <h1 className="clash-display mb-4 text-xl font-bold">Tickets</h1>

      {error && <p className="mb-3 text-sm text-[var(--pos-red)]">{error}</p>}

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <span className="material-symbols-outlined text-5xl text-[var(--pos-border-strong)]">receipt_long</span>
          <p className="text-sm font-semibold">No active orders</p>
          <p className="text-xs text-[var(--pos-text-muted)]">Orders sent to kitchen or held will show up here</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {orders.map((order) => (
            <div key={order.id} className="rounded-xl border border-[var(--pos-border)] bg-[var(--pos-bg-card)] p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-sm font-bold">{order.orderNumber}</p>
                  <p className="text-xs text-[var(--pos-text-muted)]">
                    {order.type.replace('_', ' ')}
                    {order.tableLabel ? ` · ${order.tableLabel}` : ''}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_COLOR[order.status]}`}>
                  {STATUS_LABEL[order.status]}
                </span>
              </div>

              <ul className="mt-3 space-y-0.5 text-sm">
                {order.items.map((item) => (
                  <li key={item.id} className="flex justify-between text-[var(--pos-text-secondary)]">
                    <span className="truncate">
                      {item.quantity}× {item.name}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex items-center justify-between border-t border-[var(--pos-border)] pt-3">
                <span className="font-mono text-sm font-bold text-[var(--pos-price)]">
                  {PosLogic.formatPKR(order.total)}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setVoidingOrderId(order.id)}
                    className="flex h-9 items-center rounded-lg border border-[var(--pos-red)] px-3 text-xs font-semibold text-[var(--pos-red)]"
                  >
                    Void
                  </button>
                  {order.status === 'PENDING' && (
                    <button
                      type="button"
                      onClick={() => handleSendToKitchen(order.id)}
                      className="flex h-9 items-center rounded-lg border border-[var(--pos-border-strong)] px-3 text-xs font-semibold"
                    >
                      Send to Kitchen
                    </button>
                  )}
                  {order.status === 'IN_KITCHEN' && (
                    <button
                      type="button"
                      onClick={() => handleMarkReady(order.id)}
                      className="flex h-9 items-center rounded-lg border border-[var(--pos-border-strong)] px-3 text-xs font-semibold"
                    >
                      Mark Ready
                    </button>
                  )}
                  {(order.status === 'READY' || order.status === 'PENDING' || order.status === 'IN_KITCHEN') && (
                    <button
                      type="button"
                      onClick={() => onCharge(order.id)}
                      className="flex h-9 items-center rounded-lg bg-[var(--pos-primary)] px-3 text-xs font-bold text-white"
                    >
                      Charge
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {voidingOrder && (
        <ConfirmDialog
          title="Void order"
          message={`Void order ${voidingOrder.orderNumber}? ${isManager ? '' : 'This cannot be undone.'}`}
          confirmLabel="Void order"
          onConfirm={confirmVoid}
          onCancel={() => setVoidingOrderId(null)}
        />
      )}
    </div>
  )
}
