import { useState } from 'react'
import * as PosLogic from '@dineiz/pos-logic'

type Menu = Awaited<ReturnType<typeof window.dineiz.menu.getAll>>
type ItemSummary = Menu['categories'][number]['items'][number]

interface Selection {
  variation: { id: string; name: string; price: number } | null
  addOns: { id: string; name: string; price: number }[]
  notes?: string
}

interface ItemOptionsSheetProps {
  item: ItemSummary
  onClose: () => void
  onAdd: (selection: Selection) => void
}

export default function ItemOptionsSheet({ item, onClose, onAdd }: ItemOptionsSheetProps) {
  const [variationId, setVariationId] = useState<string | null>(item.variations[0]?.id ?? null)
  const [addOnIds, setAddOnIds] = useState<string[]>([])
  const [notes, setNotes] = useState('')

  const variation = item.variations.find((v) => v.id === variationId) ?? null
  const selectedAddOns = item.addons.filter((a) => addOnIds.includes(a.id))
  const unitPrice = PosLogic.computeUnitPrice({ basePrice: item.price, variation, addOns: selectedAddOns })

  function toggleAddOn(id: string): void {
    setAddOnIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="slide-up flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-[var(--pos-bg-card)] shadow-xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-[var(--pos-border)] p-5">
          <h2 className="clash-display text-lg font-bold">{item.name}</h2>
          <p className="mt-0.5 text-sm text-[var(--pos-text-secondary)]">Customize this item</p>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          {item.variations.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--pos-text-muted)]">Size</p>
              <div className="space-y-2">
                {item.variations.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVariationId(v.id)}
                    className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm ${
                      variationId === v.id
                        ? 'border-[var(--pos-primary)] bg-[var(--pos-primary-dim)] font-semibold text-[var(--pos-primary)]'
                        : 'border-[var(--pos-border)] text-[var(--pos-text-primary)]'
                    }`}
                  >
                    <span>{v.name}</span>
                    <span className="font-mono">{PosLogic.formatPKR(v.price)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {item.addons.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--pos-text-muted)]">
                Add-ons
              </p>
              <div className="space-y-2">
                {item.addons.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleAddOn(a.id)}
                    className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm ${
                      addOnIds.includes(a.id)
                        ? 'border-[var(--pos-primary)] bg-[var(--pos-primary-dim)] font-semibold text-[var(--pos-primary)]'
                        : 'border-[var(--pos-border)] text-[var(--pos-text-primary)]'
                    }`}
                  >
                    <span>{a.name}</span>
                    <span className="font-mono">{a.price > 0 ? `+${PosLogic.formatPKR(a.price)}` : 'Free'}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--pos-text-muted)]">Notes</p>
            <input
              className="h-11 w-full px-3 text-sm"
              placeholder="e.g. less spicy"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="shrink-0 border-t border-[var(--pos-border)] p-5">
          <button
            type="button"
            onClick={() => onAdd({ variation, addOns: selectedAddOns, notes: notes.trim() || undefined })}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--pos-primary)] text-sm font-semibold text-white"
          >
            Add to order — {PosLogic.formatPKR(unitPrice)}
          </button>
        </div>
      </div>
    </div>
  )
}
