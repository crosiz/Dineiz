import { useState } from 'react'
import Modal from '../../components/Modal'

interface CashMovementModalProps {
  shiftId: string
  onClose: () => void
  onRecorded: () => void
}

export default function CashMovementModal({ shiftId, onClose, onRecorded }: CashMovementModalProps) {
  const [direction, setDirection] = useState<'CASH_IN' | 'CASH_OUT'>('CASH_IN')
  const [amount, setAmount] = useState(0)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(): Promise<void> {
    setError(null)
    setSaving(true)
    try {
      await window.dineiz.shifts.recordActivity({ shiftId, type: direction, amount, note: note.trim() || undefined })
      onRecorded()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose} title="Cash in / out">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setDirection('CASH_IN')}
            className={`h-11 rounded-xl border text-sm font-semibold ${
              direction === 'CASH_IN'
                ? 'border-[var(--pos-green)] bg-green-50 text-[var(--pos-green)]'
                : 'border-[var(--pos-border-strong)] text-[var(--pos-text-secondary)]'
            }`}
          >
            Cash In
          </button>
          <button
            type="button"
            onClick={() => setDirection('CASH_OUT')}
            className={`h-11 rounded-xl border text-sm font-semibold ${
              direction === 'CASH_OUT'
                ? 'border-[var(--pos-red)] bg-red-50 text-[var(--pos-red)]'
                : 'border-[var(--pos-border-strong)] text-[var(--pos-text-secondary)]'
            }`}
          >
            Cash Out
          </button>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[var(--pos-text-secondary)]">Amount (PKR)</span>
          <input
            type="number"
            className="h-12 w-full px-3 text-center text-lg font-bold"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            autoFocus
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[var(--pos-text-secondary)]">Note (optional)</span>
          <input
            className="h-10 w-full px-3 text-sm"
            placeholder={direction === 'CASH_IN' ? 'e.g. Change top-up' : 'e.g. Sent to safe'}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        {error && <p className="text-sm text-[var(--pos-red)]">{error}</p>}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving || amount <= 0}
          className="h-11 w-full rounded-xl bg-[var(--pos-primary)] text-sm font-bold text-white disabled:opacity-40"
        >
          {saving ? 'Saving…' : `Record ${direction === 'CASH_IN' ? 'cash in' : 'cash out'}`}
        </button>
      </div>
    </Modal>
  )
}
