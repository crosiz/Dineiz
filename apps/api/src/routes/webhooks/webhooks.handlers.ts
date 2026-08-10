import { FastifyRequest, FastifyReply } from 'fastify';
import * as service from './webhooks.service';
import { z } from 'zod';

export async function listWebhooks(req: FastifyRequest, reply: FastifyReply) {
  const tenantId = req.user!.tenantId!;
  const list = await service.listWebhooks(tenantId);
  return list;
}

export async function createWebhook(req: FastifyRequest, reply: FastifyReply) {
  const tenantId = req.user!.tenantId!;
  const webhook = await service.createWebhook(tenantId, req.body);
  return webhook;
}

export async function updateWebhook(req: FastifyRequest, reply: FastifyReply) {
  const tenantId = req.user!.tenantId!;
  const { id } = req.params as { id: string };
  const webhook = await service.updateWebhook(id, tenantId, req.body);
  return webhook;
}

export async function deleteWebhook(req: FastifyRequest, reply: FastifyReply) {
  const tenantId = req.user!.tenantId!;
  const { id } = req.params as { id: string };
  await service.deleteWebhook(id, tenantId);
  return { success: true };
}

export async function getWebhookDeliveries(req: FastifyRequest, reply: FastifyReply) {
  const tenantId = req.user!.tenantId!;
  const { id } = req.params as { id: string };
  const deliveries = await service.getWebhookDeliveries(id, tenantId);
  return deliveries;
}

export async function testWebhook(req: FastifyRequest, reply: FastifyReply) {
  const tenantId = req.user!.tenantId!;
  const { id } = req.params as { id: string };
  const result = await service.testWebhook(id, tenantId);
  return result;
}

export async function retryDelivery(req: FastifyRequest, reply: FastifyReply) {
  const tenantId = req.user!.tenantId!;
  const { deliveryId } = req.params as { deliveryId: string };
  const result = await service.retryDelivery(deliveryId, tenantId);
  return result;
}
