// The close-shift summary, worked out on this terminal.
//
// Closing a shift needed GET /api/shifts/:id/summary for the expected drawer
// cash; with no connection the close screen showed "Couldn't load the shift
// summary" and a disabled button, so the queued close that CloseShiftModal
// and the outbox already support could never be reached. A shift opened
// offline has no server summary to fetch at all.
//
// Same fields as the server's, from the orders this terminal holds. It can't
// see orders another terminal took on the same shift, or cash movements and
// breaks recorded only on the server; the screen says so, and the server
// recomputes every total from its own data when the close reaches it.

import { useViews } from '@/lib/core/views';
import { getPosShift } from '@/lib/pos-session';
import { resolveShiftId } from '@/lib/offline-shift';
import { cashMovements } from '@/lib/offline-cash';

const SETTLED = new Set(['COMPLETED']);
const GONE = new Set(['CANCELLED', 'VOIDED', 'WALKED_OUT']);

export async function localShiftSummary(shiftId: string) {
  const target = resolveShiftId(shiftId);
  const shift = getPosShift();
  const orders = Object.values(useViews.getState().orders).filter((o) => resolveShiftId(o.shiftId) === target);

  const paid = orders.filter((o) => SETTLED.has(o.status));
  const open = orders.filter((o) => !SETTLED.has(o.status) && !GONE.has(o.status));

  const cashOf = (o: (typeof orders)[number]) =>
    o.payments?.length
      ? o.payments.filter((p) => p.method === 'CASH').reduce((s, p) => s + (Number(p.amount) || 0), 0)
      : (o.paymentMethod ?? 'CASH') === 'CASH' ? o.netAmount : 0;

  const openingFloat = shift && resolveShiftId(shift.shiftId) === target ? Number(shift.openingFloat) || 0 : 0;
  const totalCash = paid.reduce((s, o) => s + cashOf(o), 0);
  const movements = await cashMovements(shiftId);
  const cashIn = movements.filter(m => m.type === 'CASH_IN').reduce((s, m) => s + m.amount, 0);
  const cashOut = movements.filter(m => m.type === 'CASH_OUT').reduce((s, m) => s + m.amount, 0);

  return {
    local: true,
    openedAt: shift && resolveShiftId(shift.shiftId) === target ? shift.openedAt : null,
    openingFloat,
    totalOrders: paid.length,
    totalSales: paid.reduce((s, o) => s + o.netAmount, 0),
    totalCash,
    cashIn,
    cashOut,
    expectedCash: openingFloat + totalCash + cashIn - cashOut,
    breakCount: 0,
    totalBreakMinutes: 0,
    unpaidOrders: open.length,
    unpaidValue: open.reduce((s, o) => s + o.netAmount, 0),
    unpaidOrdersList: open.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      netAmount: o.netAmount,
      status: o.status,
      tableLabel: o.tableLabel,
    })),
  };
}
