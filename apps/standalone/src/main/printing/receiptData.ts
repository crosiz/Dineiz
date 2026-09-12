import type Database from 'better-sqlite3'
import type { PaymentMethod, PrintItem, PrintOrder } from '@dineiz/pos-logic'
import { getOrder } from '../db/queries/orderReads'

/** Assembles the printable view of an order from the DB — restaurant/cashier/table joined in, latest payment if paid. */
export function buildPrintOrder(db: Database.Database, orderId: string): PrintOrder {
  const order = getOrder(db, orderId)
  if (!order) throw new Error('Order not found')

  const restaurant = db
    .prepare('SELECT name, address, ntn, receipt_header, receipt_footer FROM restaurant LIMIT 1')
    .get() as {
    name: string
    address: string | null
    ntn: string | null
    receipt_header: string | null
    receipt_footer: string | null
  }
  const cashier = db.prepare('SELECT name FROM users WHERE id = ?').get(order.cashierId) as
    | { name: string }
    | undefined
  const payment = db
    .prepare(
      `SELECT method, tendered_amount, change_amount FROM payments
       WHERE order_id = ? ORDER BY created_at DESC LIMIT 1`
    )
    .get(orderId) as { method: PaymentMethod; tendered_amount: number | null; change_amount: number | null } | undefined

  const items: PrintItem[] = order.items.map((i) => ({
    name: i.name,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    subtotal: i.unitPrice * i.quantity,
    notes: i.notes ?? undefined,
    addOnNames: i.addons.map((a) => a.name)
  }))

  return {
    orderNumber: order.orderNumber,
    type: order.type,
    cashierName: cashier?.name,
    restaurantName: restaurant.name,
    restaurantAddress: restaurant.address ?? undefined,
    restaurantNtn: restaurant.ntn ?? undefined,
    receiptHeader: restaurant.receipt_header ?? undefined,
    receiptFooter: restaurant.receipt_footer ?? undefined,
    items,
    subtotal: order.subtotal,
    discountAmount: order.discountAmount,
    taxAmount: order.taxAmount,
    taxRatePercent: order.taxRatePercent,
    total: order.total,
    paymentMethod: payment?.method,
    cashTendered: payment?.tendered_amount ?? undefined,
    changeGiven: payment?.change_amount ?? undefined,
    notes: order.notes ?? undefined,
    createdAt: order.createdAt,
    tableLabel: order.tableLabel ?? undefined
  }
}
