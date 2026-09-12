import { useState } from 'react'
import * as PosLogic from '@dineiz/pos-logic'
import { cartLinesToPosLogic, useCartStore } from '../../state/cartStore'
import TablePickerSheet from './TablePickerSheet'

interface TaxConfig {
  cashTaxRatePercent: number
  cardTaxRatePercent: number
  cashTaxEnabled: boolean
  cardTaxEnabled: boolean
  roundingMethod: PosLogic.RoundingMethod
}

interface CartPanelProps {
  taxConfig: TaxConfig
  submitting: boolean
  onSubmit: (action: 'hold' | 'kitchen' | 'charge') => void
}

const ORDER_TYPES: { value: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY'; label: string }[] = [
  { value: 'DINE_IN', label: 'Dine In' },
  { value: 'TAKEAWAY', label: 'Takeaway' },
  { value: 'DELIVERY', label: 'Delivery' }
]

export default function CartPanel({ taxConfig, submitting, onSubmit }: CartPanelProps) {
  const {
    orderType,
    lines,
    discount,
    tableId,
    tableLabel,
    setOrderType,
    setTable,
    incrementLine,
    decrementLine,
    removeLine,
    clear
  } = useCartStore()
  const [pickingTable, setPickingTable] = useState(false)

  const subtotal = PosLogic.computeCartSubtotal(cartLinesToPosLogic(lines))
  const discountAmount = PosLogic.computeDiscountAmount(subtotal, discount, taxConfig.roundingMethod)
  const totals = PosLogic.computeOrderTotals(subtotal, discountAmount, 'CASH', taxConfig)

  const hasItems = lines.length > 0

  return (
    <aside className="flex h-full w-full flex-col border-l border-[var(--pos-border)] bg-[var(--pos-bg-card)] sm:w-[380px]">
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--pos-border)] p-4">
        <div>
          <h2 className="clash-display text-lg font-bold">Current Order</h2>
          {hasItems && <p className="text-xs text-[var(--pos-text-secondary)]">{lines.length} item(s)</p>}
        </div>
        {hasItems && (
          <button type="button" onClick={clear} className="text-xs font-semibold text-[var(--pos-text-secondary)]">
            Clear
          </button>
        )}
      </div>

      <div className="flex shrink-0 gap-2 border-b border-[var(--pos-border)] p-3">
        {ORDER_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setOrderType(t.value)}
            className={`h-9 flex-1 rounded-full text-xs font-semibold ${
              orderType === t.value
                ? 'bg-[var(--pos-primary)] text-white'
                : 'border border-[var(--pos-border-strong)] text-[var(--pos-text-secondary)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {orderType === 'DINE_IN' && (
        <button
          type="button"
          onClick={() => setPickingTable(true)}
          className="mx-3 mt-3 flex h-11 shrink-0 items-center justify-between rounded-xl border border-[var(--pos-border-strong)] px-3 text-sm"
        >
          <span className="flex items-center gap-2">
            <span className="material-symbols-outlined text-lg text-[var(--pos-text-muted)]">table_restaurant</span>
            {tableLabel ? (
              <span className="font-semibold">{tableLabel}</span>
            ) : (
              <span className="text-[var(--pos-text-muted)]">No table selected</span>
            )}
          </span>
          <span className="text-xs font-semibold text-[var(--pos-primary)]">{tableLabel ? 'Change' : 'Select'}</span>
        </button>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {!hasItems ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <span className="material-symbols-outlined text-5xl text-[var(--pos-border-strong)]">
              shopping_cart_checkout
            </span>
            <p className="text-sm font-semibold text-[var(--pos-text-primary)]">Your order is empty</p>
            <p className="text-xs text-[var(--pos-text-muted)]">Tap an item to add it</p>
          </div>
        ) : (
          <div className="space-y-2">
            {lines.map((line) => (
              <div key={line.key} className="rounded-xl border border-[var(--pos-border)] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{line.name}</p>
                    {line.variation && <p className="text-xs text-[var(--pos-text-muted)]">{line.variation.name}</p>}
                    {line.addOns.map((a) => (
                      <p key={a.id} className="text-xs text-[var(--pos-text-muted)]">
                        + {a.name}
                      </p>
                    ))}
                    {line.notes && <p className="text-xs italic text-[var(--pos-text-muted)]">{line.notes}</p>}
                  </div>
                  <button type="button" onClick={() => removeLine(line.key)} className="text-[var(--pos-text-muted)]">
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1 rounded-full bg-[var(--pos-bg-elevated)] p-1">
                    <button
                      type="button"
                      onClick={() => decrementLine(line.key)}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm font-bold shadow-sm"
                    >
                      −
                    </button>
                    <span className="w-6 text-center font-mono text-sm font-bold">{line.quantity}</span>
                    <button
                      type="button"
                      onClick={() => incrementLine(line.key)}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm font-bold shadow-sm"
                    >
                      +
                    </button>
                  </div>
                  <span className="font-mono text-sm font-bold text-[var(--pos-price)]">
                    {PosLogic.formatPKR(
                      PosLogic.computeLineSubtotal({
                        itemId: line.itemId,
                        name: line.name,
                        basePrice: line.basePrice,
                        quantity: line.quantity,
                        variation: line.variation,
                        addOns: line.addOns
                      })
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-[var(--pos-border)] bg-[var(--pos-bg-base)] p-4">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-[var(--pos-text-secondary)]">
            <span>Subtotal</span>
            <span>{PosLogic.formatPKR(totals.subtotal)}</span>
          </div>
          {totals.discountAmount > 0 && (
            <div className="flex justify-between text-[var(--pos-text-secondary)]">
              <span>Discount</span>
              <span>-{PosLogic.formatPKR(totals.discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-[var(--pos-text-secondary)]">
            <span>Tax ({totals.taxRatePercent}%, cash rate shown)</span>
            <span>{PosLogic.formatPKR(totals.taxAmount)}</span>
          </div>
        </div>
        <div className="mt-2 flex items-baseline justify-between border-t border-[var(--pos-border)] pt-2">
          <span className="text-xs font-bold uppercase tracking-wide text-[var(--pos-text-secondary)]">
            Order Total
          </span>
          <span className="clash-display text-3xl font-extrabold text-[var(--pos-price)]">
            {PosLogic.formatPKR(totals.total)}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!hasItems || submitting}
            onClick={() => onSubmit('hold')}
            className="h-11 rounded-xl border border-[var(--pos-border-strong)] text-sm font-semibold text-[var(--pos-text-secondary)] disabled:opacity-40"
          >
            Hold
          </button>
          <button
            type="button"
            disabled={!hasItems || submitting}
            onClick={() => onSubmit('kitchen')}
            className="h-11 rounded-xl border border-[var(--pos-border-strong)] text-sm font-semibold text-[var(--pos-text-primary)] disabled:opacity-40"
          >
            Kitchen
          </button>
        </div>
        <button
          type="button"
          disabled={!hasItems || submitting}
          onClick={() => onSubmit('charge')}
          className="mt-2 h-12 w-full rounded-xl bg-[var(--pos-primary)] text-sm font-bold text-white shadow-[var(--pos-primary-glow)] disabled:opacity-40"
        >
          {submitting ? 'Please wait…' : 'CHARGE'}
        </button>
      </div>

      {pickingTable && (
        <TablePickerSheet
          selectedTableId={tableId}
          onClose={() => setPickingTable(false)}
          onSelect={(table) => {
            setTable(table)
            setPickingTable(false)
          }}
        />
      )}
    </aside>
  )
}
