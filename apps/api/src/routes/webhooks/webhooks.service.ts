import { prisma } from '@dineiz/db';
import { enqueueCustomWebhookEvent } from '../../lib/webhooks';

export async function listWebhooks(tenantId: string) {
  return prisma.webhookEndpoint.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' }
  });
}

export async function createWebhook(tenantId: string, data: any) {
  return prisma.webhookEndpoint.create({
    data: {
      tenantId,
      url: data.url,
      secret: data.secret,
      events: JSON.stringify(data.events || []),
      isActive: data.isActive !== undefined ? data.isActive : true,
    }
  });
}

export async function updateWebhook(id: string, tenantId: string, data: any) {
  return prisma.webhookEndpoint.update({
    where: { id, tenantId },
    data: {
      url: data.url,
      secret: data.secret,
      events: data.events ? JSON.stringify(data.events) : undefined,
      isActive: data.isActive,
      status: data.isActive ? 'ACTIVE' : undefined
    }
  });
}

export async function deleteWebhook(id: string, tenantId: string) {
  await prisma.webhookEndpoint.delete({
    where: { id, tenantId }
  });
}

export async function getWebhookDeliveries(webhookId: string, tenantId: string) {
  // ensure the webhook belongs to the tenant
  const webhook = await prisma.webhookEndpoint.findUnique({
    where: { id: webhookId, tenantId }
  });
  if (!webhook) throw new Error('Webhook not found');

  return prisma.webhookDelivery.findMany({
    where: { webhookId },
    orderBy: { triggeredAt: 'desc' },
    take: 100
  });
}

export async function testWebhook(id: string, tenantId: string) {
  const webhook = await prisma.webhookEndpoint.findUnique({
    where: { id, tenantId }
  });
  if (!webhook) throw new Error('Webhook not found');

  // Emit a test event directly
  await enqueueCustomWebhookEvent({
    tenantId,
    event: 'ping',
    payload: { message: 'This is a test webhook payload from Dineiz.' }
  });
  
  return { success: true };
}

export async function retryDelivery(deliveryId: string, tenantId: string) {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { webhookEndpoint: true }
  });

  if (!delivery || delivery.webhookEndpoint.tenantId !== tenantId) {
    throw new Error('Delivery not found');
  }

  // Enqueue it again manually by pretending it's a new event
  const { webhooksQueue } = await import('../../lib/queue.js');
  await webhooksQueue.add('custom.deliver', {
    webhookId: delivery.webhookId,
    event: delivery.event,
    payload: JSON.parse(delivery.payload).data
  });

  return { success: true };
}
