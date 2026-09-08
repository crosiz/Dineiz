import type Database from 'better-sqlite3'
import type { PaymentMethod, ShiftActivityType, ShiftStatus } from '@dineiz/pos-logic'
import { newId } from '../lib/ids'

// Minimal open-shift support, pulled forward from the full shifts phase
// (close/reconciliation/reports) because order creation has a hard FK
// dependency on shift_id — an order-punching screen genuinely cannot work
// without at least this much. Single-terminal: at most one OPEN shift at a
// time, regardless of which staff member opened it.

export interface ShiftSummary {
  id: string
  cashierId: string
  cashierName: string
  status: ShiftStatus
  openingFloat: number
  openedAt: string
}

interface ShiftRow {
  id: string
  cashier_id: string
  cashier_name: string
  status: ShiftStatus
  opening_float: number
  opened_at: string
}

function toSummary(row: ShiftRow): ShiftSummary {
  return {
    id: row.id,
    cashierId: row.cashier_id,
    cashierName: row.cashier_name,
    status: row.status,
    openingFloat: row.opening_float,
    openedAt: row.opened_at
  }
}

export function getOpenShift(db: Database.Database): ShiftSummary | null {
  const row = db
    .prepare(
      `SELECT s.id, s.cashier_id, u.name AS cashier_name, s.status, s.opening_float, s.opened_at
       FROM shifts s JOIN users u ON u.id = s.cashier_id
       WHERE s.status = 'OPEN' ORDER BY s.opened_at DESC LIMIT 1`
    )
    .get() as ShiftRow | undefined
  return row ? toSummary(row) : null
}

export function openShift(db: Database.Database, cashierId: string, openingFloat: number): ShiftSummary {
  if (getOpenShift(db)) throw new Error('A shift is already open')
  if (!Number.isFinite(openingFloat) || openingFloat < 0) {
    throw new Error('Opening float must be a non-negative number')
  }

  const id = newId()
  db.prepare("INSERT INTO shifts (id, cashier_id, status, opening_float) VALUES (?, ?, 'OPEN', ?)").run(
    id,
    cashierId,
    Math.round(openingFloat)
  )

  const shift = getOpenShift(db)
  if (!shift) throw new Error('Failed to open shift')
  return shift
}

interface RawShiftRow {
  id: string
  cashier_id: string
  status: ShiftStatus
  opening_float: number
  closing_float: number | null
  expected_cash: number | null
  variance: number | null
  opened_at: string
  closed_at: string | null
}

function requireShiftRow(db: Database.Database, shiftId: string): RawShiftRow {
  const row = db.prepare('SELECT * FROM shifts WHERE id = ?').get(shiftId) as RawShiftRow | undefined
  if (!row) throw new Error('Shift not found')
  return row
}

/** Cash sales are scoped to payments on orders belonging to this shift — never all-time or calendar-day. */
function cashMovementsForShift(db: Database.Database, shiftId: string): { cashSales: number; cashIn: number; cashOut: number } {
  const cashSales = (
    db
      .prepare(
        `SELECT COALESCE(SUM(p.amount), 0) AS total
         FROM payments p JOIN orders o ON o.id = p.order_id
         WHERE o.shift_id = ? AND p.method = 'CASH'`
      )
      .get(shiftId) as { total: number }
  ).total
  const cashIn = (
    db
      .prepare(`SELECT COALESCE(SUM(amount), 0) AS total FROM shift_activities WHERE shift_id = ? AND type = 'CASH_IN'`)
      .get(shiftId) as { total: number }
  ).total
  const cashOut = (
    db
      .prepare(`SELECT COALESCE(SUM(amount), 0) AS total FROM shift_activities WHERE shift_id = ? AND type = 'CASH_OUT'`)
      .get(shiftId) as { total: number }
  ).total
  return { cashSales, cashIn, cashOut }
}

// ── Activities (breaks, cash in/out) ────────────────────────────────────────

export interface RecordActivityInput {
  shiftId: string
  type: ShiftActivityType
  /** Required (and must be positive) for CASH_IN/CASH_OUT; ignored for breaks. */
  amount?: number
  note?: string
}

function currentBreakState(db: Database.Database, shiftId: string): 'ON_BREAK' | 'NOT_ON_BREAK' {
  const row = db
    .prepare(
      `SELECT type FROM shift_activities WHERE shift_id = ? AND type IN ('BREAK_START', 'BREAK_END')
       ORDER BY created_at DESC, rowid DESC LIMIT 1`
    )
    .get(shiftId) as { type: ShiftActivityType } | undefined
  return row?.type === 'BREAK_START' ? 'ON_BREAK' : 'NOT_ON_BREAK'
}

export function recordActivity(db: Database.Database, input: RecordActivityInput): void {
  const shift = requireShiftRow(db, input.shiftId)
  if (shift.status !== 'OPEN') throw new Error('Cannot record activity on a closed shift')

  if (input.type === 'CASH_IN' || input.type === 'CASH_OUT') {
    if (input.amount === undefined || !Number.isFinite(input.amount) || input.amount <= 0) {
      throw new Error('Cash in/out requires a positive amount')
    }
  }

  const breakState = currentBreakState(db, input.shiftId)
  if (input.type === 'BREAK_START' && breakState === 'ON_BREAK') throw new Error('Already on break')
  if (input.type === 'BREAK_END' && breakState === 'NOT_ON_BREAK') throw new Error('Not currently on break')

  db.prepare('INSERT INTO shift_activities (id, shift_id, type, amount, note) VALUES (?, ?, ?, ?, ?)').run(
    newId(),
    input.shiftId,
    input.type,
    input.amount !== undefined ? Math.round(input.amount) : null,
    input.note ?? null
  )
}

export interface ShiftActivityRow {
  id: string
  type: ShiftActivityType
  amount: number | null
  note: string | null
  createdAt: string
}

export function listActivities(db: Database.Database, shiftId: string): ShiftActivityRow[] {
  const rows = db
    .prepare('SELECT id, type, amount, note, created_at FROM shift_activities WHERE shift_id = ? ORDER BY created_at')
    .all(shiftId) as { id: string; type: ShiftActivityType; amount: number | null; note: string | null; created_at: string }[]
  return rows.map((r) => ({ id: r.id, type: r.type, amount: r.amount, note: r.note, createdAt: r.created_at }))
}

// ── Close + reconciliation ───────────────────────────────────────────────────

export interface CloseShiftInput {
  shiftId: string
  countedCash: number
}

export interface CloseShiftResult {
  shiftId: string
  expectedCash: number
  countedCash: number
  variance: number
}

export function closeShift(db: Database.Database, input: CloseShiftInput): CloseShiftResult {
  const shift = requireShiftRow(db, input.shiftId)
  if (shift.status !== 'OPEN') throw new Error('Shift is already closed')
  if (!Number.isFinite(input.countedCash) || input.countedCash < 0) {
    throw new Error('Counted cash must be a non-negative number')
  }

  const { cashSales, cashIn, cashOut } = cashMovementsForShift(db, input.shiftId)
  const expectedCash = shift.opening_float + cashSales + cashIn - cashOut
  const countedCash = Math.round(input.countedCash)
  const variance = countedCash - expectedCash

  db.prepare(
    `UPDATE shifts SET status = 'CLOSED', closing_float = ?, expected_cash = ?, variance = ?, closed_at = datetime('now')
     WHERE id = ?`
  ).run(countedCash, expectedCash, variance, input.shiftId)

  return { shiftId: input.shiftId, expectedCash, countedCash, variance }
}

// ── Reporting (shared with Phase 9's historical export) ─────────────────────

export interface ShiftReportPaymentBreakdown {
  method: PaymentMethod
  count: number
  total: number
}

export interface ShiftReportData {
  shiftId: string
  cashierName: string
  openingFloat: number
  closingFloat: number | null
  expectedCash: number | null
  variance: number | null
  openedAt: string
  closedAt: string | null
  completedOrderCount: number
  voidedOrderCount: number
  subtotal: number
  discountAmount: number
  taxAmount: number
  total: number
  paymentBreakdown: ShiftReportPaymentBreakdown[]
  cashSales: number
  cashIn: number
  cashOut: number
  activities: ShiftActivityRow[]
}

/**
 * Works for an OPEN shift too (a live reconciliation preview before closing)
 * as well as a CLOSED one (the historical record) — every figure is derived
 * fresh from orders/payments/activities, never from a cached total.
 */
export function buildShiftReportData(db: Database.Database, shiftId: string): ShiftReportData {
  const shift = db
    .prepare(
      `SELECT s.*, u.name AS cashier_name FROM shifts s JOIN users u ON u.id = s.cashier_id WHERE s.id = ?`
    )
    .get(shiftId) as (RawShiftRow & { cashier_name: string }) | undefined
  if (!shift) throw new Error('Shift not found')

  const orderTotals = db
    .prepare(
      `SELECT
         COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) AS completed_count,
         COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) AS voided_count,
         COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN subtotal END), 0) AS subtotal,
         COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN discount_amount END), 0) AS discount_amount,
         COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN tax_amount END), 0) AS tax_amount,
         COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN total END), 0) AS total
       FROM orders WHERE shift_id = ?`
    )
    .get(shiftId) as {
    completed_count: number
    voided_count: number
    subtotal: number
    discount_amount: number
    tax_amount: number
    total: number
  }

  const paymentBreakdown = db
    .prepare(
      `SELECT p.method, COUNT(*) AS count, COALESCE(SUM(p.amount), 0) AS total
       FROM payments p JOIN orders o ON o.id = p.order_id
       WHERE o.shift_id = ? GROUP BY p.method`
    )
    .all(shiftId) as { method: PaymentMethod; count: number; total: number }[]

  const { cashSales, cashIn, cashOut } = cashMovementsForShift(db, shiftId)

  return {
    shiftId,
    cashierName: shift.cashier_name,
    openingFloat: shift.opening_float,
    closingFloat: shift.closing_float,
    expectedCash: shift.expected_cash,
    variance: shift.variance,
    openedAt: shift.opened_at,
    closedAt: shift.closed_at,
    completedOrderCount: orderTotals.completed_count,
    voidedOrderCount: orderTotals.voided_count,
    subtotal: orderTotals.subtotal,
    discountAmount: orderTotals.discount_amount,
    taxAmount: orderTotals.tax_amount,
    total: orderTotals.total,
    paymentBreakdown,
    cashSales,
    cashIn,
    cashOut,
    activities: listActivities(db, shiftId)
  }
}
