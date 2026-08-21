import { prisma } from '@dineiz/db';
import { getDashboardAnalytics } from '../analytics/analytics.service';

// Unified shape every report-data function returns. generateCSV/generateExcel/
// generatePDF in generators.ts render off this shape generically — no more
// per-report-type special casing there.
export type ReportColumn = { key: string; label: string; align?: 'left' | 'right' };
export type ReportData = {
  title: string;
  period: string;
  summary?: { label: string; value: string | number }[];
  columns?: ReportColumn[];
  rows?: Record<string, any>[];
  totals?: Record<string, string | number>;
};

function periodLabel(startDate: Date, endDate: Date) {
  return `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`;
}

export async function getTaxReportData(tenantId: string, branchId: string | undefined, startDate: Date, endDate: Date): Promise<ReportData> {
  const whereClause: any = {
    tenantId,
    status: 'COMPLETED',
    createdAt: { gte: startDate, lte: endDate }
  };
  if (branchId) whereClause.branchId = branchId;

  const orders = await prisma.order.findMany({ where: whereClause, include: { payments: true } });

  let totalGross = 0;
  let taxableRevenue = 0;
  let nonTaxableRevenue = 0;
  let cashTaxCollected = 0;
  let cardTaxCollected = 0;

  let firstInvoiceNumber = '';
  let lastInvoiceNumber = '';

  const sortedOrders = [...orders].sort((a, b) => a.orderNumber.localeCompare(b.orderNumber));
  if (sortedOrders.length > 0) {
    firstInvoiceNumber = sortedOrders[0].orderNumber;
    lastInvoiceNumber = sortedOrders[sortedOrders.length - 1].orderNumber;
  }

  orders.forEach(order => {
    totalGross += order.totalAmount;
    if (order.taxAmount > 0) {
      taxableRevenue += order.netAmount;
      const paymentMethods = order.payments.map(p => p.method);
      if (paymentMethods.includes('CASH')) {
        cashTaxCollected += order.taxAmount;
      } else {
        cardTaxCollected += order.taxAmount;
      }
    } else {
      nonTaxableRevenue += order.netAmount;
    }
  });

  return {
    title: 'Tax Report (FBR/GST)',
    period: periodLabel(startDate, endDate),
    summary: [
      { label: 'Total Gross Revenue', value: totalGross },
      { label: 'Taxable Revenue', value: taxableRevenue },
      { label: 'Non-Taxable Revenue', value: nonTaxableRevenue },
      { label: 'Cash Tax Collected', value: cashTaxCollected },
      { label: 'Card Tax Collected', value: cardTaxCollected },
      { label: 'Total Tax Collected', value: cashTaxCollected + cardTaxCollected },
      { label: 'FBR Invoice Range', value: `${firstInvoiceNumber} - ${lastInvoiceNumber}` },
    ],
  };
}

export async function getShiftBalanceReportData(tenantId: string, branchId: string | undefined, startDate: Date, endDate: Date): Promise<ReportData> {
  const whereClause: any = { tenantId, createdAt: { gte: startDate, lte: endDate } };
  if (branchId) whereClause.branchId = branchId;

  const shifts = await prisma.shift.findMany({ where: whereClause, include: { user: true, branch: true } });

  const rows = shifts.map((shift) => {
    const expectedCash = (shift.openingFloat || 0) + (shift.totalCash || 0);
    const variance = (shift.closingCash || 0) - expectedCash;
    let status = 'BALANCED';
    if (variance > 0) status = 'OVER';
    if (variance < 0) status = 'SHORT';

    return {
      date: shift.createdAt.toISOString().split('T')[0],
      cashier: shift.user?.name || shift.userId,
      branch: shift.branch?.name || shift.branchId,
      openingFloat: shift.openingFloat || 0,
      cashOrders: shift.totalCash || 0,
      cardOrders: shift.totalCard || 0,
      totalRevenue: shift.totalSales || 0,
      closingCashEntered: shift.closingCash || 0,
      expectedCash,
      variance,
      status,
      notes: shift.status === 'CLOSED' ? 'Shift Closed' : 'Open'
    };
  });

  const totals = rows.reduce((acc, curr) => ({
    openingFloat: acc.openingFloat + curr.openingFloat,
    cashOrders: acc.cashOrders + curr.cashOrders,
    cardOrders: acc.cardOrders + curr.cardOrders,
    totalRevenue: acc.totalRevenue + curr.totalRevenue,
    closingCashEntered: acc.closingCashEntered + curr.closingCashEntered,
    expectedCash: acc.expectedCash + curr.expectedCash,
    variance: acc.variance + curr.variance
  }), { openingFloat: 0, cashOrders: 0, cardOrders: 0, totalRevenue: 0, closingCashEntered: 0, expectedCash: 0, variance: 0 });

  return {
    title: 'Shift Balance Report',
    period: periodLabel(startDate, endDate),
    columns: [
      { key: 'date', label: 'Date' },
      { key: 'cashier', label: 'Cashier' },
      { key: 'branch', label: 'Branch' },
      { key: 'openingFloat', label: 'Opening Float', align: 'right' },
      { key: 'cashOrders', label: 'Cash Orders', align: 'right' },
      { key: 'cardOrders', label: 'Card Orders', align: 'right' },
      { key: 'totalRevenue', label: 'Total Revenue', align: 'right' },
      { key: 'closingCashEntered', label: 'Closing Cash', align: 'right' },
      { key: 'expectedCash', label: 'Expected Cash', align: 'right' },
      { key: 'variance', label: 'Variance', align: 'right' },
      { key: 'status', label: 'Status' },
    ],
    rows,
    totals: {
      openingFloat: totals.openingFloat, cashOrders: totals.cashOrders, cardOrders: totals.cardOrders,
      totalRevenue: totals.totalRevenue, closingCashEntered: totals.closingCashEntered,
      expectedCash: totals.expectedCash, variance: totals.variance,
    },
  };
}

export async function getDiscountVoidReportData(tenantId: string, branchId: string | undefined, startDate: Date, endDate: Date): Promise<ReportData> {
  const orderWhere: any = { tenantId, createdAt: { gte: startDate, lte: endDate }, discountAmount: { gt: 0 } };
  if (branchId) orderWhere.branchId = branchId;

  const discountedOrders = await prisma.order.findMany({
    where: orderWhere,
    select: { orderNumber: true, createdAt: true, discountAmount: true, netAmount: true, branchId: true },
    orderBy: { createdAt: 'desc' },
  });

  const voidWhere: any = { tenantId, createdAt: { gte: startDate, lte: endDate } };
  if (branchId) voidWhere.branchId = branchId;

  const voids = await prisma.voidRequest.findMany({
    where: voidWhere,
    include: { orderItem: { include: { item: true } }, cashier: true, order: { select: { orderNumber: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const totalDiscount = discountedOrders.reduce((s, o) => s + o.discountAmount, 0);

  const rows = [
    ...discountedOrders.map(o => ({
      type: 'Discount',
      date: o.createdAt.toLocaleString(),
      reference: `Order #${o.orderNumber}`,
      detail: `Net PKR ${o.netAmount.toLocaleString()}`,
      by: '-',
      amount: o.discountAmount,
      status: '-',
    })),
    ...voids.map(v => ({
      type: 'Void',
      date: v.createdAt.toLocaleString(),
      reference: `Order #${v.order.orderNumber}`,
      detail: `${v.orderItem.item.name} x${v.quantity} — ${v.reason}`,
      by: v.cashier.name,
      amount: v.orderItem.unitPrice * v.quantity,
      status: v.status,
    })),
  ].sort((a, b) => a.date < b.date ? 1 : -1);

  return {
    title: 'Discount and Void Report',
    period: periodLabel(startDate, endDate),
    summary: [
      { label: 'Total Discounted Orders', value: discountedOrders.length },
      { label: 'Total Discount Given', value: totalDiscount },
      { label: 'Total Void Requests', value: voids.length },
      { label: 'Approved Voids', value: voids.filter(v => v.status === 'APPROVED').length },
    ],
    columns: [
      { key: 'type', label: 'Type' },
      { key: 'date', label: 'Date' },
      { key: 'reference', label: 'Order' },
      { key: 'detail', label: 'Detail' },
      { key: 'by', label: 'Staff' },
      { key: 'amount', label: 'Amount', align: 'right' },
      { key: 'status', label: 'Status' },
    ],
    rows,
  };
}

async function getStockMovementReport(
  title: string,
  tenantId: string,
  branchId: string | undefined,
  startDate: Date,
  endDate: Date,
  movementType: 'DEDUCT_SALE' | 'WASTAGE',
): Promise<ReportData> {
  const where: any = { tenantId, type: movementType, createdAt: { gte: startDate, lte: endDate } };
  if (branchId) where.branchId = branchId;

  const movements = await prisma.stockMovement.findMany({ where, include: { ingredient: true } });

  const byIngredient = new Map<string, { name: string; unit: string; quantity: number; costPerUnit: number }>();
  for (const m of movements) {
    const key = m.ingredientId;
    const existing = byIngredient.get(key);
    const qty = Math.abs(m.quantity);
    if (existing) {
      existing.quantity += qty;
    } else {
      byIngredient.set(key, { name: m.ingredient.name, unit: m.ingredient.unit, quantity: qty, costPerUnit: m.ingredient.costPerUnit });
    }
  }

  const rows = Array.from(byIngredient.values())
    .map(v => ({ ingredient: v.name, unit: v.unit, quantity: v.quantity, unitCost: v.costPerUnit, value: v.quantity * v.costPerUnit }))
    .sort((a, b) => b.value - a.value);

  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  const totalQty = rows.reduce((s, r) => s + r.quantity, 0);

  return {
    title,
    period: periodLabel(startDate, endDate),
    summary: [
      { label: 'Ingredients Affected', value: rows.length },
      { label: 'Total Quantity', value: Math.round(totalQty * 100) / 100 },
      { label: 'Total Value', value: totalValue },
    ],
    columns: [
      { key: 'ingredient', label: 'Ingredient' },
      { key: 'unit', label: 'Unit' },
      { key: 'quantity', label: 'Quantity', align: 'right' },
      { key: 'unitCost', label: 'Unit Cost', align: 'right' },
      { key: 'value', label: 'Value', align: 'right' },
    ],
    rows,
    totals: { quantity: Math.round(totalQty * 100) / 100, value: totalValue },
  };
}

export function getInventoryConsumptionReportData(tenantId: string, branchId: string | undefined, startDate: Date, endDate: Date) {
  return getStockMovementReport('Inventory Consumption', tenantId, branchId, startDate, endDate, 'DEDUCT_SALE');
}

export function getWastageReportData(tenantId: string, branchId: string | undefined, startDate: Date, endDate: Date) {
  return getStockMovementReport('Wastage Report', tenantId, branchId, startDate, endDate, 'WASTAGE');
}

export async function getPurchaseOrdersReportData(tenantId: string, branchId: string | undefined, startDate: Date, endDate: Date): Promise<ReportData> {
  const where: any = { tenantId, createdAt: { gte: startDate, lte: endDate } };
  if (branchId) where.branchId = branchId;

  const orders = await prisma.purchaseOrder.findMany({
    where,
    include: { lines: true, branch: true },
    orderBy: { createdAt: 'desc' },
  });

  const rows = orders.map(po => ({
    date: po.createdAt.toISOString().split('T')[0],
    supplier: po.supplierName || 'Unknown',
    branch: po.branch?.name || po.branchId,
    status: po.status,
    lines: po.lines.length,
    orderedQty: po.lines.reduce((s, l) => s + l.orderedQty, 0),
    receivedQty: po.lines.reduce((s, l) => s + l.receivedQty, 0),
    estimatedTotal: po.estimatedTotal,
  }));

  const totalValue = rows.reduce((s, r) => s + r.estimatedTotal, 0);

  return {
    title: 'Purchase Orders Summary',
    period: periodLabel(startDate, endDate),
    summary: [
      { label: 'Total Purchase Orders', value: orders.length },
      { label: 'Received', value: orders.filter(o => o.status === 'FULLY_RECEIVED' || o.status === 'PARTIALLY_RECEIVED').length },
      { label: 'Pending / Sent', value: orders.filter(o => o.status === 'SENT' || o.status === 'DRAFT').length },
      { label: 'Total Estimated Value', value: totalValue },
    ],
    columns: [
      { key: 'date', label: 'Date' },
      { key: 'supplier', label: 'Supplier' },
      { key: 'branch', label: 'Branch' },
      { key: 'status', label: 'Status' },
      { key: 'lines', label: 'Line Items', align: 'right' },
      { key: 'orderedQty', label: 'Ordered Qty', align: 'right' },
      { key: 'receivedQty', label: 'Received Qty', align: 'right' },
      { key: 'estimatedTotal', label: 'Est. Total', align: 'right' },
    ],
    rows,
    totals: { estimatedTotal: totalValue },
  };
}

export async function getStockValuationReportData(tenantId: string, branchId: string | undefined): Promise<ReportData> {
  const where: any = { tenantId };
  if (branchId) where.branchId = branchId;

  const stocks = await prisma.stock.findMany({ where, include: { ingredient: true, branch: true } });

  const rows = stocks
    .map(s => ({
      ingredient: s.ingredient.name,
      branch: s.branch?.name || s.branchId,
      quantity: s.quantity,
      unitCost: s.ingredient.costPerUnit,
      value: s.quantity * s.ingredient.costPerUnit,
    }))
    .sort((a, b) => b.value - a.value);

  const totalValue = rows.reduce((s, r) => s + r.value, 0);

  return {
    title: 'Stock Valuation Report',
    period: `As of ${new Date().toLocaleString()}`,
    summary: [
      { label: 'Ingredients in Stock', value: rows.length },
      { label: 'Total Stock Value', value: totalValue },
    ],
    columns: [
      { key: 'ingredient', label: 'Ingredient' },
      { key: 'branch', label: 'Branch' },
      { key: 'quantity', label: 'Quantity', align: 'right' },
      { key: 'unitCost', label: 'Unit Cost', align: 'right' },
      { key: 'value', label: 'Value', align: 'right' },
    ],
    rows,
    totals: { value: totalValue },
  };
}

export async function getShiftHoursReportData(tenantId: string, branchId: string | undefined, startDate: Date, endDate: Date): Promise<ReportData> {
  const where: any = { tenantId, createdAt: { gte: startDate, lte: endDate } };
  if (branchId) where.branchId = branchId;

  const shifts = await prisma.shift.findMany({ where, include: { user: true, branch: true, breaks: true } });

  const byStaff = new Map<string, { name: string; branch: string; shiftCount: number; activeSeconds: number; breakSeconds: number }>();
  for (const shift of shifts) {
    const end = shift.closedAt ? shift.closedAt.getTime() : Date.now();
    const durationSeconds = Math.floor((end - shift.openedAt.getTime()) / 1000);
    const breakSeconds = shift.breaks.reduce((s, b) => {
      const bEnd = b.endedAt ? b.endedAt.getTime() : Date.now();
      return s + Math.floor((bEnd - b.startedAt.getTime()) / 1000);
    }, 0);

    const key = shift.userId;
    const existing = byStaff.get(key);
    if (existing) {
      existing.shiftCount += 1;
      existing.activeSeconds += Math.max(0, durationSeconds - breakSeconds);
      existing.breakSeconds += breakSeconds;
    } else {
      byStaff.set(key, {
        name: shift.user?.name || shift.userId,
        branch: shift.branch?.name || shift.branchId,
        shiftCount: 1,
        activeSeconds: Math.max(0, durationSeconds - breakSeconds),
        breakSeconds,
      });
    }
  }

  const formatHours = (secs: number) => Math.round((secs / 3600) * 100) / 100;

  const rows = Array.from(byStaff.values())
    .map(v => ({ staff: v.name, branch: v.branch, shifts: v.shiftCount, hoursWorked: formatHours(v.activeSeconds), breakHours: formatHours(v.breakSeconds) }))
    .sort((a, b) => b.hoursWorked - a.hoursWorked);

  const totalHours = rows.reduce((s, r) => s + r.hoursWorked, 0);

  return {
    title: 'Shift Hours Report',
    period: periodLabel(startDate, endDate),
    summary: [
      { label: 'Staff with Shifts', value: rows.length },
      { label: 'Total Hours Worked', value: totalHours },
    ],
    columns: [
      { key: 'staff', label: 'Staff' },
      { key: 'branch', label: 'Branch' },
      { key: 'shifts', label: 'Shifts', align: 'right' },
      { key: 'hoursWorked', label: 'Hours Worked', align: 'right' },
      { key: 'breakHours', label: 'Break Hours', align: 'right' },
    ],
    rows,
    totals: { hoursWorked: Math.round(totalHours * 100) / 100 },
  };
}

export async function getCustomerActivityReportData(tenantId: string, branchId: string | undefined, startDate: Date, endDate: Date): Promise<ReportData> {
  const where: any = { tenantId, createdAt: { gte: startDate, lte: endDate }, customerId: { not: null } };
  if (branchId) where.branchId = branchId;

  const orders = await prisma.order.findMany({ where, include: { customer: true } });

  const byCustomer = new Map<string, { name: string; phone: string; visits: number; spend: number }>();
  for (const o of orders) {
    if (!o.customer) continue;
    const existing = byCustomer.get(o.customerId!);
    if (existing) {
      existing.visits += 1;
      existing.spend += o.netAmount;
    } else {
      byCustomer.set(o.customerId!, { name: o.customer.name, phone: o.customer.phone || '-', visits: 1, spend: o.netAmount });
    }
  }

  const rows = Array.from(byCustomer.values())
    .map(v => ({ customer: v.name, phone: v.phone, visits: v.visits, spend: v.spend, avgSpend: Math.round((v.spend / v.visits) * 100) / 100 }))
    .sort((a, b) => b.spend - a.spend);

  return {
    title: 'Customer Activity Report',
    period: periodLabel(startDate, endDate),
    summary: [
      { label: 'Active Customers', value: rows.length },
      { label: 'Total Orders', value: orders.length },
      { label: 'Total Revenue', value: rows.reduce((s, r) => s + r.spend, 0) },
    ],
    columns: [
      { key: 'customer', label: 'Customer' },
      { key: 'phone', label: 'Phone' },
      { key: 'visits', label: 'Visits', align: 'right' },
      { key: 'spend', label: 'Total Spend', align: 'right' },
      { key: 'avgSpend', label: 'Avg / Visit', align: 'right' },
    ],
    rows,
  };
}

export async function getLoyaltyPointsReportData(tenantId: string, branchId: string | undefined, startDate: Date, endDate: Date): Promise<ReportData> {
  const entries = await prisma.loyaltyPointLedger.findMany({
    where: { tenantId, createdAt: { gte: startDate, lte: endDate } },
    include: { customer: true },
    orderBy: { createdAt: 'desc' },
  });

  const byType = entries.reduce((acc: Record<string, number>, e) => {
    acc[e.type] = (acc[e.type] || 0) + e.points;
    return acc;
  }, {});

  const rows = entries.map(e => ({
    date: e.createdAt.toLocaleString(),
    customer: e.customer.name,
    type: e.type,
    points: e.points,
    note: e.note || '-',
  }));

  return {
    title: 'Loyalty Points Report',
    period: periodLabel(startDate, endDate),
    summary: Object.entries(byType).map(([type, points]) => ({ label: type, value: points })),
    columns: [
      { key: 'date', label: 'Date' },
      { key: 'customer', label: 'Customer' },
      { key: 'type', label: 'Type' },
      { key: 'points', label: 'Points', align: 'right' },
      { key: 'note', label: 'Note' },
    ],
    rows,
  };
}

export async function getTopCustomersReportData(tenantId: string, branchId: string | undefined): Promise<ReportData> {
  // branchId not applicable — Customer totals are tenant-wide denormalized fields.
  const customers = await prisma.customer.findMany({
    where: { tenantId, deletedAt: null, totalOrders: { gt: 0 } },
    orderBy: { totalSpend: 'desc' },
    take: 50,
  });

  const rows = customers.map(c => ({
    customer: c.name,
    phone: c.phone || '-',
    totalOrders: c.totalOrders,
    totalSpend: c.totalSpend,
    loyaltyPoints: c.loyaltyPoints,
    segment: c.segment || '-',
    lastVisit: c.lastVisitAt ? c.lastVisitAt.toISOString().split('T')[0] : '-',
  }));

  return {
    title: 'Top Customers Report',
    period: `Top ${rows.length} by lifetime spend`,
    columns: [
      { key: 'customer', label: 'Customer' },
      { key: 'phone', label: 'Phone' },
      { key: 'totalOrders', label: 'Orders', align: 'right' },
      { key: 'totalSpend', label: 'Total Spend', align: 'right' },
      { key: 'loyaltyPoints', label: 'Loyalty Points', align: 'right' },
      { key: 'segment', label: 'Segment' },
      { key: 'lastVisit', label: 'Last Visit' },
    ],
    rows,
  };
}

export async function generateReportData(tenantId: string, branchId: string | undefined, type: string, params: any): Promise<ReportData> {
  let startDate = new Date();
  let endDate = new Date();

  if (params.startDate && params.endDate) {
    startDate = new Date(params.startDate);
    endDate = new Date(params.endDate);
  }

  switch (type) {
    case 'TAX_REPORT':
      return getTaxReportData(tenantId, branchId, startDate, endDate);
    case 'SHIFT_BALANCE':
      return getShiftBalanceReportData(tenantId, branchId, startDate, endDate);
    case 'DISCOUNT_VOID':
      return getDiscountVoidReportData(tenantId, branchId, startDate, endDate);
    case 'INVENTORY_CONSUMPTION':
      return getInventoryConsumptionReportData(tenantId, branchId, startDate, endDate);
    case 'WASTAGE_REPORT':
      return getWastageReportData(tenantId, branchId, startDate, endDate);
    case 'PURCHASE_ORDERS':
      return getPurchaseOrdersReportData(tenantId, branchId, startDate, endDate);
    case 'STOCK_VALUATION':
      return getStockValuationReportData(tenantId, branchId);
    case 'SHIFT_HOURS':
      return getShiftHoursReportData(tenantId, branchId, startDate, endDate);
    case 'CUSTOMER_ACTIVITY':
      return getCustomerActivityReportData(tenantId, branchId, startDate, endDate);
    case 'LOYALTY_POINTS':
      return getLoyaltyPointsReportData(tenantId, branchId, startDate, endDate);
    case 'TOP_CUSTOMERS':
      return getTopCustomersReportData(tenantId, branchId);
    case 'DAILY_SALES':
    case 'MONTHLY_REVENUE':
    case 'PAYMENT_METHOD':
    case 'MENU_PERFORMANCE': {
      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];
      const analytics = await getDashboardAnalytics(tenantId, branchId, startStr, endStr);
      const period = periodLabel(startDate, endDate);

      if (type === 'MENU_PERFORMANCE') {
        return {
          title: 'Menu Performance Report', period,
          columns: [{ key: 'name', label: 'Item' }, { key: 'qty', label: 'Qty Sold', align: 'right' }, { key: 'revenue', label: 'Revenue', align: 'right' }],
          rows: analytics.items as any,
        };
      }
      if (type === 'PAYMENT_METHOD') {
        return {
          title: 'Payment Method Breakdown', period,
          columns: [{ key: 'method', label: 'Method' }, { key: 'amount', label: 'Amount', align: 'right' }, { key: 'count', label: 'Orders', align: 'right' }],
          rows: Object.entries(analytics.breakdowns.payment as Record<string, { count: number; value: number }>)
            .map(([method, v]) => ({ method, amount: v.value, count: v.count })),
        };
      }
      if (type === 'MONTHLY_REVENUE') {
        return {
          title: 'Monthly Revenue Report', period,
          columns: [{ key: 'date', label: 'Date' }, { key: 'revenue', label: 'Revenue', align: 'right' }, { key: 'orders', label: 'Orders', align: 'right' }],
          rows: analytics.dailyTrend as any,
        };
      }
      return {
        title: 'Daily Sales Summary', period,
        summary: Object.entries(analytics.kpis || {}).map(([label, value]) => ({ label, value: value as any })),
        columns: [{ key: 'type', label: 'Order Type' }, { key: 'amount', label: 'Amount', align: 'right' }, { key: 'count', label: 'Orders', align: 'right' }],
        rows: Object.entries(analytics.breakdowns.type as Record<string, { count: number; value: number }>)
          .map(([type, v]) => ({ type, amount: v.value, count: v.count })),
      };
    }
    case 'STAFF_PERFORMANCE':
    case 'STAFF_ATTENDANCE': {
      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];
      const analytics = await getDashboardAnalytics(tenantId, branchId, startStr, endStr);
      return {
        title: type === 'STAFF_PERFORMANCE' ? 'Staff Performance Report' : 'Staff Attendance Report',
        period: periodLabel(startDate, endDate),
        columns: [{ key: 'name', label: 'Staff' }, { key: 'orders', label: 'Orders', align: 'right' }, { key: 'revenue', label: 'Revenue', align: 'right' }],
        rows: analytics.staff as any,
      };
    }
    default:
      return { title: type.replace(/_/g, ' '), period: periodLabel(startDate, endDate), summary: [{ label: 'Status', value: `Report type ${type} is not recognized.` }] };
  }
}
