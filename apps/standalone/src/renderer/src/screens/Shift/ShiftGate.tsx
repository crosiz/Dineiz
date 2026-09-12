import { useState } from 'react'

interface ShiftGateProps {
  cashierId: string
  onOpened: () => void
}

export default function ShiftGate({ cashierId, onOpened }: ShiftGateProps) {
  const [openingFloat, setOpeningFloat] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleOpen(): Promise<void> {
    setError(null)
    setSubmitting(true)
    try {
      await window.dineiz.shifts.open({ cashierId, openingFloat })
      onOpened()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-[var(--pos-bg-base)] p-6">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-bg-card)] p-8 text-center shadow-sm">
        <span className="material-symbols-outlined text-4xl text-[var(--pos-primary)]">point_of_sale</span>
        <h1 className="clash-display mt-2 text-2xl font-bold">Open Shift</h1>
        <p className="mt-1 text-sm text-[var(--pos-text-secondary)]">Count the cash drawer to start your shift.</p>

        <label className="mt-6 block text-left">
          <span className="mb-1 block text-xs font-medium text-[var(--pos-text-secondary)]">Opening float (PKR)</span>
          <input
            type="number"
            className="h-12 w-full px-3 text-center text-lg font-bold"
            value={openingFloat}
            onChange={(e) => setOpeningFloat(Number(e.target.value))}
            autoFocus
          />
        </label>

        {error && <p className="mt-3 text-sm text-[var(--pos-red)]">{error}</p>}

        <button
          type="button"
          onClick={handleOpen}
          disabled={submitting || openingFloat < 0}
          className="mt-6 h-12 w-full rounded-xl bg-[var(--pos-primary)] text-sm font-bold text-white disabled:opacity-40"
        >
          {submitting ? 'Opening…' : 'Open Shift'}
        </button>
      </div>
    </div>
  )
}
