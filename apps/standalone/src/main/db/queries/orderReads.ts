import type Database from 'better-sqlite3'
import type { OrderStatus, OrderType } from '@dineiz/pos-logic'

/**
 * Read-only order queries, split out from orders.service.ts so that
 * printing/receiptData.ts can depend on them without creating a cycle
 * (orders.service.ts -> printing/autoprint.ts -> receiptData.ts would
 * otherwise need to import back from orders.service.ts). orders.service.ts
 * re-exports everything here under its original names — no call site
 * elsewhere needed to change.
 */

export interface OrderItemSummary {
  id: string
  itemId: string
  variationId: string | null
  name: string
  unitPrice: number
  quantity: number
  addons: { id: string; name: string; price: number }[]
  notes: string | null
}

export interface OrderSummary {
  id: string
  orderNumber: string
  type: OrderType
  status: OrderStatus
  tableId: string | null
  tableLabel: string | null
  cashierId: string
  subtotal: number
  taxRatePercent: number
  taxAmount: number
  discountAmount: number
  total: number
  notes: string | null
  createdAt: string
  items: OrderItemSummary[]
}

interface OrderRowWithTable {
  id: string
  order_number: string
  type: OrderType
  status: OrderStatus
  table_id: string | null
  cashier_id: string
  subtotal: number
  tax_rate: number
  tax_amount: number
  discount_amount: number
  total: number
  notes: string | null
  created_at: string
  table_label: string | null
}

function toSummary(db: Database.Database, o: OrderRowWithTable): OrderSummary {
  const items = db
    .prepare(
      'SELECT id, item_id, variation_id, name, unit_price, quantity, addons_json, notes FROM order_items WHERE order_id = ?'
    )
    .all(o.id) as {
    id: string
    item_id: string
    variation_id: string | null
    name: string
    unit_price: number
    quantity: number
    addons_json: string
    notes: string | null
  }[]

  return {
    id: o.id,
    orderNumber: o.order_number,
    type: o.type,
    status: o.status,
    tableId: o.table_id,
    tableLabel: o.table_label,
    cashierId: o.cashier_id,
    subtotal: o.subtotal,
    taxRatePercent: o.tax_rate,
    taxAmount: o.tax_amount,
    discountAmount: o.discount_amount,
    total: o.total,
    notes: o.notes,
    createdAt: o.created_at,
    items: items.map((i) => ({
      id: i.id,
      itemId: i.item_id,
      variationId: i.variation_id,
      name: i.name,
      unitPrice: i.unit_price,
      quantity: i.quantity,
      addons: JSON.parse(i.addons_json) as { id: string; name: string; price: number }[],
      notes: i.notes
    }))
  }
}

export function listActive(db: Database.Database): OrderSummary[] {
  const rows = db
    .prepare(
      `SELECT o.*, t.label AS table_label
       FROM orders o LEFT JOIN tables t ON t.id = o.table_id
       WHERE o.status IN ('PENDING', 'IN_KITCHEN', 'READY')
       ORDER BY o.created_at`
    )
    .all() as OrderRowWithTable[]
  return rows.map((o) => toSummary(db, o))
}

export function getOrder(db: Database.Database, id: string): OrderSummary | null {
  const row = db
    .prepare(`SELECT o.*, t.label AS table_label FROM orders o LEFT JOIN tables t ON t.id = o.table_id WHERE o.id = ?`)
    .get(id) as OrderRowWithTable | undefined
  return row ? toSummary(db, row) : null
}
