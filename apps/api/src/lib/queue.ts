import { Queue, Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { syncCustomersToMeili, syncMenuToMeili } from '../jobs/meiliSync';
import { runBirthdayRewardsJob } from '../jobs/birthdayRewards';
import { deliverZapierWebhook } from '../jobs/zapier';
import { runErpSync } from '../jobs/erpSync';
import { runAnalyticsAggregationJob } from '../jobs/analyticsSync';
import { runReportsJob } from '../jobs/reportsWorker';
import { runAnomalyJob } from '../jobs/anomalyWorker';
import { runForecastGeneration } from '../jobs/forecastWorker';
import { runCustomersSegmentsJob } from '../jobs/customersWorker';

// Shared Redis connection for BullMQ
const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Define queues here
export const defaultQueue = new Queue('default', { connection });
export const meiliSyncQueue = new Queue('meili-sync', { connection });
export const rewardsQueue = new Queue('rewards', { connection });

// Custom exponential backoff for Webhooks: 5m, 30m, 2h, 8h, 24h
const WEBHOOK_DELAYS = [5 * 60, 30 * 60, 2 * 3600, 8 * 3600, 24 * 3600].map(s => s * 1000);
export const webhooksQueue = new Queue('webhooks', { 
  connection,
  defaultJobOptions: {
    attempts: WEBHOOK_DELAYS.length + 1,
    backoff: {
      type: 'custom',
    },
  },
  settings: {
    backoffStrategies: {
      custom: (attemptsMade: number) => {
        // attemptsMade is the number of attempts ALREADY made.
        // For the first retry, attemptsMade is 1. We want the 0th delay (5m).
        const delay = WEBHOOK_DELAYS[attemptsMade - 1];
        return delay || -1; // -1 means do not retry anymore
      }
    }
  }
});
export const erpSyncQueue = new Queue('erp-sync', { connection });
export const analyticsQueue = new Queue('analytics', { connection });
export const reportsQueue = new Queue('reports', { connection });
export const anomalyQueue = new Queue('anomalies', { connection });
export const forecastQueue = new Queue('forecast', { connection });
export const aggregatorsQueue = new Queue('aggregators', { connection });
export const customersQueue = new Queue('customers', { connection });

// Export a generic function to create new workers easily
export function createWorker(queueName: string, processor: any) {
  return new Worker(queueName, processor, { connection });
}

// Export a generic function to monitor queue events
export function createQueueEvents(queueName: string) {
  return new QueueEvents(queueName, { connection });
}

console.log('BullMQ initialized with Redis connection');

// Meilisearch sync worker (Task 64)
createWorker('meili-sync', async (job: any) => {
  const { tenantId, entities } = job.data as { tenantId: string; entities?: Array<'menu' | 'customers'> };
  const targets = entities && entities.length ? entities : (['menu', 'customers'] as const);

  const out: any = {};
  for (const t of targets) {
    if (t === 'menu') out.menu = await syncMenuToMeili(tenantId);
    if (t === 'customers') out.customers = await syncCustomersToMeili(tenantId);
  }
  return out;
});

// Birthday rewards worker (Task 68)
createWorker('rewards', async (job: any) => {
  const { tenantId } = job.data as { tenantId: string };
  return runBirthdayRewardsJob({ tenantId });
});

import { deliverCustomWebhook } from '../jobs/webhook.worker';

// Webhooks deliveries (Task 87)
createWorker('webhooks', async (job: any) => {
  if (job.name === 'zapier.deliver') {
    const { subscriptionId, payload } = job.data as { subscriptionId: string; payload: any };
    return deliverZapierWebhook({ subscriptionId, payload });
  } else if (job.name === 'custom.deliver') {
    const { webhookId, event, payload } = job.data as { webhookId: string; event: string; payload: any };
    return deliverCustomWebhook({ webhookId, event, payload });
  }
});

// ERP sync (Task 86)
createWorker('erp-sync', async (job: any) => {
  const { tenantId } = job.data as { tenantId: string };
  return runErpSync({ tenantId });
});

// Analytics Aggregation Worker
createWorker('analytics', async (job: any) => {
  const { tenantId, branchId, date } = job.data as { tenantId: string; branchId: string; date: string };
  return runAnalyticsAggregationJob(tenantId, branchId, new Date(date));
});

// Reports Generation Worker
createWorker('reports', async (job: any) => {
  return runReportsJob();
});

// Anomalies Detection Worker
createWorker('anomalies', async (job: any) => {
  return runAnomalyJob();
});

// Forecast Generation Worker
createWorker('forecast', async (job: any) => {
  return runForecastGeneration();
});

// Customers CRM Worker
createWorker('customers', async (job: any) => {
  return runCustomersSegmentsJob();
});

// Aggregator Webhook Worker
import { handleWebhookPayload } from '../routes/aggregators/aggregators.service';
import { prisma } from '@dineiz/db';

createWorker('aggregators', async (job: any) => {
  const { eventId } = job.data;
  
  const event = await prisma.aggregatorWebhookEvent.findUnique({
    where: { id: eventId }
  });

  if (!event || event.processedAt) return;

  try {
    await handleWebhookPayload(event);
    await prisma.aggregatorWebhookEvent.update({
      where: { id: eventId },
      data: { processedAt: new Date() }
    });
  } catch (error: any) {
    await prisma.aggregatorWebhookEvent.update({
      where: { id: eventId },
      data: { processError: error.message }
    });
    throw new Error(`Failed to process webhook: ${error.message}`);
  }
});
