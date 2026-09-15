import { useEffect, useState } from 'react'
import * as PosLogic from '@dineiz/pos-logic'
import { useMenuStore } from '../../state/menuStore'
import ItemEditor from './ItemEditor'
import ConfirmDialog from '../../components/ConfirmDialog'
import IconButton from '../../components/IconButton'

export default function MenuManagement() {
  const { categories, loaded, refresh } = useMenuStore()
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [editingItemId, setEditingItemId] = useState<string | 'new' | null>(null)
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!loaded) void refresh()
  }, [loaded, refresh])

  useEffect(() => {
    if (!selectedCategoryId && categories.length > 0) {
      setSelectedCategoryId(categories[0].id)
    }
  }, [categories, selectedCategoryId])

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId) ?? null
  const deletingCategory = categories.find((c) => c.id === deletingCategoryId) ?? null

  async function addCategory(): Promise<void> {
    const name = newCategoryName.trim()
    if (!name) return
    const { id } = await window.dineiz.menu.createCategory({ name })
    setNewCategoryName('')
    await refresh()
    setSelectedCategoryId(id)
  }

  async function confirmDeleteCategory(): Promise<void> {
    if (!deletingCategoryId) return
    try {
      await window.dineiz.menu.deleteCategory({ id: deletingCategoryId })
      await refresh()
      if (selectedCategoryId === deletingCategoryId) setSelectedCategoryId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setDeletingCategoryId(null)
    }
  }

  return (
    <div className="flex h-full">
      <aside className="flex w-56 shrink-0 flex-col border-r border-[var(--pos-border)] bg-[var(--pos-bg-card)]">
        <div className="border-b border-[var(--pos-border)] p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--pos-text-muted)]">Categories</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {categories.map((c) => (
            <div
              key={c.id}
              className={`flex items-center justify-between rounded-lg py-1 pl-3 pr-1 text-sm ${
                c.id === selectedCategoryId
                  ? 'bg-[var(--pos-primary-dim)] font-semibold text-[var(--pos-primary)]'
                  : 'text-[var(--pos-text-primary)]'
              }`}
            >
              <button type="button" className="flex-1 py-1 text-left" onClick={() => setSelectedCategoryId(c.id)}>
                {c.name} <span className="text-[var(--pos-text-muted)]">({c.items.length})</span>
              </button>
              <IconButton icon="delete" variant="danger" label={`Delete ${c.name}`} onClick={() => setDeletingCategoryId(c.id)} />
            </div>
          ))}
          {categories.length === 0 && <p className="p-2 text-xs text-[var(--pos-text-muted)]">No categories yet.</p>}
        </div>
        {error && <p className="shrink-0 px-3 pb-1 text-xs text-[var(--pos-red)]">{error}</p>}
        <div className="flex shrink-0 gap-2 border-t border-[var(--pos-border)] p-3">
          <input
            className="h-10 min-w-0 flex-1 px-2 text-sm"
            placeholder="New category"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void addCategory()}
          />
          <button
            type="button"
            onClick={addCategory}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--pos-primary)] text-white"
          >
            <span className="material-symbols-outlined text-lg">add</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-6">
        {!selectedCategory ? (
          <p className="text-sm text-[var(--pos-text-secondary)]">Add a category to get started.</p>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h1 className="clash-display text-xl font-bold">{selectedCategory.name}</h1>
              <button
                type="button"
                onClick={() => setEditingItemId('new')}
                className="h-10 rounded-xl bg-[var(--pos-primary)] px-4 text-sm font-semibold text-white"
              >
                + Add item
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {selectedCategory.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setEditingItemId(item.id)}
                  className="rounded-xl border border-[var(--pos-border)] bg-[var(--pos-bg-card)] p-3 text-left shadow-sm"
                >
                  <p className="text-sm font-semibold">{item.name}</p>
                  <p className="mt-1 font-mono text-sm text-[var(--pos-price)]">{PosLogic.formatPKR(item.price)}</p>
                  {!item.isAvailable && (
                    <span className="mt-2 inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-[var(--pos-red)]">
                      Unavailable
                    </span>
                  )}
                </button>
              ))}
            </div>
            {selectedCategory.items.length === 0 && (
              <p className="text-sm text-[var(--pos-text-secondary)]">No items in this category yet.</p>
            )}
          </>
        )}
      </main>

      {editingItemId && selectedCategory && (
        <ItemEditor
          categoryId={selectedCategory.id}
          item={editingItemId === 'new' ? null : (selectedCategory.items.find((i) => i.id === editingItemId) ?? null)}
          onClose={() => setEditingItemId(null)}
          onSaved={refresh}
        />
      )}

      {deletingCategory && (
        <ConfirmDialog
          title="Delete category"
          message={`Delete "${deletingCategory.name}"? This only works while it has no items.`}
          confirmLabel="Delete"
          onConfirm={confirmDeleteCategory}
          onCancel={() => setDeletingCategoryId(null)}
        />
      )}
    </div>
  )
}
