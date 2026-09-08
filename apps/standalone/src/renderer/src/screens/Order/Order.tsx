import { useEffect, useMemo, useState } from 'react'
import type { RoundingMethod } from '@dineiz/pos-logic'
import { useMenuStore } from '../../state/menuStore'
import { useCartStore } from '../../state/cartStore'
import MenuItemCard from '../../components/MenuItemCard'
import ItemOptionsSheet from './ItemOptionsSheet'
import CartPanel from './CartPanel'

type Menu = Awaited<ReturnType<typeof window.dineiz.menu.getAll>>
type ItemSummary = Menu['categories'][number]['items'][number]

interface OrderTaxConfig {
  cashTaxRatePercent: number
  cardTaxRatePercent: number
  cashTaxEnabled: boolean
  cardTaxEnabled: boolean
  roundingMethod: RoundingMethod
}

interface OrderProps {
  cashierId: string
  shiftId: string
  taxConfig: OrderTaxConfig
  onOrderCreated: (orderId: string, action: 'kitchen' | 'charge') => void
}

export default function Order({ cashierId, shiftId, taxConfig, onOrderCreated }: OrderProps) {
  const { categories, loaded, refresh } = useMenuStore()
  const { orderType, lines, discount, tableId, addLine, clear } = useCartStore()
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [optionsItem, setOptionsItem] = useState<ItemSummary | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!loaded) void refresh()
  }, [loaded, refresh])

  const allItems = useMemo(
    () => categories.flatMap((c) => c.items.map((i) => ({ ...i, categoryName: c.name }))),
    [categories]
  )

  const visibleItems = useMemo(() => {
    let items = allItems
    if (selectedCategoryId) items = items.filter((i) => i.categoryId === selectedCategoryId)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      items = items.filter((i) => i.name.toLowerCase().includes(q))
    }
    return items
  }, [allItems, selectedCategoryId, search])

  const cartQuantityByItem = useMemo(() => {
    const map = new Map<string, number>()
    for (const line of lines) map.set(line.itemId, (map.get(line.itemId) ?? 0) + line.quantity)
    return map
  }, [lines])

  function handleItemClick(item: ItemSummary): void {
    if (item.variations.length > 0 || item.addons.length > 0) {
      setOptionsItem(item)
    } else {
      addLine({ itemId: item.id, name: item.name, basePrice: item.price, variation: null, addOns: [] })
    }
  }

  async function handleSubmit(action: 'hold' | 'kitchen' | 'charge'): Promise<void> {
    setError(null)
    setSubmitting(true)
    try {
      const result = await window.dineiz.orders.create({
        type: orderType,
        tableId: orderType === 'DINE_IN' ? tableId : null,
        cashierId,
        shiftId,
        lines: lines.map((l) => ({
          itemId: l.itemId,
          variationId: l.variation?.id ?? null,
          addOnIds: l.addOns.map((a) => a.id),
          quantity: l.quantity,
          notes: l.notes
        })),
        discount
      })

      if (action === 'kitchen') {
        await window.dineiz.orders.sendToKitchen({ orderId: result.id })
      }

      clear()

      if (action !== 'hold') onOrderCreated(result.id, action)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="shrink-0 space-y-3 border-b border-[var(--pos-border)] p-3">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--pos-text-muted)]">
              search
            </span>
            <input
              className="h-10 w-full pl-10 pr-3 text-sm"
              placeholder="Search menu…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => setSelectedCategoryId(null)}
              className={`h-9 shrink-0 rounded-full px-4 text-xs font-semibold ${
                selectedCategoryId === null
                  ? 'bg-[var(--pos-primary)] text-white'
                  : 'border border-[var(--pos-border-strong)] text-[var(--pos-text-secondary)]'
              }`}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCategoryId(c.id)}
                className={`h-9 shrink-0 rounded-full px-4 text-xs font-semibold ${
                  selectedCategoryId === c.id
                    ? 'bg-[var(--pos-primary)] text-white'
                    : 'border border-[var(--pos-border-strong)] text-[var(--pos-text-secondary)]'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {visibleItems.length === 0 ? (
            <p className="p-6 text-center text-sm text-[var(--pos-text-secondary)]">
              {allItems.length === 0 ? 'No menu items yet — add some from Admin.' : 'No items match.'}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {visibleItems.map((item) => (
                <MenuItemCard
                  key={item.id}
                  name={item.name}
                  price={item.price}
                  categoryName={item.categoryName}
                  isAvailable={item.isAvailable}
                  hasOptions={item.variations.length > 0 || item.addons.length > 0}
                  cartQuantity={cartQuantityByItem.get(item.id) ?? 0}
                  onClick={() => handleItemClick(item)}
                />
              ))}
            </div>
          )}
        </div>
        {error && (
          <p className="shrink-0 border-t border-[var(--pos-border)] p-3 text-sm text-[var(--pos-red)]">{error}</p>
        )}
      </div>

      <CartPanel taxConfig={taxConfig} submitting={submitting} onSubmit={handleSubmit} />

      {optionsItem && (
        <ItemOptionsSheet
          item={optionsItem}
          onClose={() => setOptionsItem(null)}
          onAdd={(selection) => {
            addLine({
              itemId: optionsItem.id,
              name: optionsItem.name,
              basePrice: optionsItem.price,
              variation: selection.variation,
              addOns: selection.addOns,
              notes: selection.notes
            })
            setOptionsItem(null)
          }}
        />
      )}
    </div>
  )
}
