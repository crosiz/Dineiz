import { useCallback, useEffect, useMemo, useState } from 'react'
import * as PosLogic from '@dineiz/pos-logic'
import CashMovementModal from '../Shift/CashMovementModal'
import CloseShiftModal from '../Shift/CloseShiftModal'

type ActivityList = Awaited<ReturnType<typeof window.dineiz.shifts.listActivities>>
type OrderSummary = Awaited<ReturnType<typeof window.dineiz.orders.listActive>>[number]
type ShiftReportData = Awaited<ReturnType<typeof window.dineiz.shifts.report>>
type FloorPlan = Awaited<ReturnType<typeof window.dineiz.tables.getAll>>
type TableSummary = FloorPlan['floors'][number]['tables'][number]

interface HomeDashboardProps {
  userName: string
  role: string
  shiftId: string
  shiftOpenedAt: string
  onGoToOrder: () => void
  onGoToTickets: () => void
  onShiftClosed: () => void
}

// A ticket sitting this long without moving is worth flagging — matches the
// same "rush" framing apps/pos's own Home dashboard uses.
const AGING_TICKET_MINUTES = 20
const REFRESH_INTERVAL_MS = 20_000

const STATUS_LABEL: Record<OrderSummary['status'], string> = {
  PENDING: 'Held',
  IN_KITCHEN: 'In Kitchen',
  READY: 'Ready',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled'
}

const STATUS_COLOR: Record<OrderSummary['status'], string> = {
  PENDING: 'text-[var(--pos-text-muted)] bg-[var(--pos-bg-elevated)]',
  IN_KITCHEN: 'text-[var(--pos-blue)] bg-blue-50',
  READY: 'text-[var(--pos-green)] bg-green-50',
  COMPLETED: 'text-[var(--pos-text-muted)] bg-[var(--pos-bg-elevated)]',
  CANCELLED: 'text-[var(--pos-red)] bg-red-50'
}

const TABLE_DOT_COLOR: Record<TableSummary['status'], string> = {
  FREE: 'bg-[var(--pos-green)]',
  OCCUPIED: 'bg-[var(--pos-red)]',
  RESERVED: 'bg-[var(--pos-blue)]',
  DIRTY: 'bg-[var(--pos-yellow)]',
  INACTIVE: 'bg-[var(--pos-border-strong)]'
}

function deriveOnBreak(activities: ActivityList): boolean {
  const lastBreakEvent = [...activities].reverse().find((a) => a.type === 'BREAK_START' || a.type === 'BREAK_END')
  return lastBreakEvent?.type === 'BREAK_START'
}

function minutesAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
}

export default function HomeDashboard({
  userName,
  role,
  shiftId,
  shiftOpenedAt,
  onGoToOrder,
  onGoToTickets,
  onShiftClosed
}: HomeDashboardProps) {
  const [onBreak, setOnBreak] = useState(false)
  const [showCashMovement, setShowCashMovement] = useState(false)
  const [showCloseShift, setShowCloseShift] = useState(false)
  const [breakError, setBreakError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState('0h 0m')

  const [activeOrders, setActiveOrders] = useState<OrderSummary[]>([])
  const [report, setReport] = useState<ShiftReportData | null>(null)
  const [floors, setFloors] = useState<FloorPlan['floors']>([])

  const refreshBreakState = useCallback(async () => {
    const activities = await window.dineiz.shifts.listActivities({ shiftId })
    setOnBreak(deriveOnBreak(activities))
  }, [shiftId])

  const refreshDashboardData = useCallback(async () => {
    const [orders, shiftReport, floorPlan] = await Promise.all([
      window.dineiz.orders.listActive(),
      window.dineiz.shifts.report({ shiftId }),
      window.dineiz.tables.getAll()
    ])
    setActiveOrders(orders)
    setReport(shiftReport)
    setFloors(floorPlan.floors)
  }, [shiftId])

  useEffect(() => {
    void refreshBreakState()
    void refreshDashboardData()
    const interval = setInterval(() => void refreshDashboardData(), REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [refreshBreakState, refreshDashboardData])

  useEffect(() => {
    function updateElapsed(): void {
      const ms = Date.now() - new Date(shiftOpenedAt).getTime()
      const h = Math.floor(ms / 3600000)
      const m = Math.floor((ms % 3600000) / 60000)
      setElapsed(`${h}h ${m}m`)
    }
    updateElapsed()
    const timer = setInterval(updateElapsed, 60_000)
    return () => clearInterval(timer)
  }, [shiftOpenedAt])

  async function toggleBreak(): Promise<void> {
    setBreakError(null)
    try {
      await window.dineiz.shifts.recordActivity({ shiftId, type: onBreak ? 'BREAK_END' : 'BREAK_START' })
      await refreshBreakState()
    } catch (err) {
      setBreakError(err instanceof Error ? err.message : String(err))
    }
  }

  const agingOrders = useMemo(
    () =>
      activeOrders.filter(
        (o) => (o.status === 'PENDING' || o.status === 'IN_KITCHEN') && minutesAgo(o.createdAt) >= AGING_TICKET_MINUTES
      ),
    [activeOrders]
  )
  const dirtyTables = useMemo(
    () => floors.flatMap((f) => f.tables.filter((t) => t.status === 'DIRTY')),
    [floors]
  )
  const needsAttentionCount = agingOrders.length + dirtyTables.length
  const averagePerOrder = report && report.completedOrderCount > 0 ? report.total / report.completedOrderCount : 0

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--pos-bg-base)]">
      <div className="grid flex-1 grid-cols-12 gap-5 overflow-hidden p-5">
        {/* Left column */}
        <div className="col-span-7 flex flex-col gap-5 overflow-y-auto pr-1">
          <section className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onGoToOrder}
              disabled={onBreak}
              className="flex h-32 flex-col justify-between rounded-2xl bg-[var(--pos-primary)] p-5 text-left text-white shadow-[var(--pos-primary-glow)] disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-3xl">add_shopping_cart</span>
              <span>
                <span className="clash-display block text-xl font-bold">New Order</span>
                <span className="text-xs font-semibold text-white/90">Punch a dine-in, takeaway, or delivery order</span>
              </span>
            </button>
            <button
              type="button"
              onClick={onGoToTickets}
              className="flex h-32 flex-col justify-between rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-bg-card)] p-5 text-left shadow-sm"
            >
              <span className="material-symbols-outlined text-3xl text-[var(--pos-primary)]">receipt_long</span>
              <span>
                <span className="clash-display block text-xl font-bold">
                  Tickets{activeOrders.length > 0 && <span className="ml-1.5 text-[var(--pos-primary)]">({activeOrders.length})</span>}
                </span>
                <span className="text-xs font-semibold text-[var(--pos-text-secondary)]">Held, in-kitchen, and ready orders</span>
              </span>
            </button>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="clash-display text-base font-bold">Active Orders</h3>
              <button type="button" onClick={onGoToTickets} className="text-xs font-bold text-[var(--pos-primary)]">
                View all
              </button>
            </div>
            {activeOrders.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--pos-border)] p-4 text-center text-sm text-[var(--pos-text-muted)]">
                No active orders
              </p>
            ) : (
              <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
                {activeOrders.slice(0, 12).map((order) => (
                  <button
                    key={order.id}
                    type="button"
                    onClick={onGoToTickets}
                    className="flex h-[124px] w-[168px] shrink-0 flex-col justify-between rounded-xl border border-[var(--pos-border)] bg-[var(--pos-bg-card)] p-3 text-left shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="font-mono text-sm font-bold">{order.orderNumber.slice(-7)}</span>
                      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${STATUS_COLOR[order.status]}`}>
                        {STATUS_LABEL[order.status]}
                      </span>
                    </div>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--pos-text-muted)]">
                      {order.type.replace('_', ' ')}
                      {order.tableLabel ? ` · ${order.tableLabel}` : ''}
                    </div>
                    <div className="flex items-end justify-between border-t border-[var(--pos-border)] pt-1.5">
                      <span className="font-mono text-sm font-bold text-[var(--pos-price)]">{PosLogic.formatPKR(order.total)}</span>
                      <span className="text-[10px] text-[var(--pos-text-muted)]">{minutesAgo(order.createdAt)}m ago</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="clash-display mb-2 text-base font-bold">Needs Attention</h3>
            {needsAttentionCount === 0 ? (
              <div className="flex items-center gap-2 rounded-xl border border-[var(--pos-green)]/30 bg-[var(--pos-green)]/10 p-3 text-sm font-semibold text-[var(--pos-green)]">
                <span className="material-symbols-outlined text-lg">check_circle</span>
                All clear — nothing waiting on you.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {agingOrders.map((order) => (
                  <button
                    key={order.id}
                    type="button"
                    onClick={onGoToTickets}
                    className="flex items-center justify-between rounded-xl border border-[var(--pos-yellow)]/40 bg-[var(--pos-yellow)]/10 p-3 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-[var(--pos-yellow)]">schedule</span>
                      <div>
                        <p className="text-sm font-bold">
                          {order.orderNumber} has been waiting {minutesAgo(order.createdAt)}m
                        </p>
                        <p className="text-xs text-[var(--pos-text-muted)]">
                          {order.tableLabel ?? order.type.replace('_', ' ')} · still{' '}
                          {order.status === 'PENDING' ? 'not sent to kitchen' : 'in the kitchen'}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wide text-[var(--pos-yellow)]">View</span>
                  </button>
                ))}
                {dirtyTables.map((table) => (
                  <div
                    key={table.id}
                    className="flex items-center justify-between rounded-xl border border-[var(--pos-yellow)]/40 bg-[var(--pos-yellow)]/10 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-[var(--pos-yellow)]">table_restaurant</span>
                      <div>
                        <p className="text-sm font-bold">{table.label} needs resetting</p>
                        <p className="text-xs text-[var(--pos-text-muted)]">Marked dirty after its last order</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right column */}
        <div className="col-span-5 flex flex-col gap-5 overflow-y-auto pl-1">
          <section className="rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-bg-card)] p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--pos-text-muted)]">Your Shift</p>
            <div className="mt-1 flex items-center gap-2">
              <h2 className="clash-display text-2xl font-bold">{userName}</h2>
              {onBreak && (
                <span className="rounded-full bg-[var(--pos-yellow)]/15 px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--pos-yellow)]">
                  On break
                </span>
              )}
            </div>
            <p className="text-xs uppercase tracking-wide text-[var(--pos-text-muted)]">{role}</p>
            <div className="mt-4 flex items-center gap-2 text-[var(--pos-primary)]">
              <span className="material-symbols-outlined">schedule</span>
              <span className="clash-display text-lg font-bold">Elapsed: {elapsed}</span>
            </div>

            {breakError && <p className="mt-2 text-xs text-[var(--pos-red)]">{breakError}</p>}

            <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--pos-border)] pt-4">
              <button
                type="button"
                onClick={toggleBreak}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-[var(--pos-border-strong)] px-3 text-xs font-semibold text-[var(--pos-text-secondary)]"
              >
                <span className="material-symbols-outlined text-base">{onBreak ? 'play_circle' : 'pause_circle'}</span>
                {onBreak ? 'End break' : 'Take a break'}
              </button>
              <button
                type="button"
                onClick={() => setShowCashMovement(true)}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-[var(--pos-border-strong)] px-3 text-xs font-semibold text-[var(--pos-text-secondary)]"
              >
                <span className="material-symbols-outlined text-base">payments</span>
                Cash in / out
              </button>
              <button
                type="button"
                onClick={() => setShowCloseShift(true)}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-[var(--pos-red)] px-3 text-xs font-semibold text-[var(--pos-red)]"
              >
                <span className="material-symbols-outlined text-base">logout</span>
                Close shift
              </button>
            </div>
          </section>

          <section>
            <h3 className="clash-display mb-2 text-base font-bold">Today&apos;s Performance</h3>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between rounded-xl border border-[var(--pos-border)] bg-[var(--pos-bg-card)] p-3.5 shadow-sm">
                <span className="text-sm font-semibold text-[var(--pos-text-secondary)]">Orders served</span>
                <span className="clash-display text-2xl font-bold">{report?.completedOrderCount ?? 0}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-[var(--pos-border)] bg-[var(--pos-bg-card)] p-3.5 shadow-sm">
                <span className="text-sm font-semibold text-[var(--pos-text-secondary)]">Total value</span>
                <span className="clash-display text-xl font-bold">{PosLogic.formatPKR(report?.total ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-[var(--pos-border)] bg-[var(--pos-bg-card)] p-3.5 shadow-sm">
                <span className="text-sm font-semibold text-[var(--pos-text-secondary)]">Average per order</span>
                <span className="clash-display text-xl font-bold">{PosLogic.formatPKR(averagePerOrder)}</span>
              </div>
            </div>
          </section>

          <section className="flex min-h-0 flex-1 flex-col">
            <h3 className="clash-display mb-2 text-base font-bold">Table Overview</h3>
            <div className="flex-1 overflow-y-auto rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-bg-card)] p-4 shadow-sm">
              {floors.every((f) => f.tables.length === 0) ? (
                <div className="flex h-full flex-col items-center justify-center gap-1.5 text-center text-[var(--pos-text-muted)]">
                  <span className="material-symbols-outlined text-3xl">table_restaurant</span>
                  <p className="text-sm font-medium">No tables set up yet</p>
                </div>
              ) : (
                floors.map(
                  (floor) =>
                    floor.tables.length > 0 && (
                      <div key={floor.id} className="mb-3 last:mb-0">
                        {floors.length > 1 && (
                          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--pos-text-muted)]">
                            {floor.name}
                          </p>
                        )}
                        <div className="grid grid-cols-6 gap-3">
                          {floor.tables.map((table) => (
                            <div key={table.id} className="flex flex-col items-center gap-1">
                              <span className={`h-3 w-3 rounded-full ${TABLE_DOT_COLOR[table.status]}`} />
                              <span className="text-[10px] font-bold">{table.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                )
              )}
            </div>
          </section>
        </div>
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
