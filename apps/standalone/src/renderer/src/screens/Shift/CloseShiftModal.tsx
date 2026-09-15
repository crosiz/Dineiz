import { useEffect, useState } from 'react'
import * as PosLogic from '@dineiz/pos-logic'
import Modal from '../../components/Modal'

type ShiftReport = Awaited<ReturnType<typeof window.dineiz.shifts.report>>

interface CloseShiftModalProps {
  shiftId: string
  onClose: () => void
  onClosed: () => void
}

export default function CloseShiftModal({ shiftId, onClose, onClosed }: CloseShiftModalProps) {
  const [report, setReport] = useState<ShiftReport | null>(null)
  const [countedCash, setCountedCash] = useState<number | ''>('')
  const [error, setError] = useState<string | null>(null)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    window.dineiz.shifts.report({ shiftId }).then(setReport)
  }, [shiftId])

  if (!report) {
    return (
      <Modal onClose={onClose} title="Close shift">
        <p className="text-sm text-[var(--pos-text-secondary)]">Loading shift totals…</p>
      </Modal>
    )
  }

  const expectedCash = report.openingFloat + report.cashSales + report.cashIn - report.cashOut
  const variance = typeof countedCash === 'number' ? countedCash - expectedCash : null

  async function handleClose(): Promise<void> {
    if (typeof countedCash !== 'number') return
    setError(null)
    setClosing(true)
    try {
      await window.dineiz.shifts.close({ shiftId, countedCash })
      onClosed()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setClosing(false)
    }
  }

  return (
    <Modal onClose={onClose} title="Close shift">
      <div className="space-y-4">
        <div className="space-y-1.5 rounded-xl bg-[var(--pos-bg-elevated)] p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--pos-text-secondary)]">Opening float</span>
            <span className="font-mono">{PosLogic.formatPKR(report.openingFloat)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--pos-text-secondary)]">Cash sales</span>
            <span className="font-mono">+{PosLogic.formatPKR(report.cashSales)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--pos-text-secondary)]">Cash in</span>
            <span className="font-mono">+{PosLogic.formatPKR(report.cashIn)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--pos-text-secondary)]">Cash out</span>
            <span className="font-mono">-{PosLogic.formatPKR(report.cashOut)}</span>
          </div>
          <div className="flex justify-between border-t border-[var(--pos-border)] pt-1.5 font-bold">
            <span>Expected cash</span>
            <span className="font-mono text-[var(--pos-price)]">{PosLogic.formatPKR(expectedCash)}</span>
          </div>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[var(--pos-text-secondary)]">
            Counted cash in drawer (PKR)
          </span>
          <input
            type="number"
            className="h-12 w-full px-3 text-center text-lg font-bold"
            value={countedCash}
            onChange={(e) => setCountedCash(e.target.value === '' ? '' : Number(e.target.value))}
            autoFocus
          />
        </label>

        {variance !== null && (
          <p
            className={`text-center text-sm font-semibold ${
              variance === 0
                ? 'text-[var(--pos-green)]'
                : variance > 0
                  ? 'text-[var(--pos-blue)]'
                  : 'text-[var(--pos-red)]'
            }`}
          >
            {variance === 0
              ? 'Drawer matches exactly'
              : variance > 0
                ? `PKR ${variance.toLocaleString()} over`
                : `PKR ${Math.abs(variance).toLocaleString()} short`}
          </p>
        )}

        {error && <p className="text-sm text-[var(--pos-red)]">{error}</p>}

        <button
          type="button"
          onClick={handleClose}
          disabled={closing || typeof countedCash !== 'number' || countedCash < 0}
          className="h-11 w-full rounded-xl bg-[var(--pos-primary)] text-sm font-bold text-white disabled:opacity-40"
        >
          {closing ? 'Closing shift…' : 'Close shift'}
        </button>
      </div>
    </Modal>
  )
}
