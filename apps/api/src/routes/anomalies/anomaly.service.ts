import { prisma } from '@swiftserve/db';
import { AnomalyType, AnomalySeverity, AnomalyStatus } from '@prisma/client';
import { subHours, subMinutes } from 'date-fns';

export async function scanAnomaliesForTenant(tenantId: string) {
  // Get tenant anomaly settings
  const settings = await prisma.anomalySettings.findUnique({
    where: { tenantId }
  });

  if (!settings) return; // No settings = no detection

  const thresholds: any = settings.thresholds || {};
  const toggles: any = settings.toggles || {};

  // For a rolling 24 hours detection
  const since = subHours(new Date(), 24);

  // We'll scan branches
  const branches = await prisma.branch.findMany({ where: { tenantId, isActive: true } });

  for (const branch of branches) {
    if (toggles.CASH_VARIANCE !== false) {
      await scanCashVariance(tenantId, branch.id, since, thresholds.cashVarianceThreshold || 500);
    }
    if (toggles.EXCESSIVE_VOIDS !== false) {
      await scanExcessiveVoids(tenantId, branch.id, since, thresholds.excessiveVoidsCount || 5);
    }
    if (toggles.LARGE_DISCOUNT !== false) {
      await scanLargeDiscounts(tenantId, branch.id, since, thresholds.largeDiscountPct || 25);
    }
    // Additional scanners would go here
  }
}

export async function createAnomalyIfNotExists(data: {
  tenantId: string;
  branchId: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  description: string;
  affectedEntityId: string;
  affectedUserId?: string;
  detectedAt?: Date;
}) {
  const existing = await prisma.anomalyEvent.findFirst({
    where: {
      tenantId: data.tenantId,
      branchId: data.branchId,
      type: data.type,
      affectedEntityId: data.affectedEntityId
    }
  });

  if (!existing) {
    await prisma.anomalyEvent.create({
      data: {
        tenantId: data.tenantId,
        branchId: data.branchId,
        type: data.type,
        severity: data.severity,
        description: data.description,
        affectedEntityId: data.affectedEntityId,
        affectedUserId: data.affectedUserId,
        detectedAt: data.detectedAt || new Date(),
        status: AnomalyStatus.OPEN
      }
    });

    // Notify logic
    await notifyTenant(data.tenantId, data);
  }
}

async function notifyTenant(tenantId: string, event: any) {
  if (event.severity === 'CRITICAL' || event.severity === 'HIGH') {
    const settings = await prisma.anomalySettings.findUnique({ where: { tenantId } });
    if (settings?.notifyPush) {
      console.log(`[PUSH NOTIFICATION] To Tenant Admin: ALERT - ${event.type}: ${event.description}`);
    }
    if (settings?.notifyWhatsapp) {
      console.log(`[WHATSAPP NOTIFICATION] To Tenant Admin: ALERT - ${event.type}: ${event.description}`);
    }
  }
}

async function scanCashVariance(tenantId: string, branchId: string, since: Date, maxVariance: number) {
  const shifts = await prisma.shift.findMany({
    where: {
      tenantId,
      branchId,
      status: 'CLOSED',
      closedAt: { gte: since }
    },
    include: { user: true }
  });

  for (const shift of shifts) {
    const variance = shift.cashVariance || 0;
    if (Math.abs(variance) > maxVariance) {
      const severity = Math.abs(variance) > (maxVariance * 3) ? 'CRITICAL' : 'HIGH';
      await createAnomalyIfNotExists({
        tenantId,
        branchId,
        type: 'CASH_VARIANCE',
        severity,
        description: `Shift closed with cash variance of ${variance} PKR. Expected max ${maxVariance} PKR.`,
        affectedEntityId: shift.id,
        affectedUserId: shift.userId,
        detectedAt: shift.closedAt || new Date()
      });
    }
  }
}

async function scanExcessiveVoids(tenantId: string, branchId: string, since: Date, maxVoids: number) {
  const shifts = await prisma.shift.findMany({
    where: { tenantId, branchId, openedAt: { gte: since } },
    include: { user: true }
  });

  for (const shift of shifts) {
    const voidsCount = await prisma.voidRequest.count({
      where: {
        order: { shiftId: shift.id },
        status: 'APPROVED'
      }
    });

    if (voidsCount > maxVoids) {
      const severity = voidsCount > maxVoids * 2 ? 'CRITICAL' : 'MEDIUM';
      await createAnomalyIfNotExists({
        tenantId,
        branchId,
        type: 'EXCESSIVE_VOIDS',
        severity,
        description: `Shift has ${voidsCount} voids, exceeding threshold of ${maxVoids}.`,
        affectedEntityId: shift.id,
        affectedUserId: shift.userId
      });
    }
  }
}

async function scanLargeDiscounts(tenantId: string, branchId: string, since: Date, maxDiscountPct: number) {
  const orders = await prisma.order.findMany({
    where: {
      tenantId,
      branchId,
      createdAt: { gte: since },
      discountAmount: { gt: 0 }
    }
  });

  for (const order of orders) {
    const totalBeforeDiscount = order.totalAmount;
    if (totalBeforeDiscount > 0) {
      const pct = (order.discountAmount / totalBeforeDiscount) * 100;
      if (pct > maxDiscountPct) {
        await createAnomalyIfNotExists({
          tenantId,
          branchId,
          type: 'LARGE_DISCOUNT',
          severity: 'HIGH',
          description: `Order ${order.orderNumber} received ${pct.toFixed(1)}% discount, exceeding threshold of ${maxDiscountPct}%.`,
          affectedEntityId: order.id,
          affectedUserId: order.cashierId || undefined,
          detectedAt: order.createdAt
        });
      }
    }
  }
}
