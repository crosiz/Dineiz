import type Database from 'better-sqlite3'
import { buildShiftReportData } from '../services/shifts.service'
import type { ReportData } from './types'

export type { ReportData, ReportColumn, ReportColumnFormat, ReportSection } from './types'

export interface DateRange {
  /** Inclusive, 'YYYY-MM-DD'. */
  startDate: string
  /** Inclusive, 'YYYY-MM-DD'. */
  endDate: string
}

export type ReportRequest =
  | ({ kind: 'DAILY_SALES' } & DateRange)
  | { kind: 'SHIFT'; shiftId: string }
  | ({ kind: 'TAX' } & DateRange)
  | ({ kind: 'MENU_PERFORMANCE' } & DateRange)
  | ({ kind: 'STAFF' } & DateRange)
  | ({ kind: 'VOID_DISCOUNT' } & DateRange)

function nowIso(): string {
  return new Date().toISOString()
}

// ── Daily Sales ──────────────────────────────────────────────────────────────

export function buildDailySalesReport(db: Database.Database, range: DateRange): ReportData {
  const rows = db
    .prepare(
      `SELECT
         date(completed_at) AS day,
         COUNT(*) AS order_count,
         SUM(subtotal) AS subtotal,
         SUM(discount_amount) AS discount_amount,
         SUM(tax_amount) AS tax_amount,
         SUM(total) AS total
       FROM orders
       WHERE status = 'COMPLETED' AND date(completed_at) BETWEEN ? AND ?
       GROUP BY date(completed_at)
       ORDER BY day`
    )
    .all(range.startDate, range.endDate) as {
    day: string
    order_count: number
    subtotal: number
    discount_amount: number
    tax_amount: number
    total: number
  }[]

  const totals = rows.reduce(
    (acc, r) => ({
      order_count: acc.order_count + r.order_count,
      subtotal: acc.subtotal + r.subtotal,
      discount_amount: acc.discount_amount + r.discount_amount,
      tax_amount: acc.tax_amount + r.tax_amount,
      total: acc.total + r.total
    }),
    { order_count: 0, subtotal: 0, discount_amount: 0, tax_amount: 0, total: 0 }
  )

  return {
    title: 'Daily Sales Report',
    subtitle: `${range.startDate} to ${range.endDate}`,
    generatedAt: nowIso(),
    sections: [
      {
        columns: [
          { key: 'day', label: 'Date' },
          { key: 'order_count', label: 'Orders', format: 'number' },
          { key: 'subtotal', label: 'Subtotal', format: 'currency' },
          { key: 'discount_amount', label: 'Discount', format: 'currency' },
          { key: 'tax_amount', label: 'Tax', format: 'currency' },
          { key: 'total', label: 'Total', format: 'currency' }
        ],
        rows,
        summaryRow: { day: 'TOTAL', ...totals }
      }
    ]
  }
}

// ── Shift Report (reshapes Phase 8's buildShiftReportData) ──────────────────

export function buildShiftReportExport(db: Database.Database, shiftId: string): ReportData {
  const shift = buildShiftReportData(db, shiftId)

  return {
    title: 'Shift Report',
    subtitle: `${shift.cashierName} — opened ${new Date(shift.openedAt).toLocaleString('en-PK')}`,
    generatedAt: nowIso(),
    sections: [
      {
        title: 'Summary',
        columns: [
          { key: 'label', label: 'Item' },
          { key: 'value', label: 'Amount', format: 'currency' }
        ],
        rows: [
          { label: 'Opening float', value: shift.openingFloat },
          { label: 'Cash sales', value: shift.cashSales },
          { label: 'Cash in', value: shift.cashIn },
          { label: 'Cash out', value: shift.cashOut },
          { label: 'Expected cash', value: shift.expectedCash ?? 0 },
          ...(shift.closingFloat !== null ? [{ label: 'Counted cash', value: shift.closingFloat }] : []),
          ...(shift.variance !== null ? [{ label: 'Variance', value: shift.variance }] : []),
          { label: 'Completed orders', value: shift.completedOrderCount },
          { label: 'Voided orders', value: shift.voidedOrderCount },
          { label: 'Total sales', value: shift.total }
        ]
      },
      {
        title: 'Payment breakdown',
        columns: [
          { key: 'method', label: 'Method' },
          { key: 'count', label: 'Orders', format: 'number' },
          { key: 'total', label: 'Total', format: 'currency' }
        ],
        rows: shift.paymentBreakdown.map((b) => ({ method: b.method, count: b.count, total: b.total }))
      }
    ]
  }
}

// ── Tax Report ───────────────────────────────────────────────────────────────

export function buildTaxReport(db: Database.Database, range: DateRange): ReportData {
  const rows = db
    .prepare(
      `SELECT
         tax_rate AS rate_percent,
         COUNT(*) AS order_count,
         SUM(subtotal - discount_amount) AS taxable_amount,
         SUM(tax_amount) AS tax_collected
       FROM orders
       WHERE status = 'COMPLETED' AND date(completed_at) BETWEEN ? AND ?
       GROUP BY tax_rate
       ORDER BY tax_rate`
    )
    .all(range.startDate, range.endDate) as {
    rate_percent: number
    order_count: number
    taxable_amount: number
    tax_collected: number
  }[]

  const totals = rows.reduce(
    (acc, r) => ({
      order_count: acc.order_count + r.order_count,
      taxable_amount: acc.taxable_amount + r.taxable_amount,
      tax_collected: acc.tax_collected + r.tax_collected
    }),
    { order_count: 0, taxable_amount: 0, tax_collected: 0 }
  )

  return {
    title: 'Tax Report',
    subtitle: `${range.startDate} to ${range.endDate}`,
    generatedAt: nowIso(),
    sections: [
      {
        columns: [
          { key: 'rate_percent', label: 'Tax rate', format: 'percent' },
          { key: 'order_count', label: 'Orders', format: 'number' },
          { key: 'taxable_amount', label: 'Taxable amount', format: 'currency' },
          { key: 'tax_collected', label: 'Tax collected', format: 'currency' }
        ],
        rows,
        summaryRow: { rate_percent: '', order_count: totals.order_count, taxable_amount: totals.taxable_amount, tax_collected: totals.tax_collected }
      }
    ]
  }
}

// ── Menu Performance ─────────────────────────────────────────────────────────

export function buildMenuPerformanceReport(db: Database.Database, range: DateRange): ReportData {
  const rows = db
    .prepare(
      `SELECT
         i.name AS item_name,
         c.name AS category_name,
         SUM(oi.quantity) AS quantity_sold,
         SUM(oi.unit_price * oi.quantity) AS revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN items i ON i.id = oi.item_id
       JOIN categories c ON c.id = i.category_id
       WHERE o.status = 'COMPLETED' AND date(o.completed_at) BETWEEN ? AND ?
       GROUP BY oi.item_id
       ORDER BY revenue DESC`
    )
    .all(range.startDate, range.endDate) as {
    item_name: string
    category_name: string
    quantity_sold: number
    revenue: number
  }[]

  const totals = rows.reduce(
    (acc, r) => ({ quantity_sold: acc.quantity_sold + r.quantity_sold, revenue: acc.revenue + r.revenue }),
    { quantity_sold: 0, revenue: 0 }
  )

  return {
    title: 'Menu Performance Report',
    subtitle: `${range.startDate} to ${range.endDate}`,
    generatedAt: nowIso(),
    sections: [
      {
        columns: [
          { key: 'item_name', label: 'Item' },
          { key: 'category_name', label: 'Category' },
          { key: 'quantity_sold', label: 'Qty sold', format: 'number' },
          { key: 'revenue', label: 'Revenue', format: 'currency' }
        ],
        rows,
        summaryRow: { item_name: 'TOTAL', category_name: '', ...totals }
      }
    ]
  }
}

// ── Staff Report ─────────────────────────────────────────────────────────────

export function buildStaffReport(db: Database.Database, range: DateRange): ReportData {
  const rows = db
    .prepare(
      `SELECT
         u.name AS staff_name,
         COUNT(*) AS order_count,
         SUM(o.total) AS total_sales
       FROM orders o
       JOIN users u ON u.id = o.cashier_id
       WHERE o.status = 'COMPLETED' AND date(o.completed_at) BETWEEN ? AND ?
       GROUP BY o.cashier_id
       ORDER BY total_sales DESC`
    )
    .all(range.startDate, range.endDate) as { staff_name: string; order_count: number; total_sales: number }[]

  const withAverage = rows.map((r) => ({
    ...r,
    average_order: r.order_count > 0 ? Math.round(r.total_sales / r.order_count) : 0
  }))

  const totals = withAverage.reduce(
    (acc, r) => ({ order_count: acc.order_count + r.order_count, total_sales: acc.total_sales + r.total_sales }),
    { order_count: 0, total_sales: 0 }
  )

  return {
    title: 'Staff Report',
    subtitle: `${range.startDate} to ${range.endDate}`,
    generatedAt: nowIso(),
    sections: [
      {
        columns: [
          { key: 'staff_name', label: 'Staff' },
          { key: 'order_count', label: 'Orders', format: 'number' },
          { key: 'total_sales', label: 'Total sales', format: 'currency' },
          { key: 'average_order', label: 'Avg order', format: 'currency' }
        ],
        rows: withAverage,
        summaryRow: {
          staff_name: 'TOTAL',
          order_count: totals.order_count,
          total_sales: totals.total_sales,
          average_order: totals.order_count > 0 ? Math.round(totals.total_sales / totals.order_count) : 0
        }
      }
    ]
  }
}

// ── Void & Discount Report ───────────────────────────────────────────────────

export function buildVoidDiscountReport(db: Database.Database, range: DateRange): ReportData {
  const voidRows = db
    .prepare(
      `SELECT
         a.created_at AS voided_at,
         a.action,
         u.name AS voided_by,
         COALESCE(json_extract(a.details_json, '$.orderNumber'), a.entity_id) AS order_reference,
         COALESCE(json_extract(a.details_json, '$.reason'), '') AS reason
       FROM audit_log a
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.action IN ('ORDER_VOIDED', 'ORDER_ITEM_VOIDED') AND date(a.created_at) BETWEEN ? AND ?
       ORDER BY a.created_at`
    )
    .all(range.startDate, range.endDate) as {
    voided_at: string
    action: string
    voided_by: string | null
    order_reference: string
    reason: string
  }[]

  const discountRows = db
    .prepare(
      `SELECT order_number, completed_at, subtotal, discount_amount
       FROM orders
       WHERE status = 'COMPLETED' AND discount_amount > 0 AND date(completed_at) BETWEEN ? AND ?
       ORDER BY completed_at`
    )
    .all(range.startDate, range.endDate) as {
    order_number: string
    completed_at: string
    subtotal: number
    discount_amount: number
  }[]

  const discountTotal = discountRows.reduce((sum, r) => sum + r.discount_amount, 0)

  return {
    title: 'Void & Discount Report',
    subtitle: `${range.startDate} to ${range.endDate}`,
    generatedAt: nowIso(),
    sections: [
      {
        title: 'Voided orders/items',
        columns: [
          { key: 'voided_at', label: 'When' },
          { key: 'action', label: 'Type' },
          { key: 'order_reference', label: 'Order' },
          { key: 'voided_by', label: 'Voided by' },
          { key: 'reason', label: 'Reason' }
        ],
        rows: voidRows.map((r) => ({ ...r, voided_by: r.voided_by ?? 'Unknown' }))
      },
      {
        title: 'Discounts applied',
        columns: [
          { key: 'order_number', label: 'Order' },
          { key: 'completed_at', label: 'When' },
          { key: 'subtotal', label: 'Subtotal', format: 'currency' },
          { key: 'discount_amount', label: 'Discount', format: 'currency' }
        ],
        rows: discountRows,
        summaryRow: { order_number: 'TOTAL', completed_at: '', subtotal: '', discount_amount: discountTotal }
      }
    ]
  }
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

export function generateReportData(db: Database.Database, request: ReportRequest): ReportData {
  switch (request.kind) {
    case 'DAILY_SALES':
      return buildDailySalesReport(db, request)
    case 'SHIFT':
      return buildShiftReportExport(db, request.shiftId)
    case 'TAX':
      return buildTaxReport(db, request)
    case 'MENU_PERFORMANCE':
      return buildMenuPerformanceReport(db, request)
    case 'STAFF':
      return buildStaffReport(db, request)
    case 'VOID_DISCOUNT':
      return buildVoidDiscountReport(db, request)
  }
}
