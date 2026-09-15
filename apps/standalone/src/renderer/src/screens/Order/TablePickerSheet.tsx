import { useEffect } from 'react'
import { useTablesStore } from '../../state/tablesStore'

interface TablePickerSheetProps {
  selectedTableId: string | null
  onClose: () => void
  onSelect: (table: { id: string; label: string } | null) => void
}

export default function TablePickerSheet({ selectedTableId, onClose, onSelect }: TablePickerSheetProps) {
  const { floors, refresh } = useTablesStore()

  // Occupancy changes on every order lifecycle event elsewhere in the app,
  // so this always re-fetches on open rather than trusting a possibly-stale
  // cached list — the one thing that actually matters here (is this table
  // free right now) is exactly the thing most likely to have gone stale.
  useEffect(() => {
    void refresh()
  }, [refresh])

  const hasAnyTables = floors.some((f) => f.tables.length > 0)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="slide-up flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-[var(--pos-bg-card)] shadow-xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-[var(--pos-border)] p-5">
          <h2 className="clash-display text-lg font-bold">Select table</h2>
          <p className="mt-0.5 text-sm text-[var(--pos-text-secondary)]">Which table is this order for?</p>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          {!hasAnyTables && (
            <p className="text-sm text-[var(--pos-text-secondary)]">
              No tables set up yet — add some from Admin → Tables.
            </p>
          )}
          {floors.map(
            (floor) =>
              floor.tables.length > 0 && (
                <div key={floor.id}>
                  {floors.length > 1 && (
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--pos-text-muted)]">
                      {floor.name}
                    </p>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    {floor.tables.map((t) => {
                      const isFree = t.status === 'FREE'
                      const isSelected = t.id === selectedTableId
                      const isSelectable = isFree || isSelected
                      return (
                        <button
                          key={t.id}
                          type="button"
                          disabled={!isSelectable}
                          onClick={() => onSelect({ id: t.id, label: t.label })}
                          className={`rounded-xl border px-2 py-3 text-center text-sm font-semibold ${
                            isSelected
                              ? 'border-[var(--pos-primary)] bg-[var(--pos-primary-dim)] text-[var(--pos-primary)]'
                              : isFree
                                ? 'border-[var(--pos-border-strong)] text-[var(--pos-text-primary)]'
                                : 'border-[var(--pos-border)] text-[var(--pos-text-muted)] opacity-50'
                          }`}
                        >
                          {t.label}
                          <span className="mt-0.5 block text-[10px] font-normal uppercase tracking-wide">
                            {isSelected ? 'Selected' : isFree ? `${t.seats} seats` : t.status.toLowerCase()}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
          )}
        </div>

        <div className="shrink-0 border-t border-[var(--pos-border)] p-4">
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="h-11 w-full rounded-xl border border-[var(--pos-border-strong)] text-sm font-semibold text-[var(--pos-text-secondary)]"
          >
            No table
          </button>
        </div>
      </div>
    </div>
  )
}
