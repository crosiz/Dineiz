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
  return t;
}

export async function handleCreateTransfer(req: FastifyRequest, reply: FastifyReply) {
  try {
    const t = await svc.createTransfer(req.user!.tenantId!, req.body as any, actor(req));
    return reply.status(201).send(t);
  } catch (e: any) {
    return reply.status(400).send({ error: e.message });
  }
}

export async function handleDispatchTransfer(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
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
  try {
    const t = await svc.cancelTransfer(req.user!.tenantId!, id);
    if (!t) return reply.status(404).send({ error: 'Transfer not found' });
    return t;
  } catch (e: any) {
    return reply.status(400).send({ error: e.message });
  }
}
