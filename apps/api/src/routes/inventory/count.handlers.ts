import { FastifyRequest, FastifyReply } from 'fastify';
import * as svc from './count.service';

function actor(req: FastifyRequest) {
  return { id: req.user!.id, name: req.user!.name };
}

export async function handleGetCounts(req: FastifyRequest, reply: FastifyReply) {
  const q = req.query as any;
  const branchId = req.scopedBranchId || q.branchId;
  return svc.getCounts(req.user!.tenantId!, { ...q, branchId });
}

export async function handleGetCountById(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const c = await svc.getCountById(req.user!.tenantId!, id);
  if (!c) return reply.status(404).send({ error: 'Count session not found' });
  return c;
}

export async function handleStartCount(req: FastifyRequest, reply: FastifyReply) {
  const count = await svc.startCount(req.user!.tenantId!, req.body as any, actor(req));
  return reply.status(201).send(count);
}

export async function handleUpdateCountLine(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const { ingredientId, countedQty, notes } = req.body as any;
  try {
    const line = await svc.updateCountLine(req.user!.tenantId!, id, ingredientId, { countedQty, notes }, actor(req));
    if (!line) return reply.status(404).send({ error: 'Count session not found' });
    return line;
  } catch (e: any) {
    return reply.status(400).send({ error: e.message });
  }
}

export async function handleCompleteCount(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  try {
    const result = await svc.completeCount(req.user!.tenantId!, id, req.body as any, actor(req));
    if (!result) return reply.status(404).send({ error: 'Count session not found' });
    return result;
  } catch (e: any) {
    return reply.status(400).send({ error: e.message });
  }
}

export async function handleCancelCount(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  try {
    const result = await svc.cancelCount(req.user!.tenantId!, id);
    if (!result) return reply.status(404).send({ error: 'Count session not found' });
    return result;
  } catch (e: any) {
    return reply.status(400).send({ error: e.message });
  }
}

export async function handleVarianceReport(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const report = await svc.getVarianceReport(req.user!.tenantId!, id);
  if (!report) return reply.status(404).send({ error: 'Count session not found' });
  return report;
}
