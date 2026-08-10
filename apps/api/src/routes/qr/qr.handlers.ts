import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getSettings, saveSettings, handleCreateOrder } from './qr.service';

export async function getQrSettings(request: FastifyRequest, reply: FastifyReply) {
  const tenantId = request.user?.tenantId;
  if (!tenantId) return reply.status(401).send({ error: 'Unauthorized' });
  const settings = await getSettings(tenantId);
  return reply.send({ settings });
}

export async function updateQrSettings(request: FastifyRequest, reply: FastifyReply) {
  const tenantId = request.user?.tenantId;
  if (!tenantId) return reply.status(401).send({ error: 'Unauthorized' });
  const data = request.body as any;
  const settings = await saveSettings(tenantId, data);
  return reply.send({ settings });
}

const createOrderSchema = z.object({
  tenantId: z.string(),
  branchId: z.string(),
  tableId: z.string(),
  customerName: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    itemId: z.string(),
    quantity: z.number().int().min(1),
    notes: z.string().optional()
  })),
  paymentMethod: z.enum(['CASH', 'ONLINE']).optional()
});

export async function createQrOrder(request: FastifyRequest, reply: FastifyReply) {
  const parsed = createOrderSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error });
  }
  
  const order = await handleCreateOrder(parsed.data);
  return reply.status(201).send({ order });
}
