import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { prisma } from '@dineiz/db';
import { requireRole, requireTenant } from '../../middleware/auth';
import { webhooksQueue, erpSyncQueue } from '../../lib/queue';
import { z } from 'zod';

const ZapierSubscriptionCreate = z.object({
  event: z.string().min(1),
  url: z.string().url(),
  secret: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

const ZapierSubscriptionUpdate = ZapierSubscriptionCreate.partial();

const ErpConfigSchema = z.object({
  provider: z.enum(['ERPNEXT', 'QUICKBOOKS']),
  baseUrl: z.string().url().optional(),
  apiKey: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
});

export const integrationsRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // -----------------------
  // Zapier subscriptions
  // -----------------------
  fastify.get('/api/integrations/zapier/subscriptions', {
    schema: { response: { 200: z.any() } },
    preHandler: requireTenant,
  }, async (request) => {
    const tenantId = request.user!.tenantId!;
    return prisma.zapierWebhookSubscription.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
  });

  fastify.post('/api/integrations/zapier/subscriptions', {
    schema: { body: ZapierSubscriptionCreate, response: { 201: z.any(), 400: z.any(), 401: z.any(), 403: z.any() } },
    preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN']),
  }, async (request, reply) => {
    const tenantId = request.user!.tenantId!;
    const body = request.body as z.infer<typeof ZapierSubscriptionCreate>;
    const created = await prisma.zapierWebhookSubscription.create({
      data: {
        tenantId,
        event: body.event,
        url: body.url,
        secret: body.secret ?? null,
        isActive: body.isActive ?? true,
      },
    });
    return reply.status(201).send(created);
  });

  fastify.put('/api/integrations/zapier/subscriptions/:id', {
    schema: { params: z.object({ id: z.string() }), body: ZapierSubscriptionUpdate, response: { 200: z.any(), 400: z.any(), 401: z.any(), 403: z.any() } },
    preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN']),
  }, async (request) => {
    const tenantId = request.user!.tenantId!;
    const params = request.params as { id: string };
    const body = request.body as z.infer<typeof ZapierSubscriptionUpdate>;
    return prisma.zapierWebhookSubscription.update({
      where: { id: params.id, tenantId },
      data: {
        ...(body.event && { event: body.event }),
        ...(body.url && { url: body.url }),
        ...(body.secret !== undefined && { secret: body.secret ?? null }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
    });
  });

  fastify.delete('/api/integrations/zapier/subscriptions/:id', {
    schema: { params: z.object({ id: z.string() }), response: { 200: z.any(), 401: z.any(), 403: z.any() } },
    preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN']),
  }, async (request) => {
    const tenantId = request.user!.tenantId!;
    const params = request.params as { id: string };
    await prisma.zapierWebhookSubscription.delete({ where: { id: params.id, tenantId } });
    return { ok: true };
  });

  // Fire a test delivery to a specific subscription
  fastify.post('/api/integrations/zapier/subscriptions/:id/test', {
    schema: { params: z.object({ id: z.string() }), response: { 200: z.any(), 401: z.any(), 403: z.any() } },
    preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN']),
  }, async (request) => {
    const tenantId = request.user!.tenantId!;
    const params = request.params as { id: string };
    const sub = await prisma.zapierWebhookSubscription.findFirst({ where: { id: params.id, tenantId } });
    if (!sub) return { queued: false };

    const job = await webhooksQueue.add('zapier.deliver', {
      subscriptionId: sub.id,
      payload: { type: 'test', event: sub.event, timestamp: new Date().toISOString() },
    }, { attempts: 5, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: true, removeOnFail: true });

    return { queued: true, jobId: job.id };
  });

  // -----------------------
  // ERP integration config
  // -----------------------
  fastify.get('/api/integrations/erp', {
    schema: { response: { 200: z.any() } },
    preHandler: requireTenant,
  }, async (request) => {
    const tenantId = request.user!.tenantId!;
    return prisma.erpIntegration.findUnique({ where: { tenantId } });
  });

  fastify.put('/api/integrations/erp', {
    schema: { body: ErpConfigSchema, response: { 200: z.any(), 400: z.any(), 401: z.any(), 403: z.any() } },
    preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN']),
  }, async (request) => {
    const tenantId = request.user!.tenantId!;
    const body = request.body as z.infer<typeof ErpConfigSchema>;
    return prisma.erpIntegration.upsert({
      where: { tenantId },
      create: {
        tenantId,
        provider: body.provider,
        baseUrl: body.baseUrl,
        apiKey: body.apiKey,
        enabled: body.enabled ?? false,
      },
      update: {
        provider: body.provider,
        ...(body.baseUrl !== undefined && { baseUrl: body.baseUrl }),
        ...(body.apiKey !== undefined && { apiKey: body.apiKey }),
        ...(body.enabled !== undefined && { enabled: body.enabled }),
      },
    });
  });

  fastify.post('/api/integrations/erp/sync', {
    schema: { response: { 200: z.any() } },
    preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN']),
  }, async (request) => {
    const tenantId = request.user!.tenantId!;
    const job = await erpSyncQueue.add('erp.sync', { tenantId }, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
      removeOnFail: true,
    });
    return { queued: true, jobId: job.id };
  });
};


