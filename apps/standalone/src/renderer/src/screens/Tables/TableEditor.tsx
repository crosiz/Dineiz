import { useState } from 'react'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'

type FloorPlan = Awaited<ReturnType<typeof window.dineiz.tables.getAll>>
type TableSummary = FloorPlan['floors'][number]['tables'][number]

interface TableEditorProps {
  floorId: string
  table: TableSummary | null
  onClose: () => void
  onSaved: () => Promise<void>
}

export default function TableEditor({ floorId, table, onClose, onSaved }: TableEditorProps) {
  const [label, setLabel] = useState(table?.label ?? '')
  const [seats, setSeats] = useState(table?.seats ?? 2)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  async function handleSave(): Promise<void> {
    setError(null)
    setSaving(true)
    try {
      if (table) {
        await window.dineiz.tables.updateTable({ id: table.id, label, seats })
      } else {
        await window.dineiz.tables.createTable({ floorId, label, seats })
      }
      await onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete(): Promise<void> {
    if (!table) return
    try {
      await window.dineiz.tables.deleteTable({ id: table.id })
      await onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setConfirmingDelete(false)
    }
  }

  return (
    <>
      <Modal onClose={onClose} title={table ? 'Edit table' : 'New table'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--pos-text-secondary)]">Label</span>
              <input
                className="h-10 w-full px-3"
                placeholder="e.g. T1"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                autoFocus
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--pos-text-secondary)]">Seats</span>
              <input
                type="number"
                min={1}
                className="h-10 w-full px-3"
                value={seats}
                onChange={(e) => setSeats(Number(e.target.value))}
              />
            </label>
          </div>

          {error && <p className="text-sm text-[var(--pos-red)]">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !label.trim()}
              className="h-10 rounded-xl bg-[var(--pos-primary)] px-4 text-sm font-semibold text-white disabled:opacity-40"
            >
              {saving ? 'Saving…' : table ? 'Save changes' : 'Create table'}
            </button>
            {table && (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="h-10 rounded-xl border border-[var(--pos-red)] px-4 text-sm font-semibold text-[var(--pos-red)]"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </Modal>

      {confirmingDelete && table && (
        <ConfirmDialog
          title="Delete table"
          message={`Delete "${table.label}"? This only works while it has no order history and isn't currently occupied.`}
          confirmLabel="Delete"
          onConfirm={confirmDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </>
  )
}
