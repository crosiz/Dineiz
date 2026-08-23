import { nanoid } from 'nanoid';
import { append, nextOrderNumber, type EventType } from './event-log';
import { useViews } from './views';
import { kickOutbox } from './outbox';

async function emit(
  type: EventType,
  aggType: 'ORDER' | 'TABLE' | 'SHIFT',
  aggId: string,
  payload: any,
  dependsOn: string[] = []
) {
  const e = await append(type, aggType, aggId, payload, dependsOn);
  useViews.getState()._applyEvent(e); // views update NOW
  kickOutbox(); // ship it — debounced, so a burst of emits in one caller only drains once
  return e;
}

// Track the last event per aggregate for dependency chaining, and to let
// the outbox (lib/core/outbox.ts) collapse a run of queued events for the
// same aggregate into one HTTP call against the existing REST endpoints —
// see outbox.ts's header comment for why it ships snapshots, not raw
// deltas, until Phase 4 adds a real event-ingestion endpoint.
const lastEventByAggregate = new Map<string, string>();
function chain(aggId: string): string[] {
  const prev = lastEventByAggregate.get(aggId);
  return prev ? [prev] : [];
}
function remember(aggId: string, eventId: string) {
  lastEventByAggregate.set(aggId, eventId);
}

export async function createOrder(input: {
  type: string;
  tableId?: string | null;
  tableLabel?: string | null;
  customerPhone?: string | null;
  notes?: string | null;
}): Promise<{ orderId: string; orderNumber: string }> {
  const shift = JSON.parse(localStorage.getItem('pos_shift') ?? '{}');
  const orderId = `ord_${nanoid(16)}`;
  const orderNumber = await nextOrderNumber(shift.shiftId ?? 'noshift');
  const e = await emit('ORDER_CREATED', 'ORDER', orderId, { orderNumber, ...input });
  remember(orderId, e.id);
  // Order number exists RIGHT NOW. No waiting. No placeholder.
  return { orderId, orderNumber };
}

export async function addItem(orderId: string, item: {
  itemId: string; itemName: string;
  variationId?: string | null; variationName?: string | null;
  qty: number; unitPrice: number; note?: string | null;
  addOns?: Array<{ id: string; name: string; price: number }> | null;
}) {
  const e = await emit('ITEM_ADDED', 'ORDER', orderId,
    { lineId: `ln_${nanoid(10)}`, ...item }, chain(orderId));
  remember(orderId, e.id);
}

export async function changeQty(orderId: string, lineId: string, qty: number) {
  const e = await emit('ITEM_QTY_CHANGED', 'ORDER', orderId, { lineId, qty }, chain(orderId));
  remember(orderId, e.id);
}

export async function removeItem(orderId: string, lineId: string) {
  const e = await emit('ITEM_REMOVED', 'ORDER', orderId, { lineId }, chain(orderId));
  remember(orderId, e.id);
}

export async function voidItem(orderId: string, lineId: string, reason: string, approverId?: string) {
  const e = await emit('ITEM_VOIDED', 'ORDER', orderId,
    { lineId, reason, approverId: approverId ?? null }, chain(orderId));
  remember(orderId, e.id);
}

export async function applyDiscount(
  orderId: string, amount: number, percent: number, reason: string, approverId?: string
) {
  const e = await emit('DISCOUNT_APPLIED', 'ORDER', orderId,
    { amount, percent, reason, approverId: approverId ?? null }, chain(orderId));
  remember(orderId, e.id);
}

export async function sendToKitchen(orderId: string) {
  const e = await emit('ORDER_SENT_TO_KITCHEN', 'ORDER', orderId, {}, chain(orderId));
  remember(orderId, e.id);
  // Caller prints the KOT immediately — order number already exists
}

export async function markKotPrinted(orderId: string) {
  const e = await emit('KOT_PRINTED', 'ORDER', orderId, {}, chain(orderId));
  remember(orderId, e.id);
}

export async function markReady(orderId: string) {
  const e = await emit('ORDER_MARKED_READY', 'ORDER', orderId, {}, chain(orderId));
  remember(orderId, e.id);
}

export async function collectPayment(orderId: string, p: {
  method: string; total: number; cashReceived?: number;
  change?: number; taxRate?: number; taxAmount?: number;
  transactionRef?: string | null;
  // Only set for a SPLIT payment (multiple methods in one checkout) —
  // carried through to the server as-is instead of collapsing to one line.
  payments?: Array<{ method: string; amount: number; status?: string; transactionId?: string | null }>;
  redeemedPointsAmount?: number;
}) {
  const e = await emit('PAYMENT_COLLECTED', 'ORDER', orderId, p, chain(orderId));
  remember(orderId, e.id);
}

export async function voidOrder(orderId: string, reason: string, approverId: string) {
  const e = await emit('ORDER_VOIDED', 'ORDER', orderId, { reason, approverId }, chain(orderId));
  remember(orderId, e.id);
}

export async function cancelOrder(orderId: string) {
  const e = await emit('ORDER_CANCELLED', 'ORDER', orderId, {}, chain(orderId));
  remember(orderId, e.id);
}

export async function setTableStatus(tableId: string, status: string) {
  await emit('TABLE_STATUS_CHANGED', 'TABLE', tableId, { status });
}

export async function changeItemNote(orderId: string, lineId: string, note: string) {
  const e = await emit('ITEM_NOTE_CHANGED', 'ORDER', orderId, { lineId, note }, chain(orderId));
  remember(orderId, e.id);
}

export async function changeOrderNote(orderId: string, note: string) {
  const e = await emit('ORDER_NOTE_CHANGED', 'ORDER', orderId, { note }, chain(orderId));
  remember(orderId, e.id);
}

export async function removeDiscount(orderId: string, reason: string, approverId?: string) {
  const e = await emit('DISCOUNT_REMOVED', 'ORDER', orderId,
    { reason, approverId: approverId ?? null }, chain(orderId));
  remember(orderId, e.id);
}

export async function markServed(orderId: string) {
  const e = await emit('ORDER_SERVED', 'ORDER', orderId, {}, chain(orderId));
  remember(orderId, e.id);
}

export async function walkOutOrder(orderId: string, reason: string, approverId: string) {
  const e = await emit('ORDER_WALKED_OUT', 'ORDER', orderId, { reason, approverId }, chain(orderId));
  remember(orderId, e.id);
}

export async function attachCustomer(
  orderId: string, customer: { customerId?: string | null; phone: string; name?: string | null }
) {
  const e = await emit('CUSTOMER_ATTACHED', 'ORDER', orderId, customer, chain(orderId));
  remember(orderId, e.id);
}

export async function assignWaiter(
  orderId: string, waiterId: string | null, waiterName: string | null, waiterColor?: string | null
) {
  const e = await emit('WAITER_ASSIGNED', 'ORDER', orderId, { waiterId, waiterName, waiterColor }, chain(orderId));
  remember(orderId, e.id);
}

export async function moveOrderToTable(
  orderId: string, fromTableId: string | null, toTableId: string, toTableLabel?: string
) {
  const e = await emit('ORDER_MOVED_TO_TABLE', 'ORDER', orderId,
    { fromTableId, toTableId, toTableLabel }, chain(orderId));
  remember(orderId, e.id);
}

export async function mergeTable(fromTableId: string, intoTableId: string) {
  await emit('TABLE_MERGED', 'TABLE', fromTableId, { intoTableId });
}

export async function splitTable(sourceTableId: string, newTableIds: string[]) {
  await emit('TABLE_SPLIT', 'TABLE', sourceTableId, { newTableIds });
}

export async function markBillPrinted(orderId: string, copyNumber = 1) {
  const e = await emit('BILL_PRINTED', 'ORDER', orderId, { copyNumber }, chain(orderId));
  remember(orderId, e.id);
}

export async function markReceiptPrinted(orderId: string, copyNumber = 1) {
  const e = await emit('RECEIPT_PRINTED', 'ORDER', orderId, { copyNumber }, chain(orderId));
  remember(orderId, e.id);
}

export async function markCancellationKotPrinted(orderId: string, lineIds: string[], reason: string) {
  const e = await emit('CANCELLATION_KOT_PRINTED', 'ORDER', orderId, { lineIds, reason }, chain(orderId));
  remember(orderId, e.id);
}

export async function recordManagerApproval(action: string, targetId: string, managerId: string) {
  await emit('MANAGER_APPROVED', 'ORDER', targetId, { action, managerId });
}

export async function recordManagerDenial(action: string, targetId: string, managerId: string) {
  await emit('MANAGER_DENIED', 'ORDER', targetId, { action, managerId });
}

export async function openShift(shiftId: string, openingFloat: number, denominations?: any) {
  await emit('SHIFT_OPENED', 'SHIFT', shiftId, { openingFloat, denominations });
}

export async function closeShift(shiftId: string, closingCash: number, variance: number, notes?: string) {
  await emit('SHIFT_CLOSED', 'SHIFT', shiftId, { closingCash, variance, notes });
}

export async function startBreak(shiftId: string, breakType?: string) {
  await emit('BREAK_STARTED', 'SHIFT', shiftId, { breakType });
}

export async function endBreak(shiftId: string) {
  await emit('BREAK_ENDED', 'SHIFT', shiftId, {});
}

export async function cashIn(shiftId: string, amount: number, reason: string) {
  await emit('CASH_IN', 'SHIFT', shiftId, { amount, reason });
}

export async function cashOut(shiftId: string, amount: number, reason: string, approverId?: string) {
  await emit('CASH_OUT', 'SHIFT', shiftId, { amount, reason, approverId: approverId ?? null });
}
