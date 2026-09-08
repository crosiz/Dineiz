import { useState } from 'react'
import * as PosLogic from '@dineiz/pos-logic'

type OrderGetResult = Awaited<ReturnType<typeof window.dineiz.orders.get>>
type Order = NonNullable<OrderGetResult>

interface PaymentModalProps {
  order: Order
  onClose: () => void
  onCompleted: (result: { changeGiven: number }) => void
}

const METHODS: { value: PosLogic.PaymentMethod; label: string; icon: string }[] = [
  { value: 'CASH', label: 'Cash', icon: 'payments' },
  { value: 'CARD', label: 'Card', icon: 'credit_card' },
  { value: 'JAZZCASH', label: 'JazzCash', icon: 'smartphone' },
  { value: 'EASYPAISA', label: 'EasyPaisa', icon: 'smartphone' }
]

const QUICK_CASH = [500, 1000, 2000, 5000]
const NUMPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', '⌫']

export default function PaymentModal({ order, onClose, onCompleted }: PaymentModalProps) {
  const [method, setMethod] = useState<PosLogic.PaymentMethod>('CASH')
  const [tendered, setTendered] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const change = Math.max(0, tendered - order.total)
  const canConfirm = method !== 'CASH' || tendered >= order.total

  function pressDigit(digit: string): void {
    setTendered((t) => Number(`${t}${digit}`))
  }

  async function handleConfirm(): Promise<void> {
    setError(null)
    setSubmitting(true)
    try {
      const result = await window.dineiz.payments.collect({
        orderId: order.id,
        paymentMethod: method,
        tenderedAmount: method === 'CASH' ? tendered : undefined
      })
      onCompleted({ changeGiven: result.changeGiven })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  const activeMethod = METHODS.find((m) => m.value === method)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        className="slide-up flex h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-[var(--pos-bg-card)] shadow-2xl sm:h-[85vh] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--pos-border)] p-5">
          <h2 className="clash-display text-xl font-bold">Checkout — {order.orderNumber}</h2>
          <button type="button" onClick={onClose} className="text-[var(--pos-text-secondary)]">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <div className="shrink-0 space-y-3 border-b border-[var(--pos-border)] bg-[var(--pos-bg-base)] p-5 sm:w-[280px] sm:border-b-0 sm:border-r">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-[var(--pos-text-secondary)]">
                <span>Subtotal</span>
                <span>{PosLogic.formatPKR(order.subtotal)}</span>
              </div>
              {order.discountAmount > 0 && (
                <div className="flex justify-between text-[var(--pos-text-secondary)]">
                  <span>Discount</span>
                  <span>-{PosLogic.formatPKR(order.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-[var(--pos-text-secondary)]">
                <span>Tax</span>
                <span>{PosLogic.formatPKR(order.taxAmount)}</span>
              </div>
            </div>
            <div className="border-t border-[var(--pos-border)] pt-3">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--pos-text-secondary)]">Total Due</p>
              <p className="clash-display text-4xl font-extrabold text-[var(--pos-price)]">
                {PosLogic.formatPKR(order.total)}
              </p>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5">
            <div className="grid grid-cols-4 gap-2">
              {METHODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => {
                    setMethod(m.value)
                    setTendered(0)
                  }}
                  className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-semibold ${
                    method === m.value
                      ? 'border-[var(--pos-primary)] bg-[var(--pos-primary-dim)] text-[var(--pos-primary)]'
                      : 'border-[var(--pos-border)] text-[var(--pos-text-secondary)]'
                  }`}
                >
                  <span className="material-symbols-outlined text-2xl">{m.icon}</span>
                  {m.label}
                </button>
              ))}
            </div>

            {method === 'CASH' ? (
              <div className="mt-5 flex flex-1 flex-col">
                <div className="text-center">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--pos-text-muted)]">
                    Tendered
                  </p>
                  <p className="clash-display text-5xl font-extrabold">{PosLogic.formatPKR(tendered)}</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--pos-green)]">
                    Change {PosLogic.formatPKR(change)}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTendered(0)}
                    className="h-9 rounded-full border border-[var(--pos-border-strong)] px-4 text-xs font-semibold"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => setTendered(order.total)}
                    className="h-9 rounded-full border border-[var(--pos-border-strong)] px-4 text-xs font-semibold"
                  >
                    Exact
                  </button>
                  {QUICK_CASH.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setTendered((t) => t + amount)}
                      className="h-9 rounded-full border border-[var(--pos-border-strong)] px-4 text-xs font-semibold"
                    >
                      +{amount}
                    </button>
                  ))}
                </div>

                <div className="mx-auto mt-5 grid w-full max-w-[280px] grid-cols-3 gap-2">
                  {NUMPAD_KEYS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => (key === '⌫' ? setTendered((t) => Math.floor(t / 10)) : pressDigit(key))}
                      className="numpad-key h-14 rounded-2xl bg-[var(--pos-bg-elevated)] text-lg font-semibold"
                    >
                      {key}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-8 flex flex-1 flex-col items-center justify-center gap-2 text-center">
                <span className="material-symbols-outlined text-4xl text-[var(--pos-text-muted)]">
                  {activeMethod?.icon}
                </span>
                <p className="text-sm text-[var(--pos-text-secondary)]">
                  Confirm once the {activeMethod?.label} payment has gone through.
                </p>
              </div>
            )}
          </div>
        </div>

        {error && <p className="shrink-0 px-5 pb-2 text-sm text-[var(--pos-red)]">{error}</p>}

        <div className="shrink-0 border-t border-[var(--pos-border)] p-4">
          <button
            type="button"
            disabled={!canConfirm || submitting}
            onClick={handleConfirm}
            className="h-[52px] w-full rounded-xl bg-[var(--pos-primary)] text-base font-bold text-white shadow-[var(--pos-primary-glow)] disabled:opacity-40"
          >
            {submitting ? 'Processing…' : 'Confirm Payment'}
          </button>
        </div>
      </div>
    </div>
  )
}
