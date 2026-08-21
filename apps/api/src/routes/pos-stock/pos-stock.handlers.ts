import { FastifyRequest, FastifyReply } from 'fastify';
import * as svc from './pos-stock.service';

export async function handleGetStockStatus(req: FastifyRequest, reply: FastifyReply) {
  const q = req.query as any;
  const branchId = req.scopedBranchId || q.branchId;
  if (!branchId) return reply.status(400).send({ error: 'branchId is required' });
  return svc.getStockStatus(req.user!.tenantId!, branchId);
}

export async function handleQuickAdjust(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as any;
  const branchId = req.scopedBranchId || body.branchId;
  if (!branchId) return reply.status(400).send({ error: 'branchId is required' });
  try {
    const result = await svc.quickAdjustStock(req.user!.tenantId!, branchId, body, { id: req.user!.id, name: req.user!.name });
    return result;
  } catch (e: any) {
    return reply.status(400).send({ error: e.message });
  }
}

export async function handleNotifyManager(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as any;
  const branchId = req.scopedBranchId || body.branchId;
  if (!branchId) return reply.status(400).send({ error: 'branchId is required' });
  try {
    const result = await svc.notifyManagerLowStock(req.user!.tenantId!, branchId, body, { name: req.user!.name });
    return result;
  } catch (e: any) {
    return reply.status(400).send({ error: e.message });
  }
}
