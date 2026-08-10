import { FastifyRequest, FastifyReply } from 'fastify';
import {
  getDailySales, getHourlyHeatmap, getItemPerformance,
  getTodayKpis, getRevenueChart, getTopItems, getBranchPerformance,
  getDashboardSummary, getRevenueTrend,
  getDashboardAnalytics, getAnalyticsSummary
} from './analytics.service';

export async function handleDashboardSummary(req: FastifyRequest, reply: FastifyReply) {
  const q = req.query as any;
  // Role scoping rule: TENANT_ADMIN can pass branchId query param. BRANCH_MANAGER uses scopedBranchId.
  const branchId = req.scopedBranchId || q.branchId;
  const period = q.period || 'today';
  
  const data = await getDashboardSummary(req.user!.tenantId!, branchId, period);
  return data;
}

export async function handleFullDashboard(req: FastifyRequest, reply: FastifyReply) {
  const q = req.query as any;
  const branchId = req.scopedBranchId || q.branchId;
  const data = await getDashboardAnalytics(req.user!.tenantId!, branchId, q.startDate, q.endDate);
  return data;
}

export async function handleDailySales(req: FastifyRequest, reply: FastifyReply) {
  const q = req.query as any;
  const branchId = req.scopedBranchId || q.branchId;
  const data = await getDailySales(req.user!.tenantId!, q.days ?? 30, branchId);
  return { days: q.days ?? 30, branchId: branchId ?? null, data };
}
export async function handleHourlyHeatmap(req: FastifyRequest, reply: FastifyReply) {
  const q = req.query as any;
  const branchId = req.scopedBranchId || q.branchId;
  const data = await getHourlyHeatmap(req.user!.tenantId!, q.days ?? 30, branchId);
  return { days: q.days ?? 30, branchId: branchId ?? null, data };
}
export async function handleItemPerformance(req: FastifyRequest, reply: FastifyReply) {
  const q = req.query as any;
  const branchId = req.scopedBranchId || q.branchId;
  const data = await getItemPerformance(req.user!.tenantId!, q.days ?? 30, q.limit ?? 50, branchId);
  return { days: q.days ?? 30, limit: q.limit ?? 50, branchId: branchId ?? null, data };
}
export async function handleTodayKpis(req: FastifyRequest, reply: FastifyReply) {
  const q = req.query as any;
  const branchId = req.scopedBranchId || q.branchId;
  return getTodayKpis(req.user!.tenantId!, branchId, q.shiftId);
}
export async function handleRevenueChart(req: FastifyRequest, reply: FastifyReply) {
  const q = req.query as any;
  const branchId = req.scopedBranchId || q.branchId;
  const data = await getRevenueChart(req.user!.tenantId!, q.days ?? 7, branchId);
  return { data };
}

export async function handleRevenueTrend(req: FastifyRequest, reply: FastifyReply) {
  const q = req.query as any;
  const branchId = req.scopedBranchId || q.branchId;
  const period = q.period || 'today';
  const data = await getRevenueTrend(req.user!.tenantId!, branchId, period);
  return data;
}

export async function handleTopItems(req: FastifyRequest, reply: FastifyReply) {
  const q = req.query as any;
  const branchId = req.scopedBranchId || q.branchId;
  const data = await getTopItems(req.user!.tenantId!, q.date ?? 'today', branchId);
  return { data };
}
export async function handleBranches(req: FastifyRequest, reply: FastifyReply) {
  const data = await getBranchPerformance(req.user!.tenantId!, req.scopedBranchId ?? undefined);
  return { data };
}

export async function handleAnalyticsSummary(req: FastifyRequest, reply: FastifyReply) {
  const q = req.query as any;
  const branchId = req.scopedBranchId || q.branchId;
  const data = await getAnalyticsSummary(req.user!.tenantId!, branchId, q.from, q.to);
  return data;
}
