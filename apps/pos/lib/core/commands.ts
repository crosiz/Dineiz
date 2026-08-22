import { nanoid } from 'nanoid';
import { append, nextOrderNumber, type EventType } from './event-log';
import { useViews } from './views';

async function emit(
  type: EventType,
  aggType: 'ORDER' | 'TABLE' | 'SHIFT',
  aggId: string,
  payload: any,
  dependsOn: string[] = []
) {
  const e = await append(type, aggType, aggId, payload, dependsOn);
  useViews.getState()._applyEvent(e); // views update NOW
  return e;
}

// Track the last event per aggregate for dependency chaining. Phase 1 ships
// events via the existing fetch-then-queue-offline path in the calling
// screens (order/page.tsx, PaymentModal.tsx) rather than a dedicated outbox
// — see the Phase 1 plan for why: the full dependency-DAG outbox (spec Part
// D) is Phase 2, once there's a server endpoint designed to understand this
// event shape. `dependsOn` is still recorded here so it's available once
// that outbox exists — it just isn't consulted by anything yet.
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
