import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma, AggregatorProvider } from '@swiftserve/db';
import { handleWebhookPayload } from './aggregators.service';
import { aggregatorsQueue } from '../../lib/queue';
import { z } from 'zod';
import crypto from 'crypto';

export async function handleListIntegrations(request: FastifyRequest, reply: FastifyReply) {
  const tenantId = request.user!.tenantId!;
  
  const integrations = await prisma.aggregatorIntegration.findMany({
    where: { tenantId }
  });
  
  return reply.send({ integrations });
}

export async function handleSaveIntegration(request: FastifyRequest, reply: FastifyReply) {
  const tenantId = request.user!.tenantId!;
  
  const schema = z.object({
    provider: z.nativeEnum(AggregatorProvider),
    status: z.enum(['CONNECTED', 'DISCONNECTED', 'DEGRADED']).optional(),
    restaurantId: z.string().optional().nullable(),
    apiKey: z.string().optional().nullable(),
    autoAccept: z.boolean().optional(),
    defaultPrepTime: z.number().optional(),
    branchId: z.string().optional().nullable(),
  });
  
  const parsed = schema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error });
  const data = parsed.data;

  const integration = await prisma.aggregatorIntegration.upsert({
    where: { tenantId_provider: { tenantId, provider: data.provider } },
    update: { ...data },
    create: { 
      tenantId, 
      ...data,
      webhookSecret: crypto.randomBytes(32).toString('hex')
    }
  });

  return reply.send({ integration });
}

export async function handleTestConnection(request: FastifyRequest, reply: FastifyReply) {
  const schema = z.object({
    provider: z.nativeEnum(AggregatorProvider),
    restaurantId: z.string().min(1),
    apiKey: z.string().min(1)
  });

  const parsed = schema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error });

  // Mocking the real API call for now. In a real integration, we'd hit the Foodpanda/Careem API here.
  // if (parsed.data.provider === 'foodpanda') { ... }
  
  // Simulate network delay
  await new Promise(res => setTimeout(res, 800));

  return reply.send({ success: true, message: 'Connection successful' });
}

export async function handleListMappings(request: FastifyRequest, reply: FastifyReply) {
  const tenantId = request.user!.tenantId!;
  const { provider } = request.params as { provider: AggregatorProvider };

  const mappings = await prisma.aggregatorMenuMapping.findMany({
    where: { tenantId, provider },
    include: { item: true }
  });
  
  return reply.send({ mappings });
}

export async function handleSaveMappings(request: FastifyRequest, reply: FastifyReply) {
  const tenantId = request.user!.tenantId!;
  const { provider } = request.params as { provider: AggregatorProvider };
  
  const schema = z.array(z.object({
    aggregatorItemId: z.string(),
    aggregatorItemName: z.string(),
    itemId: z.string().nullable(),
    priceModifier: z.number().nullable().optional()
  }));

  const parsed = schema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error });

  const results = await prisma.$transaction(
    parsed.data.map(mapping => 
      prisma.aggregatorMenuMapping.upsert({
        where: { tenantId_provider_aggregatorItemId: { tenantId, provider, aggregatorItemId: mapping.aggregatorItemId } },
        update: { itemId: mapping.itemId, aggregatorItemName: mapping.aggregatorItemName, priceModifier: mapping.priceModifier },
        create: { tenantId, provider, ...mapping }
      })
    )
  );
  
  return reply.send({ mappings: results });
}

const WebhookSchema = z.object({
  tenantId: z.string().min(1),
  provider: z.nativeEnum(AggregatorProvider),
  event: z.string().min(1),
  data: z.any(),
});

export async function handleWebhook(request: FastifyRequest, reply: FastifyReply) {
  const secret = request.headers['x-bridge-secret'];
  if (!process.env.BRIDGE_SECRET || secret !== process.env.BRIDGE_SECRET) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  const parsed = WebhookSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: 'Invalid payload' });

  const body = parsed.data;
  
  const saved = await prisma.aggregatorWebhookEvent.create({
    data: {
      tenantId: body.tenantId,
      provider: body.provider,
      event: body.event,
      payload: body,
    },
  });

  request.log.info({ id: saved.id, tenantId: saved.tenantId, provider: saved.provider, event: saved.event }, 'Aggregator webhook received');

  try {
    await handleWebhookPayload(saved);
    await prisma.aggregatorWebhookEvent.update({
      where: { id: saved.id },
      data: { processedAt: new Date() }
    });
  } catch (error: any) {
    request.log.error(error, 'Error processing aggregator webhook inline');
    await prisma.aggregatorWebhookEvent.update({
      where: { id: saved.id },
      data: { processError: error.message }
    });
    
    // Retry via BullMQ
    await aggregatorsQueue.add('process-webhook', { eventId: saved.id }, {
      attempts: 3,
      backoff: { type: 'fixed', delay: 5 * 60 * 1000 }
    });
  }

  return { ok: true, id: saved.id };
}
