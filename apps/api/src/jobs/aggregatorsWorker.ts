import { Worker } from 'bullmq';
import { prisma } from '@dineiz/db';
import { handleWebhookPayload } from '../routes/aggregators/aggregators.service';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379');

export const aggregatorsWorker = new Worker('aggregators-webhook-queue', async (job) => {
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
    throw new Error(`Failed to process webhook: ${error.message}`);
  }
}, { connection });

aggregatorsWorker.on('failed', async (job, err) => {
  if (job && job.attemptsMade === job.opts.attempts) {
    if (job.data.eventId) {
      await prisma.aggregatorWebhookEvent.update({
        where: { id: job.data.eventId },
        data: { processError: err.message }
      });
    }
  }
});
