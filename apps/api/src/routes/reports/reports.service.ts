import { prisma } from '@swiftserve/db';
import { endOfDay, startOfDay, subDays } from 'date-fns';
import { getAnalyticsSummary, getDashboardAnalytics } from '../analytics/analytics.service';

export async function getTaxReportData(tenantId: string, branchId: string | undefined, startDate: Date, endDate: Date) {
  const whereClause: any = {
    tenantId,
    status: 'COMPLETED',
    createdAt: { gte: startDate, lte: endDate }
  };
  if (branchId) {
    whereClause.branchId = branchId;
  }

  const orders = await prisma.order.findMany({
    where: whereClause,
    include: {
      payments: true
    }
  });

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
    
    // Simplification: assume if taxAmount > 0, the netAmount is taxable
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
    period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
    totalGrossRevenue: totalGross,
    taxableRevenue,
    nonTaxableRevenue,
    cashTaxCollected,
    cardTaxCollected,
    totalTaxCollected: cashTaxCollected + cardTaxCollected,
    fbrInvoiceRange: `${firstInvoiceNumber} - ${lastInvoiceNumber}`
  };
}

export async function getShiftBalanceReportData(tenantId: string, branchId: string | undefined, startDate: Date, endDate: Date) {
  const whereClause: any = {
    tenantId,
    createdAt: { gte: startDate, lte: endDate }
  };
  if (branchId) {
    whereClause.branchId = branchId;
  }

  const shifts = await prisma.shift.findMany({
    where: whereClause,
    include: {
      user: true,
      branch: true
    }
  });

  const reportData = shifts.map((shift: any) => {
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

  const totals = reportData.reduce((acc, curr) => ({
    openingFloat: acc.openingFloat + curr.openingFloat,
    cashOrders: acc.cashOrders + curr.cashOrders,
    cardOrders: acc.cardOrders + curr.cardOrders,
    totalRevenue: acc.totalRevenue + curr.totalRevenue,
    closingCashEntered: acc.closingCashEntered + curr.closingCashEntered,
    expectedCash: acc.expectedCash + curr.expectedCash,
    variance: acc.variance + curr.variance
  }), {
    openingFloat: 0, cashOrders: 0, cardOrders: 0, totalRevenue: 0, closingCashEntered: 0, expectedCash: 0, variance: 0
  });

  return {
    period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
    shifts: reportData,
    totals
  };
}

export async function generateReportData(tenantId: string, branchId: string | undefined, type: string, params: any) {
  let startDate = new Date();
  let endDate = new Date();
  
  if (params.startDate && params.endDate) {
    startDate = new Date(params.startDate);
    endDate = new Date(params.endDate);
  }

  if (type === 'TAX_REPORT') {
    return getTaxReportData(tenantId, branchId, startDate, endDate);
  } else if (type === 'SHIFT_BALANCE') {
    return getShiftBalanceReportData(tenantId, branchId, startDate, endDate);
  } else if (['DAILY_SALES', 'MONTHLY_REVENUE', 'PAYMENT_METHOD', 'MENU_PERFORMANCE'].includes(type)) {
    // Reuse analytics service for these
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];
    const analytics = await getDashboardAnalytics(tenantId, branchId, startStr, endStr);
    
    if (type === 'MENU_PERFORMANCE') return { period: `${startStr} to ${endStr}`, items: analytics.items };
    if (type === 'PAYMENT_METHOD') return { period: `${startStr} to ${endStr}`, payments: analytics.breakdowns.payment };
    if (type === 'MONTHLY_REVENUE') return { period: `${startStr} to ${endStr}`, trend: analytics.dailyTrend };
    return { period: `${startStr} to ${endStr}`, summary: analytics.kpis, breakdown: analytics.breakdowns.type };
  } else if (['STAFF_PERFORMANCE', 'STAFF_ATTENDANCE'].includes(type)) {
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];
    const analytics = await getDashboardAnalytics(tenantId, branchId, startStr, endStr);
    return { period: `${startStr} to ${endStr}`, staff: analytics.staff };
  }
  
  // Generic fallback
  return { message: `Report type ${type} data generation not implemented yet.` };
}
