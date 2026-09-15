import { FastifyRequest, FastifyReply } from 'fastify';
import * as svc from './transfer.service';

function actor(req: FastifyRequest) {
  return { id: req.user!.id, name: req.user!.name };
}

export async function handleGetTransfers(req: FastifyRequest, reply: FastifyReply) {
  const q = req.query as any;
  const branchId = req.scopedBranchId || q.branchId;
  return svc.getTransfers(req.user!.tenantId!, { ...q, branchId });
}

export async function handleGetTransferById(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const t = await svc.getTransferById(req.user!.tenantId!, id);
  if (!t) return reply.status(404).send({ error: 'Transfer not found' });
  if (req.scopedBranchId && t.fromBranchId !== req.scopedBranchId && t.toBranchId !== req.scopedBranchId) {
    return reply.status(403).send({ error: 'This transfer belongs to a different branch' });
  }
  return t;
}

export async function handleCreateTransfer(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as any;
  if (req.scopedBranchId && body.fromBranchId !== req.scopedBranchId && body.toBranchId !== req.scopedBranchId) {
    return reply.status(403).send({ error: 'You can only create transfers involving your own branch' });
  }
  try {
    const t = await svc.createTransfer(req.user!.tenantId!, body, actor(req));
    return reply.status(201).send(t);
  } catch (e: any) {
    return reply.status(400).send({ error: e.message });
  }
}

export async function handleDispatchTransfer(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const existing = await svc.getTransferById(req.user!.tenantId!, id);
  if (!existing) return reply.status(404).send({ error: 'Transfer not found' });
  if (req.scopedBranchId && existing.fromBranchId !== req.scopedBranchId) {
    return reply.status(403).send({ error: 'Only the sending branch can dispatch this transfer' });
  }
  try {
    const t = await svc.dispatchTransfer(req.user!.tenantId!, id, req.body as any, actor(req));
    if (!t) return reply.status(404).send({ error: 'Transfer not found' });
    return t;
  } catch (e: any) {
    return reply.status(400).send({ error: e.message });
  }
}

export async function handleReceiveTransfer(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const existing = await svc.getTransferById(req.user!.tenantId!, id);
  if (!existing) return reply.status(404).send({ error: 'Transfer not found' });
  if (req.scopedBranchId && existing.toBranchId !== req.scopedBranchId) {
    return reply.status(403).send({ error: 'Only the receiving branch can receive this transfer' });
  }
  try {
    const t = await svc.receiveTransfer(req.user!.tenantId!, id, req.body as any, actor(req));
    if (!t) return reply.status(404).send({ error: 'Transfer not found' });
    return t;
  } catch (e: any) {
    return reply.status(400).send({ error: e.message });
  }
}

export async function handleCancelTransfer(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const existing = await svc.getTransferById(req.user!.tenantId!, id);
  if (!existing) return reply.status(404).send({ error: 'Transfer not found' });
  if (req.scopedBranchId && existing.fromBranchId !== req.scopedBranchId && existing.toBranchId !== req.scopedBranchId) {
    return reply.status(403).send({ error: 'This transfer belongs to a different branch' });
  }
  try {
    const t = await svc.cancelTransfer(req.user!.tenantId!, id);
    if (!t) return reply.status(404).send({ error: 'Transfer not found' });
    return t;
  } catch (e: any) {
    return reply.status(400).send({ error: e.message });
  }
}
