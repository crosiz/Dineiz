import { FastifyRequest, FastifyReply } from 'fastify';
import {
  getKdsDashboard,
  getKdsHistory, getKdsStats,
  markItemReady,
  startOrder, bumpOrder, recallOrder, deliverOrder, cancelOrderKds,
} from './kds.service';

export async function handleGetKdsDashboard(req: FastifyRequest, reply: FastifyReply) {
  const q = req.query as any;
  const user = req.user!;
  // BRANCH_MANAGER: always use their own branchId
  const branchId = user.role === 'BRANCH_MANAGER'
    ? user.branchId!
    : (q.branchId as string);
  if (!branchId) {
    return reply.status(400).send({ error: 'branchId is required' });
  }
  return getKdsDashboard(user.tenantId!, branchId, q.stationId);
}

export async function handleGetHistory(req: FastifyRequest, reply: FastifyReply) {
  const q = req.query as any;
  const branchId = (req as any).scopedBranchId || q.branchId;
  return getKdsHistory(req.user!.tenantId!, branchId, q.limit ?? 30);
}

export async function handleGetStats(req: FastifyRequest, reply: FastifyReply) {
  const q = req.query as any;
  const branchId = (req as any).scopedBranchId || q.branchId;
  return getKdsStats(req.user!.tenantId!, branchId, q.shiftId);
}

export async function handleMarkItemReady(req: FastifyRequest, reply: FastifyReply) {
  const { itemId } = req.params as any;
  return markItemReady(req.user!.tenantId!, itemId);
}

export async function handleStartOrder(req: FastifyRequest, reply: FastifyReply) {
  let { id } = req.params as any;
  if (id.includes('-add-')) id = id.split('-add-')[0];
  return startOrder(req.user!.tenantId!, id);
}

export async function handleBumpOrder(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const tenantId = req.user!.tenantId!;
  const order = await bumpOrder(tenantId, id);

  if (order.tableId) {
    // A delayed kitchen retry must not overwrite a paid or cleaned table.
    const { recomputeTableStatus } = await import('../../lib/tableStatus.js');
    await recomputeTableStatus(tenantId, order.tableId);
  }

  return order;
}

export async function handleRecallOrder(req: FastifyRequest, reply: FastifyReply) {
  let { id } = req.params as any;
  if (id.includes('-add-')) id = id.split('-add-')[0];
  return recallOrder(req.user!.tenantId!, id);
}

export async function handleDeliverOrder(req: FastifyRequest, reply: FastifyReply) {
  let { id } = req.params as any;
  if (id.includes('-add-')) id = id.split('-add-')[0];
  return deliverOrder(req.user!.tenantId!, id);
}

export async function handleCancelOrder(req: FastifyRequest, reply: FastifyReply) {
  let { id } = req.params as any;
  if (id.includes('-add-')) id = id.split('-add-')[0];
  const body = req.body as any;
  return cancelOrderKds(req.user!.tenantId!, id, body.reason);
}
