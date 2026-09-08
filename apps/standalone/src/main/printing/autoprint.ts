import type Database from 'better-sqlite3'
import { buildBillDocument, buildCancellationKotDocument, buildKotDocument, type PrintItem } from '@dineiz/pos-logic'
import { getDefaultPrinter } from '../services/printers.service'
import { buildPrintOrder } from './receiptData'
import { enqueuePrintJob } from './printQueue'

/**
 * Best-effort print-job enqueueing triggered by order lifecycle events.
 * Never throws — a missing/misconfigured printer must never block the
 * underlying order/payment operation, so every function here swallows its
 * own errors (logged, not surfaced) rather than letting them propagate into
 * orders.service.ts / payments.service.ts.
 */

/**
 * Sends to kitchen normally enqueues just the KOT. When the restaurant has
 * Rush Hour Mode on (a Settings toggle — see settings.service.ts), it also
 * enqueues an itemized order ticket (the same due-bill document a "Print
 * bill" action would produce, prices and all) at the same moment, so both
 * come off the printer together: the kitchen copy to cook from, the priced
 * copy for the runner/counter to track and present without waiting for the
 * kitchen to finish — the whole point during a rush is not making the
 * front-of-house wait on the back-of-house for a ticket they need right now.
 */
export function enqueueKotForOrder(db: Database.Database, orderId: string): void {
  try {
    const printer = getDefaultPrinter(db, 'KITCHEN')
    if (!printer) return
    const printOrder = buildPrintOrder(db, orderId)
    const doc = buildKotDocument(printOrder)
    enqueuePrintJob(db, { printerId: printer.id, documentType: 'KOT', orderId, document: doc })

    const restaurant = db.prepare('SELECT rush_hour_mode FROM restaurant LIMIT 1').get() as
      | { rush_hour_mode: number }
      | undefined
    if (restaurant?.rush_hour_mode) {
      enqueueReceiptForOrder(db, orderId, false)
    }
  } catch (err) {
    console.error('[autoprint] failed to enqueue KOT', err)
  }
}

export function enqueueReceiptForOrder(db: Database.Database, orderId: string, isPaid: boolean): void {
  try {
    const printer = getDefaultPrinter(db, 'RECEIPT')
    if (!printer) return
    const printOrder = buildPrintOrder(db, orderId)
    const doc = buildBillDocument(printOrder, { isPaid })
    enqueuePrintJob(db, { printerId: printer.id, documentType: 'RECEIPT', orderId, document: doc })
  } catch (err) {
    console.error('[autoprint] failed to enqueue receipt', err)
  }
}

/** Only meaningful once an order has actually reached the kitchen — a PENDING order's void never printed a KOT in the first place. */
export function enqueueCancellationKotForVoidedItem(
  db: Database.Database,
  orderId: string,
  cancelledItem: PrintItem,
  reason: string,
  cancelledBy?: string
): void {
  try {
    const printer = getDefaultPrinter(db, 'KITCHEN')
    if (!printer) return
    const printOrder = buildPrintOrder(db, orderId)
    const doc = buildCancellationKotDocument(printOrder, cancelledItem, reason, cancelledBy)
    enqueuePrintJob(db, { printerId: printer.id, documentType: 'CANCELLATION_KOT', orderId, document: doc })
  } catch (err) {
    console.error('[autoprint] failed to enqueue cancellation KOT', err)
  }
}
