import { FastifyRequest, FastifyReply } from 'fastify';
import { getDashboardSummary, getRevenueTrend, getTopBranches, getTopItems, getTenantAlerts, getRecentOrders } from './tenant-dashboard.service';

export async function handleSummary(req: FastifyRequest, reply: FastifyReply) {
  return getDashboardSummary(req.user!.tenantId!, req.scopedBranchId ?? undefined);
}
export async function handleRevenue(req: FastifyRequest, reply: FastifyReply) {
  const rawPeriod = (req.query as any).period || '7d';
  const days = parseInt(String(rawPeriod)) || 7;
  const data = await getRevenueTrend(req.user!.tenantId!, days, req.scopedBranchId ?? undefined);
  return { data };
}
export async function handleTopBranches(req: FastifyRequest, reply: FastifyReply) {
  const data = await getTopBranches(req.user!.tenantId!, req.scopedBranchId ?? undefined);
  return { data };
}
export async function handleTopItems(req: FastifyRequest, reply: FastifyReply) {
  const data = await getTopItems(req.user!.tenantId!, req.scopedBranchId ?? undefined);
  return { data };
}
export async function handleAlerts(req: FastifyRequest, reply: FastifyReply) {
  const data = await getTenantAlerts(req.user!.tenantId!);
  return { data };
}
export async function handleRecentOrders(req: FastifyRequest, reply: FastifyReply) {
  const query = req.query as any;
  const limit = Math.min(Number(query?.limit) || 10, 50);
  const data = await getRecentOrders(req.user!.tenantId!, limit);
  return { data };
}

