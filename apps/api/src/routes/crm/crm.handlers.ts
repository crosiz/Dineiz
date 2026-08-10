import { FastifyRequest, FastifyReply } from 'fastify';
import { listCustomers, createCustomer, getCustomer, adjustPoints } from './crm.service';

export async function handleListCustomers(req: FastifyRequest, reply: FastifyReply) {
  return listCustomers(req.user!.tenantId!, req.query as any);
}
export async function handleCreateCustomer(req: FastifyRequest, reply: FastifyReply) {
  const created = await createCustomer(req.user!.tenantId!, req.body as any);
  return reply.status(201).send(created);
}
export async function handleGetCustomer(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const result = await getCustomer(req.user!.tenantId!, id);
  if (!result) return reply.status(404).send({ error: 'Customer not found' });
  return result;
}
export async function handleAdjustPoints(req: FastifyRequest, reply: FastifyReply) {
  try {
    const entry = await adjustPoints(req.user!.tenantId!, req.body as any);
    return reply.status(201).send(entry);
  } catch (err: any) {
    if (err.status === 400) return reply.status(400).send({ error: err.message });
    throw err;
  }
}
