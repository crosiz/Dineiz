import { prisma, Prisma } from '@dineiz/db';

/**
 * Shift timeline writers.
 *
 * The ShiftActivity table is the audit trail behind the Shift Management
 * timeline and the shift PDF. Open/close/break/cash entries have always been
 * written by shift.service.ts, but everything the cashier actually *does* on
 * the POS — completing orders, voiding items, applying discounts — was never
 * recorded, which left the timeline showing a shift that opened, went quiet
 * for eight hours, and closed.
 *
 * These helpers are deliberately fire-and-forget: a failure to write an audit
 * line must never fail (or slow down) the order it describes. Callers should
 * NOT await them.
 */

const fmtPKR = (n: number) => `PKR ${Math.round(n).toLocaleString('en-US')}`;

function safeWrite(data: Parameters<typeof prisma.shiftActivity.create>[0]['data']) {
  prisma.shiftActivity
    .create({ data })
    .catch((e) => console.error('[ShiftActivity] write failed:', e?.message ?? e));
}

/** An order was rung up and settled on this shift. */
export function recordOrderCompleted(order: {
  id: string;
  shiftId?: string | null;
  orderNumber?: string | number | null;
  netAmount?: number | null;
  discountAmount?: number | null;
  type?: string | null;
  items?: unknown[];
  payments?: { method?: string | null; amount?: number | null }[];
}) {
  if (!order.shiftId) return;

  const methods = [...new Set((order.payments ?? []).map((p) => p.method).filter(Boolean))];
  const itemCount = Array.isArray(order.items) ? order.items.length : undefined;
  const net = Number(order.netAmount ?? 0);

  const parts = [`Order #${order.orderNumber ?? order.id.slice(-6)} completed`];
  if (itemCount !== undefined) parts.push(`${itemCount} item${itemCount === 1 ? '' : 's'}`);
  if (methods.length) parts.push(methods.join(' + '));

  safeWrite({
    shiftId: order.shiftId,
    activityType: 'ORDER_COMPLETED',
    amount: net,
    notes: `${parts.join(' — ')} · ${fmtPKR(net)}`,
    metadata: {
      orderId: order.id,
      orderNumber: order.orderNumber ?? null,
      orderType: order.type ?? null,
      paymentMethods: methods.filter((m): m is string => typeof m === 'string'),
      itemCount: itemCount ?? null,
    } satisfies Prisma.InputJsonValue,
  });

  // A discount is a separate, individually reviewable event — managers audit
  // these on their own, so they get their own timeline line rather than being
  // buried in the order's note.
  const discount = Number(order.discountAmount ?? 0);
  if (discount > 0) {
    safeWrite({
      shiftId: order.shiftId,
      activityType: 'DISCOUNT_APPLIED',
      amount: discount,
      notes: `Discount of ${fmtPKR(discount)} applied to order #${order.orderNumber ?? order.id.slice(-6)}`,
      metadata: { orderId: order.id, orderNumber: order.orderNumber ?? null },
    });
  }
}

/** An item was voided off an order, or a whole order was cancelled. */
export function recordOrderVoided(
  order: { id: string; shiftId?: string | null; orderNumber?: string | number | null },
  detail: { itemName?: string; quantity?: number; amount?: number; reason?: string; performedById?: string | null; wholeOrder?: boolean },
) {
  if (!order.shiftId) return;

  const label = detail.wholeOrder
    ? `Order #${order.orderNumber ?? order.id.slice(-6)} cancelled`
    : `Voided ${detail.quantity ?? 1}× ${detail.itemName ?? 'item'} from order #${order.orderNumber ?? order.id.slice(-6)}`;

  safeWrite({
    shiftId: order.shiftId,
    activityType: 'ORDER_VOIDED',
    performedById: detail.performedById ?? null,
    amount: detail.amount ?? null,
    notes: detail.reason ? `${label} — ${detail.reason}` : label,
    metadata: {
      orderId: order.id,
      orderNumber: order.orderNumber ?? null,
      itemName: detail.itemName ?? null,
      quantity: detail.quantity ?? null,
      reason: detail.reason ?? null,
    },
  });
}
