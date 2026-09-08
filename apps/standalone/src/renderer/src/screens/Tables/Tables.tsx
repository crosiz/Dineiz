import { useEffect, useState } from 'react'
import ConfirmDialog from '../../components/ConfirmDialog'
import IconButton from '../../components/IconButton'
import TableEditor from './TableEditor'

type FloorPlan = Awaited<ReturnType<typeof window.dineiz.tables.getAll>>
type FloorWithTables = FloorPlan['floors'][number]
type TableSummary = FloorWithTables['tables'][number]
type TableStatus = TableSummary['status']

const STATUS_STYLE: Record<TableStatus, string> = {
  FREE: 'bg-[var(--pos-green)]/10 text-[var(--pos-green)]',
  OCCUPIED: 'bg-[var(--pos-red)]/10 text-[var(--pos-red)]',
  RESERVED: 'bg-[var(--pos-blue)]/10 text-[var(--pos-blue)]',
  DIRTY: 'bg-[var(--pos-yellow)]/10 text-[var(--pos-yellow)]',
  INACTIVE: 'bg-[var(--pos-text-muted)]/10 text-[var(--pos-text-muted)]'
}

export default function Tables() {
  const [floors, setFloors] = useState<FloorWithTables[]>([])
  const [loaded, setLoaded] = useState(false)
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null)
  const [newFloorName, setNewFloorName] = useState('')
  const [editingTable, setEditingTable] = useState<TableSummary | 'new' | null>(null)
  const [deletingFloorId, setDeletingFloorId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function refresh(): Promise<void> {
    const data = await window.dineiz.tables.getAll()
    setFloors(data.floors)
    setLoaded(true)
  }

  useEffect(() => {
    if (!loaded) void refresh()
  }, [loaded])

  useEffect(() => {
    if (!selectedFloorId && floors.length > 0) {
      setSelectedFloorId(floors[0].id)
    }
  }, [floors, selectedFloorId])

  const selectedFloor = floors.find((f) => f.id === selectedFloorId) ?? null
  const deletingFloor = floors.find((f) => f.id === deletingFloorId) ?? null

  async function addFloor(): Promise<void> {
    const name = newFloorName.trim()
    if (!name) return
    const { id } = await window.dineiz.tables.createFloor({ name })
    setNewFloorName('')
    await refresh()
    setSelectedFloorId(id)
  }

  async function confirmDeleteFloor(): Promise<void> {
    if (!deletingFloorId) return
    try {
      await window.dineiz.tables.deleteFloor({ id: deletingFloorId })
      await refresh()
      if (selectedFloorId === deletingFloorId) setSelectedFloorId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setDeletingFloorId(null)
    }
  }

  return (
    <div className="flex h-full">
      <aside className="flex w-56 shrink-0 flex-col border-r border-[var(--pos-border)] bg-[var(--pos-bg-card)]">
        <div className="border-b border-[var(--pos-border)] p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--pos-text-muted)]">Floors</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {floors.map((f) => (
            <div
              key={f.id}
              className={`flex items-center justify-between rounded-lg py-1 pl-3 pr-1 text-sm ${
                f.id === selectedFloorId
                  ? 'bg-[var(--pos-primary-dim)] font-semibold text-[var(--pos-primary)]'
                  : 'text-[var(--pos-text-primary)]'
              }`}
            >
              <button type="button" className="flex-1 py-1 text-left" onClick={() => setSelectedFloorId(f.id)}>
                {f.name} <span className="text-[var(--pos-text-muted)]">({f.tables.length})</span>
              </button>
              <IconButton icon="delete" variant="danger" label={`Delete ${f.name}`} onClick={() => setDeletingFloorId(f.id)} />
            </div>
          ))}
          {floors.length === 0 && <p className="p-2 text-xs text-[var(--pos-text-muted)]">No floors yet.</p>}
        </div>
        {error && <p className="shrink-0 px-3 pb-1 text-xs text-[var(--pos-red)]">{error}</p>}
        <div className="flex shrink-0 gap-2 border-t border-[var(--pos-border)] p-3">
          <input
            className="h-10 min-w-0 flex-1 px-2 text-sm"
            placeholder="New floor"
            value={newFloorName}
            onChange={(e) => setNewFloorName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void addFloor()}
          />
          <button
            type="button"
            onClick={addFloor}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--pos-primary)] text-white"
          >
            <span className="material-symbols-outlined text-lg">add</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-6">
        {!selectedFloor ? (
          <p className="text-sm text-[var(--pos-text-secondary)]">Add a floor to get started.</p>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h1 className="clash-display text-xl font-bold">{selectedFloor.name}</h1>
              <button
                type="button"
                onClick={() => setEditingTable('new')}
                className="h-10 rounded-xl bg-[var(--pos-primary)] px-4 text-sm font-semibold text-white"
              >
                + Add table
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {selectedFloor.tables.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setEditingTable(t)}
                  className="rounded-xl border border-[var(--pos-border)] bg-[var(--pos-bg-card)] p-3 text-left shadow-sm"
                >
                  <p className="text-sm font-semibold">{t.label}</p>
                  <p className="mt-1 text-xs text-[var(--pos-text-secondary)]">
                    {t.seats} {t.seats === 1 ? 'seat' : 'seats'}
                  </p>
                  <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[t.status]}`}>
                    {t.status}
                  </span>
                </button>
              ))}
            </div>
            {selectedFloor.tables.length === 0 && (
              <p className="text-sm text-[var(--pos-text-secondary)]">No tables on this floor yet.</p>
            )}
          </>
        )}
      </main>

      {editingTable && selectedFloor && (
        <TableEditor
          floorId={selectedFloor.id}
          table={editingTable === 'new' ? null : editingTable}
          onClose={() => setEditingTable(null)}
          onSaved={refresh}
        />
      )}

      {deletingFloor && (
        <ConfirmDialog
          title="Delete floor"
          message={`Delete "${deletingFloor.name}"? This only works while it has no tables.`}
          confirmLabel="Delete"
          onConfirm={confirmDeleteFloor}
          onCancel={() => setDeletingFloorId(null)}
        />
      )}
    </div>
  )
}
