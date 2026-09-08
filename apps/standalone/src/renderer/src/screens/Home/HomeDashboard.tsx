import { useCallback, useEffect, useState } from 'react'
import CashMovementModal from '../Shift/CashMovementModal'
import CloseShiftModal from '../Shift/CloseShiftModal'

type ActivityList = Awaited<ReturnType<typeof window.dineiz.shifts.listActivities>>

interface HomeDashboardProps {
  userName: string
  role: string
  shiftId: string
  shiftOpenedAt: string
  onGoToOrder: () => void
  onShiftClosed: () => void
}

function deriveOnBreak(activities: ActivityList): boolean {
  const lastBreakEvent = [...activities].reverse().find((a) => a.type === 'BREAK_START' || a.type === 'BREAK_END')
  return lastBreakEvent?.type === 'BREAK_START'
}

export default function HomeDashboard({
  userName,
  role,
  shiftId,
  shiftOpenedAt,
  onGoToOrder,
  onShiftClosed
}: HomeDashboardProps) {
  const [onBreak, setOnBreak] = useState(false)
  const [showCashMovement, setShowCashMovement] = useState(false)
  const [showCloseShift, setShowCloseShift] = useState(false)
  const [breakError, setBreakError] = useState<string | null>(null)

  const refreshBreakState = useCallback(async () => {
    const activities = await window.dineiz.shifts.listActivities({ shiftId })
    setOnBreak(deriveOnBreak(activities))
  }, [shiftId])

  useEffect(() => {
    void refreshBreakState()
  }, [refreshBreakState])

  async function toggleBreak(): Promise<void> {
    setBreakError(null)
    try {
      await window.dineiz.shifts.recordActivity({ shiftId, type: onBreak ? 'BREAK_END' : 'BREAK_START' })
      await refreshBreakState()
    } catch (err) {
      setBreakError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-8 text-center">
      <div>
        <p className="text-sm text-[var(--pos-text-secondary)]">Welcome back,</p>
        <h1 className="clash-display text-3xl font-bold">{userName}</h1>
        <p className="mt-1 text-xs uppercase tracking-wide text-[var(--pos-text-muted)]">{role}</p>
      </div>

      <div className="rounded-xl border border-[var(--pos-border)] bg-[var(--pos-bg-card)] px-6 py-3 text-sm">
        <span className="text-[var(--pos-text-secondary)]">Shift open since </span>
        <span className="font-semibold">
          {new Date(shiftOpenedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
        </span>
        {onBreak && (
          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">
            On break
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={onGoToOrder}
        disabled={onBreak}
        className="flex h-14 items-center gap-2 rounded-xl bg-[var(--pos-primary)] px-8 text-base font-bold text-white shadow-[var(--pos-primary-glow)] disabled:opacity-40"
      >
        <span className="material-symbols-outlined">add_shopping_cart</span>
        Start New Order
      </button>

      {breakError && <p className="text-sm text-[var(--pos-red)]">{breakError}</p>}

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={toggleBreak}
          className="flex h-10 items-center gap-1.5 rounded-xl border border-[var(--pos-border-strong)] px-4 text-xs font-semibold text-[var(--pos-text-secondary)]"
        >
          <span className="material-symbols-outlined text-base">{onBreak ? 'play_circle' : 'pause_circle'}</span>
          {onBreak ? 'End break' : 'Take a break'}
        </button>
        <button
          type="button"
          onClick={() => setShowCashMovement(true)}
          className="flex h-10 items-center gap-1.5 rounded-xl border border-[var(--pos-border-strong)] px-4 text-xs font-semibold text-[var(--pos-text-secondary)]"
        >
          <span className="material-symbols-outlined text-base">payments</span>
          Cash in / out
        </button>
        <button
          type="button"
          onClick={() => setShowCloseShift(true)}
          className="flex h-10 items-center gap-1.5 rounded-xl border border-[var(--pos-red)] px-4 text-xs font-semibold text-[var(--pos-red)]"
        >
          <span className="material-symbols-outlined text-base">logout</span>
          Close shift
        </button>
      </div>

      {showCashMovement && (
        <CashMovementModal
          shiftId={shiftId}
          onClose={() => setShowCashMovement(false)}
          onRecorded={() => setShowCashMovement(false)}
        />
      )}

      {showCloseShift && (
        <CloseShiftModal shiftId={shiftId} onClose={() => setShowCloseShift(false)} onClosed={onShiftClosed} />
      )}
    </div>
  )
}
