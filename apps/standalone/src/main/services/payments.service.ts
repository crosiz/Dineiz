import type Database from 'better-sqlite3'
import { computeDiscountAmount, computeOrderTotals, type Discount, type PaymentMethod } from '@dineiz/pos-logic'
import { newId } from '../lib/ids'
import { enqueueReceiptForOrder } from '../printing/autoprint'
import { getOrder, getRestaurantRow, maybeFreeTable, taxConfigFromRestaurant, type OrderSummary } from './orders.service'

export interface CollectPaymentInput {
  orderId: string
  paymentMethod: PaymentMethod
  /** Required for CASH — validated against the freshly-computed total, never trusted as the total itself. */
  tenderedAmount?: number
  /** Only when a discount is being applied/changed at checkout; omit to keep the order's existing discount. */
  discount?: Discount | null
}

export interface CollectPaymentResult {
  paymentId: string
  order: OrderSummary
  changeGiven: number
}

/**
 * The authoritative money-handling step: reloads order items and the current
 * tax config fresh from SQLite and recomputes everything via the same
 * canonical computeOrderTotals used everywhere else — never trusts a total
 * the renderer sent over IPC. This is standalone's equivalent of "the server
 * always recalculates," with no server involved.
 */
export function collectPayment(db: Database.Database, input: CollectPaymentInput): CollectPaymentResult {
  const order = getOrder(db, input.orderId)
  if (!order) throw new Error('Order not found')
  if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
    throw new Error(`Cannot collect payment on an order that is already ${order.status}`)
  }
  if (order.items.length === 0) throw new Error('Cannot charge an order with no items')

  const subtotal = order.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0)
  const restaurant = getRestaurantRow(db)
  const discountAmount =
    input.discount !== undefined
      ? computeDiscountAmount(subtotal, input.discount, restaurant.tax_rounding_method)
      : order.discountAmount
  const totals = computeOrderTotals(subtotal, discountAmount, input.paymentMethod, taxConfigFromRestaurant(restaurant))

  if (input.paymentMethod === 'CASH') {
    if (input.tenderedAmount === undefined || input.tenderedAmount < totals.total) {
      throw new Error('Cash tendered must be at least the total due')
    }
  }
  const changeGiven =
    input.paymentMethod === 'CASH' ? Math.round((input.tenderedAmount ?? 0) - totals.total) : 0

  const paymentId = newId()

  db.transaction(() => {
    db.prepare(
      `UPDATE orders SET
         subtotal = ?, tax_rate = ?, tax_amount = ?, discount_amount = ?, total = ?,
         status = 'COMPLETED', updated_at = datetime('now'), completed_at = datetime('now')
       WHERE id = ?`
    ).run(totals.subtotal, totals.taxRatePercent, totals.taxAmount, totals.discountAmount, totals.total, input.orderId)

    db.prepare(
      `INSERT INTO payments (id, order_id, method, amount, tendered_amount, change_amount, tax_rate)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      paymentId,
      input.orderId,
      input.paymentMethod,
      totals.total,
      input.tenderedAmount ?? null,
      changeGiven,
      totals.taxRatePercent
    )

    if (order.tableId) maybeFreeTable(db, order.tableId)
  })()

  const updatedOrder = getOrder(db, input.orderId)
  if (!updatedOrder) throw new Error('Order disappeared immediately after payment — this should never happen')

  enqueueReceiptForOrder(db, input.orderId, true)

  return { paymentId, order: updatedOrder, changeGiven }
}
