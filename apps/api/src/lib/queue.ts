import { Queue, Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { syncCustomersToMeili, syncMenuToMeili } from '../jobs/meiliSync';
import { runBirthdayRewardsJob } from '../jobs/birthdayRewards';
import { deliverZapierWebhook } from '../jobs/zapier';
import { runErpSync } from '../jobs/erpSync';
import { runAnalyticsAggregationJob } from '../jobs/analyticsSync';
import { runAnomalyJob } from '../jobs/anomalyWorker';
import { runForecastGeneration } from '../jobs/forecastWorker';
import { runCustomersSegmentsJob } from '../jobs/customersWorker';

// Shared Redis connection for BullMQ.
// lazyConnect: don't open this connection until a queue is actually used
// (.add(), a worker polling, etc.) — reduces standing connection count
// against a connection-limited Redis plan when jobs aren't in play.
const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  keepAlive: 10000,
  lazyConnect: true,
});
connection.on('error', (err) => {
  console.error('Redis connection error in queue.ts:', err.message || err);
});

const catchError = <T extends { on: (e: string, cb: (err: any) => void) => any }>(obj: T, name: string): T => {
  obj.on('error', (err) => console.error(`BullMQ error [${name}]:`, err.message || err));
  return obj;
};

// Define queues here
export const defaultQueue = catchError(new Queue('default', { connection }), 'defaultQueue');
export const meiliSyncQueue = catchError(new Queue('meili-sync', { connection }), 'meiliSyncQueue');
export const rewardsQueue = catchError(new Queue('rewards', { connection }), 'rewardsQueue');

// Custom exponential backoff for Webhooks: 5m, 30m, 2h, 8h, 24h
const WEBHOOK_DELAYS = [5 * 60, 30 * 60, 2 * 3600, 8 * 3600, 24 * 3600].map(s => s * 1000);
export const webhooksQueue = catchError(new Queue('webhooks', { 
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
}), 'webhooksQueue');
export const erpSyncQueue = catchError(new Queue('erp-sync', { connection }), 'erpSyncQueue');
export const analyticsQueue = catchError(new Queue('analytics', { connection }), 'analyticsQueue');
export const reportsQueue = catchError(new Queue('reports', { connection }), 'reportsQueue');
export const anomalyQueue = catchError(new Queue('anomalies', { connection }), 'anomalyQueue');
export const forecastQueue = catchError(new Queue('forecast', { connection }), 'forecastQueue');
export const aggregatorsQueue = catchError(new Queue('aggregators', { connection }), 'aggregatorsQueue');
export const customersQueue = catchError(new Queue('customers', { connection }), 'customersQueue');

// Each Worker needs its own dedicated (duplicated) blocking Redis connection,
// so running all of them locally opens ~10 extra connections on top of the
// queues/socket.io/auth clients. Against a connection-limited Redis instance
// (e.g. a shared dev Upstash plan) that's enough to cause thrashing/resets
// across every client sharing it — including the auth session store, which
// has no DB fallback. Set DISABLE_QUEUE_WORKERS=true locally to skip starting
// background job processors when you don't need them (e.g. just testing sign-in/UI).
const workersEnabled = process.env.DISABLE_QUEUE_WORKERS !== 'true';
if (!workersEnabled) {
  console.log('DISABLE_QUEUE_WORKERS=true — skipping background job workers');
}

// Export a generic function to create new workers easily
export function createWorker(queueName: string, processor: any) {
  if (!workersEnabled) {
    return { on: () => {} } as unknown as Worker;
  }
  return catchError(new Worker(queueName, processor, { connection }), `Worker-${queueName}`);
}

// Export a generic function to monitor queue events
export function createQueueEvents(queueName: string) {
  return catchError(new QueueEvents(queueName, { connection }), `QueueEvents-${queueName}`);
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

// Reports Generation Worker — registered in jobs/reportsWorker.ts's
// initReportsWorker() instead (it has proper job-name matching + retry/
// backoff config); this used to be duplicated here as a second, redundant
// consumer of the same 'reports' queue.

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
