import { useViews, type OrderView } from '@/lib/core/views';
import { getPosShift } from '@/lib/pos-session';
import { resolveShiftId } from '@/lib/offline-shift';

/** Offline figures are explicitly terminal-only, not a claim about other devices. */
export function localShiftSummary(shiftId: string) {
  const shift = getPosShift();
  const orders = Object.values(useViews.getState().orders)
    .filter(o => resolveShiftId(o.shiftId) === resolveShiftId(shiftId));
  const paid = orders.filter(o => o.status === 'COMPLETED');
  const open = orders.filter(o => ['PENDING', 'IN_KITCHEN', 'READY'].includes(o.status));
  const sum = (key: 'netAmount' | 'taxAmount' | 'discountAmount') =>
    paid.reduce((n, o) => n + Number(o[key] || 0), 0);
  const tender = (o: OrderView, cash: boolean) => o.payments?.length
    ? o.payments.filter(p => (p.method === 'CASH') === cash && p.status !== 'FAILED').reduce((n, p) => n + p.amount, 0)
    : (o.paymentMethod === 'CASH') === cash ? o.netAmount : 0;
  const totalCash = paid.reduce((n, o) => n + tender(o, true), 0);
  return {
    shiftId, openedAt: shift?.openedAt || new Date().toISOString(),
    openingFloat: shift?.openingFloat || 0,
    totalSales: sum('netAmount'), totalTax: sum('taxAmount'), totalDiscount: sum('discountAmount'),
    totalCash, totalDigital: paid.reduce((n, o) => n + tender(o, false), 0),
    totalOrders: paid.length, unpaidOrders: open.length,
    unpaidValue: open.reduce((n, o) => n + o.netAmount, 0),
    unpaidOrdersList: open.map(o => ({ id: o.id, orderNumber: o.orderNumber, netAmount: o.netAmount, status: o.status, tableLabel: o.tableLabel, type: o.type })),
    // Do not show an invented cash variance when server cash entries are unavailable.
    expectedCash: null, terminalCash: (shift?.openingFloat || 0) + totalCash,
    localEstimate: true,
  };
}

export function locallyRecordedPayment(orderId: string): OrderView | undefined {
  return Object.values(useViews.getState().orders)
    .find(o => (o.id === orderId || o.serverId === orderId) && o.status === 'COMPLETED' && !!o.paymentMethod);
}
