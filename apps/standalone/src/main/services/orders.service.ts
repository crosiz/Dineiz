import type Database from 'better-sqlite3'
import {
  computeDiscountAmount,
  computeLineSubtotal,
  computeOrderTotals,
  computeUnitPrice,
  type Discount,
  type OrderStatus,
  type OrderType,
  type PaymentMethod,
  type RoundingMethod,
  type TaxConfig
} from '@dineiz/pos-logic'
import { newId } from '../lib/ids'
import { enqueueCancellationKotForVoidedItem, enqueueKotForOrder } from '../printing/autoprint'

export { getOrder, listActive, type OrderItemSummary, type OrderSummary } from '../db/queries/orderReads'

// ── Shared row/type helpers ──────────────────────────────────────────────

export interface RestaurantRow {
  cash_tax_rate: number
  card_tax_rate: number
  cash_tax_enabled: number
  card_tax_enabled: number
  tax_rounding_method: RoundingMethod
  void_requires_manager_approval: number
}

/** Exported so payments.service.ts (Phase 6) can price a payment with the same fresh config, never a client-sent one. */
export function getRestaurantRow(db: Database.Database): RestaurantRow {
  const row = db
    .prepare(
      'SELECT cash_tax_rate, card_tax_rate, cash_tax_enabled, card_tax_enabled, tax_rounding_method, void_requires_manager_approval FROM restaurant LIMIT 1'
    )
    .get() as RestaurantRow | undefined
  if (!row) throw new Error('Restaurant is not set up yet')
  return row
}

export function taxConfigFromRestaurant(r: RestaurantRow): TaxConfig {
  return {
    cashTaxRatePercent: r.cash_tax_rate,
    cardTaxRatePercent: r.card_tax_rate,
    cashTaxEnabled: Boolean(r.cash_tax_enabled),
    cardTaxEnabled: Boolean(r.card_tax_enabled),
    roundingMethod: r.tax_rounding_method
  }
}

interface OrderRow {
  id: string
  order_number: string
  type: OrderType
  status: OrderStatus
  table_id: string | null
  customer_id: string | null
  shift_id: string
  cashier_id: string
  subtotal: number
  tax_rate: number
  tax_amount: number
  discount_amount: number
  total: number
  notes: string | null
  created_at: string
}

function getOrderRow(db: Database.Database, id: string): OrderRow | undefined {
  return db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as OrderRow | undefined
}

function requireOrderRow(db: Database.Database, id: string): OrderRow {
  const row = getOrderRow(db, id)
  if (!row) throw new Error('Order not found')
  return row
}

/** Frees a table only if no other order still holds it active. Exported for Phase 6 (payment completion) to reuse. */
export function maybeFreeTable(db: Database.Database, tableId: string): void {
  const activeCount = db
    .prepare(
      "SELECT COUNT(*) AS n FROM orders WHERE table_id = ? AND status IN ('PENDING','IN_KITCHEN','READY')"
    )
    .get(tableId) as { n: number }
  if (activeCount.n === 0) {
    db.prepare("UPDATE tables SET status = 'FREE' WHERE id = ?").run(tableId)
  }
}

function generateOrderNumber(db: Database.Database): string {
  const now = new Date()
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const countRow = db
    .prepare('SELECT COUNT(*) AS n FROM orders WHERE order_number LIKE ?')
    .get(`ORD-${datePart}-%`) as { n: number }
  return `ORD-${datePart}-${String(countRow.n + 1).padStart(3, '0')}`
}

// ── Create order ──────────────────────────────────────────────────────────

export interface CartLineInput {
  itemId: string
  variationId?: string | null
  addOnIds?: string[]
  quantity: number
  notes?: string
}

export interface CreateOrderInput {
  type: OrderType
  tableId?: string | null
  customerId?: string | null
  cashierId: string
  shiftId: string
  lines: CartLineInput[]
  discount?: Discount | null
  notes?: string
}

export interface CreateOrderResult {
  id: string
  orderNumber: string
}

interface ResolvedLine {
  itemId: string
  variationId: string | null
  name: string
  unitPrice: number
  subtotal: number
  quantity: number
  addons: { id: string; name: string; price: number }[]
  notes?: string
}

function resolveLine(db: Database.Database, line: CartLineInput): ResolvedLine {
  if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
    throw new Error('Quantity must be a positive number')
  }

  const item = db.prepare('SELECT id, name, price FROM items WHERE id = ?').get(line.itemId) as
    | { id: string; name: string; price: number }
    | undefined
  if (!item) throw new Error('Item not found')

  let variation: { id: string; name: string; price: number } | null = null
  if (line.variationId) {
    const row = db
      .prepare('SELECT id, name, price FROM variations WHERE id = ? AND item_id = ?')
      .get(line.variationId, line.itemId) as { id: string; name: string; price: number } | undefined
    if (!row) throw new Error('Variation not found for this item')
    variation = row
  }

  const addons = (line.addOnIds ?? []).map((addOnId) => {
    const addon = db
      .prepare('SELECT id, name, price FROM addons WHERE id = ? AND item_id = ?')
      .get(addOnId, line.itemId) as { id: string; name: string; price: number } | undefined
    if (!addon) throw new Error('Add-on not found for this item')
    return addon
  })

  const cartLine = {
    itemId: item.id,
    name: variation ? `${item.name} (${variation.name})` : item.name,
    basePrice: item.price,
    quantity: line.quantity,
    variation,
    addOns: addons
  }

  return {
    itemId: item.id,
    variationId: variation?.id ?? null,
    name: cartLine.name,
    unitPrice: computeUnitPrice(cartLine),
    subtotal: computeLineSubtotal(cartLine),
    quantity: line.quantity,
    addons,
    notes: line.notes
  }
}

/** Provisional total only — always priced at the CASH rate until a real payment method is chosen (Phase 6). */
export function createOrder(db: Database.Database, input: CreateOrderInput): CreateOrderResult {
  if (input.lines.length === 0) throw new Error('An order needs at least one item')

  const resolvedLines = input.lines.map((line) => resolveLine(db, line))
  const subtotal = resolvedLines.reduce((sum, l) => sum + l.subtotal, 0)
  const restaurant = getRestaurantRow(db)
  const discountAmount = computeDiscountAmount(subtotal, input.discount ?? null, restaurant.tax_rounding_method)
  const totals = computeOrderTotals(subtotal, discountAmount, 'CASH', taxConfigFromRestaurant(restaurant))

  const orderId = newId()

  const orderNumber = db.transaction(() => {
    const number = generateOrderNumber(db)

    db.prepare(
      `INSERT INTO orders
         (id, order_number, type, status, table_id, customer_id, shift_id, cashier_id,
          subtotal, tax_rate, tax_amount, discount_amount, total, notes)
       VALUES (?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      orderId,
      number,
      input.type,
      input.tableId ?? null,
      input.customerId ?? null,
      input.shiftId,
      input.cashierId,
      totals.subtotal,
      totals.taxRatePercent,
      totals.taxAmount,
      totals.discountAmount,
      totals.total,
      input.notes ?? null
    )

    const insertLine = db.prepare(
      `INSERT INTO order_items (id, order_id, item_id, variation_id, name, unit_price, quantity, addons_json, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    for (const line of resolvedLines) {
      insertLine.run(
        newId(),
        orderId,
        line.itemId,
        line.variationId,
        line.name,
        line.unitPrice,
        line.quantity,
        JSON.stringify(line.addons),
        line.notes ?? null
      )
    }

    if (input.type === 'DINE_IN' && input.tableId) {
      db.prepare("UPDATE tables SET status = 'OCCUPIED' WHERE id = ?").run(input.tableId)
    }

    return number
  })()

  return { id: orderId, orderNumber }
}

// ── Status transitions ───────────────────────────────────────────────────

export function sendToKitchen(db: Database.Database, orderId: string): void {
  const order = requireOrderRow(db, orderId)
  if (order.status !== 'PENDING') {
    throw new Error(`Cannot send to kitchen from status ${order.status}`)
  }
  db.prepare("UPDATE orders SET status = 'IN_KITCHEN', updated_at = datetime('now') WHERE id = ?").run(orderId)
  enqueueKotForOrder(db, orderId)
}

export function markReady(db: Database.Database, orderId: string): void {
  const order = requireOrderRow(db, orderId)
  if (order.status !== 'IN_KITCHEN') {
    throw new Error(`Cannot mark ready from status ${order.status}`)
  }
  db.prepare("UPDATE orders SET status = 'READY', updated_at = datetime('now') WHERE id = ?").run(orderId)
}

export function voidOrder(db: Database.Database, orderId: string, reason: string, userId: string): void {
  const order = requireOrderRow(db, orderId)
  if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
    throw new Error(`Cannot void an order that is already ${order.status}`)
  }

  db.transaction(() => {
    db.prepare("UPDATE orders SET status = 'CANCELLED', updated_at = datetime('now') WHERE id = ?").run(orderId)
    if (order.table_id) maybeFreeTable(db, order.table_id)
    db.prepare(
      `INSERT INTO audit_log (id, user_id, action, entity_type, entity_id, details_json)
       VALUES (?, ?, 'ORDER_VOIDED', 'order', ?, ?)`
    ).run(newId(), userId, orderId, JSON.stringify({ reason, orderNumber: order.order_number }))
  })()
}

function recomputeOrderTotals(db: Database.Database, orderId: string): void {
  const order = requireOrderRow(db, orderId)
  const lines = db.prepare('SELECT unit_price, quantity FROM order_items WHERE order_id = ?').all(orderId) as {
    unit_price: number
    quantity: number
  }[]
  const subtotal = lines.reduce((sum, l) => sum + l.unit_price * l.quantity, 0)
  const restaurant = getRestaurantRow(db)
  const totals = computeOrderTotals(
    subtotal,
    order.discount_amount,
    'CASH' as PaymentMethod,
    taxConfigFromRestaurant(restaurant)
  )
  db.prepare(
    `UPDATE orders SET subtotal = ?, tax_rate = ?, tax_amount = ?, total = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(totals.subtotal, totals.taxRatePercent, totals.taxAmount, totals.total, orderId)
}

export function voidOrderItem(
  db: Database.Database,
  orderId: string,
  orderItemId: string,
  reason: string,
  userId: string,
  managerApproved: boolean
): void {
  const order = requireOrderRow(db, orderId)
  if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
    throw new Error(`Cannot modify an order that is already ${order.status}`)
  }
  const restaurant = getRestaurantRow(db)
  if (restaurant.void_requires_manager_approval && !managerApproved) {
    throw new Error('Manager approval is required to void an item')
  }

  const itemRow = db
    .prepare('SELECT name, quantity, addons_json FROM order_items WHERE id = ? AND order_id = ?')
    .get(orderItemId, orderId) as { name: string; quantity: number; addons_json: string } | undefined
  if (!itemRow) throw new Error('Order item not found')

  db.transaction(() => {
    db.prepare('DELETE FROM order_items WHERE id = ? AND order_id = ?').run(orderItemId, orderId)
    recomputeOrderTotals(db, orderId)
    db.prepare(
      `INSERT INTO audit_log (id, user_id, action, entity_type, entity_id, details_json)
       VALUES (?, ?, 'ORDER_ITEM_VOIDED', 'order_item', ?, ?)`
    ).run(newId(), userId, orderItemId, JSON.stringify({ orderId, reason }))
  })()

  // A PENDING order was never sent to the kitchen, so there's nothing there to cancel.
  if (order.status !== 'PENDING') {
    const cashier = db.prepare('SELECT name FROM users WHERE id = ?').get(userId) as { name: string } | undefined
    const addons = JSON.parse(itemRow.addons_json) as { name: string }[]
    enqueueCancellationKotForVoidedItem(
      db,
      orderId,
      { name: itemRow.name, quantity: itemRow.quantity, unitPrice: 0, subtotal: 0, addOnNames: addons.map((a) => a.name) },
      reason,
      cashier?.name
    )
  }
}

// Read-only queries (getOrder, listActive, OrderSummary, OrderItemSummary)
// live in ../db/queries/orderReads.ts and are re-exported above — see that
// file's header comment for why they were split out of this one.
