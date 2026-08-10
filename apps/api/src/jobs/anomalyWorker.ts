import { prisma } from '@dineiz/db';
import { createAnomalyIfNotExists } from '../routes/anomalies/anomaly.service';
import { Worker, Job } from 'bullmq';
import { anomalyQueue } from '../lib/queue';
import { AnomalyType } from '@prisma/client';

export async function detectAnomalies(tenantId: string, branchId: string) {
  const startOfToday = new Date(); 
  startOfToday.setHours(0, 0, 0, 0);

  // ── 1. Detect excessive voids per cashier ──────────────────────────────────
  // Uses VoidRequest model (has tenantId, branchId, cashierId, createdAt)
  const voidRequests = await prisma.voidRequest.groupBy({
    by: ['cashierId'],
    where: {
      tenantId,
      branchId,
      createdAt: { gte: startOfToday }
    },
    _count: { _all: true }
  });

  for (const row of voidRequests) {
    if (row._count._all > 5) {
      // Resolve the cashier name
      const cashier = await prisma.user.findUnique({
        where: { id: row.cashierId },
        select: { name: true }
      });
      await createAnomalyIfNotExists({
        tenantId,
        branchId,
        type: 'EXCESSIVE_VOIDS' as AnomalyType,
        severity: 'HIGH',
        description: `${cashier?.name ?? row.cashierId} submitted ${row._count._all} void requests today`,
        affectedUserId: row.cashierId,
        affectedEntityId: row.cashierId
      });
    }
  }

  // ── 2. Detect large cash variances from closed shifts ─────────────────────
  // Shift model has: tenantId, branchId, status, closedAt, cashVariance, userId
  const badShifts = await prisma.shift.findMany({
    where: {
      tenantId,
      branchId,
      status: 'CLOSED',
      closedAt: { gte: startOfToday },
      cashVariance: { gt: 500 }  // more than PKR 500 variance
    },
    include: {
      user: { select: { name: true } }
    }
  });

  for (const shift of badShifts) {
    await createAnomalyIfNotExists({
      tenantId,
      branchId,
      type: 'CASH_VARIANCE' as AnomalyType,
      severity: 'CRITICAL',
      description: `Shift by ${shift.user?.name ?? shift.userId} has PKR ${shift.cashVariance} cash variance`,
      affectedEntityId: shift.id
    });
  }

  // ── 3. Detect zero-value completed orders ─────────────────────────────────
  // Order model has: tenantId, branchId, status, netAmount, createdAt
  const zeroOrders = await prisma.order.count({
    where: {
      tenantId,
      branchId,
      status: 'COMPLETED',
      netAmount: 0,
      createdAt: { gte: startOfToday }
    }
  });

  if (zeroOrders > 0) {
    await createAnomalyIfNotExists({
      tenantId,
      branchId,
      type: 'LARGE_DISCOUNT' as AnomalyType,
      severity: 'CRITICAL',
      description: `${zeroOrders} orders completed with Rs. 0 today — possible free-bill abuse`,
      affectedEntityId: `zero-orders-${startOfToday.getTime()}`
    });
  }
}

export async function runAnomalyJob() {
  console.log('[ANOMALY_WORKER] Starting anomaly detection scan...');
  
  try {
    const tenants = await prisma.tenant.findMany({
      where: {
        AnomalySettings: {
          isNot: null
        }
      }
    });

    console.log(`[ANOMALY_WORKER] Found ${tenants.length} tenants with anomaly settings configured.`);

    for (const tenant of tenants) {
      try {
        const branches = await prisma.branch.findMany({ where: { tenantId: tenant.id } });
        for (const branch of branches) {
          await detectAnomalies(tenant.id, branch.id);
        }
      } catch (err) {
        console.error(`[ANOMALY_WORKER] Error scanning for tenant ${tenant.id}:`, err);
      }
    }

    console.log('[ANOMALY_WORKER] Anomaly detection scan completed successfully.');
  } catch (err) {
    console.error('[ANOMALY_WORKER] Critical failure in anomaly job:', err);
  }
}

export const initAnomalyWorker = () => {
  const worker = new Worker('anomalies', async (job: Job) => {
    if (job.name === 'detectAnomalies') {
      await runAnomalyJob();
    }
  }, { 
    connection: anomalyQueue.opts.connection,
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 }
  });

  worker.on('failed', (job, err) => {
    console.error(`Anomaly Job failed: ${job?.id}`, err);
  });
};
