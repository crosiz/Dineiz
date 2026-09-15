import { useState } from 'react'
import * as PosLogic from '@dineiz/pos-logic'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import IconButton from '../../components/IconButton'

type Menu = Awaited<ReturnType<typeof window.dineiz.menu.getAll>>
type ItemSummary = Menu['categories'][number]['items'][number]

interface ItemEditorProps {
  categoryId: string
  item: ItemSummary | null
  onClose: () => void
  onSaved: () => Promise<void>
}

export default function ItemEditor({ categoryId, item, onClose, onSaved }: ItemEditorProps) {
  const [name, setName] = useState(item?.name ?? '')
  const [price, setPrice] = useState(item?.price ?? 0)
  const [isAvailable, setIsAvailable] = useState(item?.isAvailable ?? true)
  const [variations, setVariations] = useState(item?.variations ?? [])
  const [addons, setAddons] = useState(item?.addons ?? [])
  const [newVariationName, setNewVariationName] = useState('')
  const [newVariationPrice, setNewVariationPrice] = useState(0)
  const [newAddonName, setNewAddonName] = useState('')
  const [newAddonPrice, setNewAddonPrice] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmingDeleteItem, setConfirmingDeleteItem] = useState(false)

  async function handleSave(): Promise<void> {
    setError(null)
    setSaving(true)
    try {
      if (item) {
        await window.dineiz.menu.updateItem({ id: item.id, name, price, categoryId })
        await window.dineiz.menu.setItemAvailability({ id: item.id, isAvailable })
      } else {
        const result = await window.dineiz.menu.createItem({ categoryId, name, price })
        if (!isAvailable) await window.dineiz.menu.setItemAvailability({ id: result.id, isAvailable })
      }
      await onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function confirmDeleteItem(): Promise<void> {
    if (!item) return
    try {
      await window.dineiz.menu.deleteItem({ id: item.id })
      await onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setConfirmingDeleteItem(false)
    }
  }

  async function addVariation(): Promise<void> {
    if (!item || !newVariationName.trim()) return
    const { id } = await window.dineiz.menu.createVariation({
      itemId: item.id,
      name: newVariationName.trim(),
      price: newVariationPrice
    })
    setVariations((v) => [...v, { id, name: newVariationName.trim(), price: newVariationPrice, sortOrder: v.length }])
    setNewVariationName('')
    setNewVariationPrice(0)
    await onSaved()
  }

  async function removeVariation(id: string): Promise<void> {
    try {
      await window.dineiz.menu.deleteVariation({ id })
      setVariations((v) => v.filter((x) => x.id !== id))
      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function addAddon(): Promise<void> {
    if (!item || !newAddonName.trim()) return
    const { id } = await window.dineiz.menu.createAddon({
      itemId: item.id,
      name: newAddonName.trim(),
      price: newAddonPrice
    })
    setAddons((a) => [...a, { id, name: newAddonName.trim(), price: newAddonPrice, sortOrder: a.length }])
    setNewAddonName('')
    setNewAddonPrice(0)
    await onSaved()
  }

  async function removeAddon(id: string): Promise<void> {
    await window.dineiz.menu.deleteAddon({ id })
    setAddons((a) => a.filter((x) => x.id !== id))
    await onSaved()
  }

  return (
    <>
      <Modal onClose={onClose} title={item ? 'Edit item' : 'New item'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--pos-text-secondary)]">Name</span>
              <input className="h-10 w-full px-3" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--pos-text-secondary)]">Price (PKR)</span>
              <input
                type="number"
                className="h-10 w-full px-3"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
              />
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isAvailable} onChange={(e) => setIsAvailable(e.target.checked)} />
            Available on the menu
          </label>

          {error && <p className="text-sm text-[var(--pos-red)]">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="h-10 rounded-xl bg-[var(--pos-primary)] px-4 text-sm font-semibold text-white disabled:opacity-40"
            >
              {saving ? 'Saving…' : item ? 'Save changes' : 'Create item'}
            </button>
            {item && (
              <button
                type="button"
                onClick={() => setConfirmingDeleteItem(true)}
                className="h-10 rounded-xl border border-[var(--pos-red)] px-4 text-sm font-semibold text-[var(--pos-red)]"
              >
                Delete
              </button>
            )}
          </div>

          {item && (
            <>
              <div className="border-t border-[var(--pos-border)] pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--pos-text-muted)]">
                  Variations
                </p>
                {variations.map((v) => (
                  <div key={v.id} className="flex items-center justify-between py-1">
                    <span className="text-sm">
                      {v.name} — <span className="font-mono text-[var(--pos-price)]">{PosLogic.formatPKR(v.price)}</span>
                    </span>
                    <IconButton
                      icon="delete"
                      variant="danger"
                      label={`Delete ${v.name}`}
                      onClick={() => removeVariation(v.id)}
                    />
                  </div>
                ))}
                <div className="mt-2 flex gap-2">
                  <input
                    className="h-10 min-w-0 flex-1 px-2 text-sm"
                    placeholder="Name (e.g. Full)"
                    value={newVariationName}
                    onChange={(e) => setNewVariationName(e.target.value)}
                  />
                  <input
                    type="number"
                    className="h-10 w-24 px-2 text-sm"
                    placeholder="Price"
                    value={newVariationPrice}
                    onChange={(e) => setNewVariationPrice(Number(e.target.value))}
                  />
                  <button
                    type="button"
                    onClick={addVariation}
                    className="h-10 rounded-lg bg-[var(--pos-bg-elevated)] px-3 text-sm font-medium"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="border-t border-[var(--pos-border)] pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--pos-text-muted)]">
                  Add-ons
                </p>
                {addons.map((a) => (
                  <div key={a.id} className="flex items-center justify-between py-1">
                    <span className="text-sm">
                      {a.name} — <span className="font-mono text-[var(--pos-price)]">{PosLogic.formatPKR(a.price)}</span>
                    </span>
                    <IconButton
                      icon="delete"
                      variant="danger"
                      label={`Delete ${a.name}`}
                      onClick={() => removeAddon(a.id)}
                    />
                  </div>
                ))}
                <div className="mt-2 flex gap-2">
                  <input
                    className="h-10 min-w-0 flex-1 px-2 text-sm"
                    placeholder="Name (e.g. Extra Cheese)"
                    value={newAddonName}
                    onChange={(e) => setNewAddonName(e.target.value)}
                  />
                  <input
                    type="number"
                    className="h-10 w-24 px-2 text-sm"
                    placeholder="Price"
                    value={newAddonPrice}
                    onChange={(e) => setNewAddonPrice(Number(e.target.value))}
                  />
                  <button
                    type="button"
                    onClick={addAddon}
                    className="h-10 rounded-lg bg-[var(--pos-bg-elevated)] px-3 text-sm font-medium"
                  >
                    Add
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </Modal>

      {confirmingDeleteItem && item && (
        <ConfirmDialog
          title="Delete item"
          message={`Delete "${item.name}"? This can't be undone unless it has order history, in which case it's blocked instead.`}
          confirmLabel="Delete"
          onConfirm={confirmDeleteItem}
          onCancel={() => setConfirmingDeleteItem(false)}
        />
      )}
    </>
  )
}
