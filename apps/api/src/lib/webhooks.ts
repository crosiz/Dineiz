import { prisma } from '@swiftserve/db';
import { webhooksQueue } from './queue';

export async function enqueueZapierEvent(params: { tenantId: string; event: string; payload: any }) {
  const subs = await prisma.zapierWebhookSubscription.findMany({
    where: { tenantId: params.tenantId, event: params.event, isActive: true },
    select: { id: true },
  });

  const jobs = await Promise.all(subs.map((s) => {
    return webhooksQueue.add('zapier.deliver', {
      subscriptionId: s.id,
      payload: {
        event: params.event,
        tenantId: params.tenantId,
        timestamp: new Date().toISOString(),
        data: params.payload,
      },
    }, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: true,
      removeOnFail: true,
    });
  }));

  return { queued: jobs.length };
}

export async function enqueueCustomWebhookEvent(params: { tenantId: string; event: string; payload: any }) {
  // Find webhooks subscribed to this event or all events (if we supported wildcard, but for now just exact match inside JSON array)
  // Since `events` is a JSON string of array of strings, we need to query appropriately.
  // In Prisma SQLite/PostgreSQL, we can do string contains for a quick workaround if no native JSON search is easily available.
  const webhooks = await prisma.webhookEndpoint.findMany({
    where: { 
      tenantId: params.tenantId, 
      isActive: true,
      status: 'ACTIVE'
    }
  });

  const matchedWebhooks = webhooks.filter(w => {
    try {
      const events = JSON.parse(w.events) as string[];
      return events.includes(params.event);
    } catch {
      return false;
    }
  });

  const jobs = await Promise.all(matchedWebhooks.map((w) => {
    return webhooksQueue.add('custom.deliver', {
      webhookId: w.id,
      event: params.event,
      payload: params.payload
    }, {
      // The backoff is already configured at the queue level in queue.ts
      removeOnComplete: true,
      removeOnFail: false, // Keep failed jobs for inspection if needed
    });
  }));

  return { queued: jobs.length };
}

