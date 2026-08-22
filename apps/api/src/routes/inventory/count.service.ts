import { prisma } from '@dineiz/db';
import { postStockChangeEffects } from './inventory.service';

const VARIANCE_ANOMALY_THRESHOLD = 5000; // PKR — total variance above this raises an AnomalyEvent

async function generateCountNumber(tenantId: string) {
  const year = new Date().getFullYear();
  const count = await prisma.stockCountSession.count({ where: { tenantId, startedAt: { gte: new Date(`${year}-01-01`) } } });
  return `CNT-${year}-${String(count + 1).padStart(4, '0')}`;
}

export async function getCounts(tenantId: string, q: any) {
  const { branchId, status } = q;
  return prisma.stockCountSession.findMany({
    where: { tenantId, ...(branchId ? { branchId } : {}), ...(status && status !== 'ALL' ? { status } : {}) },
    include: { lines: true, branch: true },
    orderBy: { startedAt: 'desc' },
  });
}

export async function getCountById(tenantId: string, id: string) {
  return prisma.stockCountSession.findFirst({
    where: { id, tenantId },
    include: { lines: { include: { ingredient: true } }, branch: true },
  });
}

export async function startCount(
  tenantId: string,
  data: { branchId: string; countType: 'FULL' | 'PARTIAL' | 'SPOT'; categories?: string[]; ingredientIds?: string[] },
  startedBy: { id: string; name: string }
) {
  const countNumber = await generateCountNumber(tenantId);

  const where: any = { tenantId, isDeleted: false, isActive: true };
  if (data.countType === 'PARTIAL' && data.categories?.length) where.category = { in: data.categories };
  if (data.countType === 'SPOT' && data.ingredientIds?.length) where.id = { in: data.ingredientIds };

  const ingredients = await prisma.ingredient.findMany({ where, include: { stock: { where: { branchId: data.branchId } } } });

  return prisma.stockCountSession.create({
    data: {
      tenantId, branchId: data.branchId, countNumber, countType: data.countType, status: 'IN_PROGRESS',
      startedById: startedBy.id, startedByName: startedBy.name,
      lines: {
        create: ingredients.map(ing => ({ ingredientId: ing.id, systemQty: ing.stock[0]?.quantity ?? 0 })),
      },
    },
    include: { lines: { include: { ingredient: true } } },
  });
}

export async function updateCountLine(
  tenantId: string,
  sessionId: string,
  ingredientId: string,
  data: { countedQty: number; notes?: string },
  countedBy: { id: string; name: string }
) {
  const session = await prisma.stockCountSession.findFirst({ where: { id: sessionId, tenantId } });
  if (!session) return null;
  if (session.status !== 'IN_PROGRESS') throw new Error('This count session is no longer in progress');

  const line = await prisma.stockCountLine.findFirst({ where: { sessionId, ingredientId }, include: { ingredient: true } });
  if (!line) throw new Error('Ingredient is not part of this count');

  // Re-snapshot the system quantity at the moment of entry (Edge Case 10).
  const liveStock = await prisma.stock.findUnique({ where: { branchId_ingredientId: { branchId: session.branchId, ingredientId } } });
  const systemQty = liveStock?.quantity ?? 0;
  const variance = data.countedQty - systemQty;
  const varianceValue = variance * line.ingredient.costPerUnit;

  const wasCounted = line.countedQty != null;

  const updated = await prisma.stockCountLine.update({
    where: { id: line.id },
    data: { systemQty, countedQty: data.countedQty, variance, varianceValue, countedById: countedBy.id, countedAt: new Date(), notes: data.notes },
  });

  const hadVarianceBefore = wasCounted && line.variance != null && line.variance !== 0;
  const hasVarianceNow = variance !== 0;

  await prisma.stockCountSession.update({
    where: { id: sessionId },
    data: {
      itemsCounted: { increment: wasCounted ? 0 : 1 },
      itemsWithVariance: { increment: (hasVarianceNow ? 1 : 0) - (hadVarianceBefore ? 1 : 0) },
    },
  });

  return updated;
}

export async function completeCount(
  tenantId: string,
  sessionId: string,
  data: { notes?: string },
  completedBy: { id: string; name: string }
) {
  const session = await prisma.stockCountSession.findFirst({ where: { id: sessionId, tenantId }, include: { lines: { include: { ingredient: true } } } });
  if (!session) return null;
  if (session.status !== 'IN_PROGRESS') throw new Error('This count session is no longer in progress');

  const countedLines = session.lines.filter(l => l.countedQty != null);
  let driftedDuringCount = 0;
  let totalVarianceValue = 0;
  const touched: string[] = [];

  for (const line of countedLines) {
    const before = await prisma.stock.findUnique({ where: { branchId_ingredientId: { branchId: session.branchId, ingredientId: line.ingredientId } } });
    const quantityBefore = before?.quantity ?? 0;
    if (quantityBefore !== line.systemQty) driftedDuringCount++;

    const countedQty = line.countedQty!;
    const variance = countedQty - quantityBefore;
    const varianceValue = variance * line.ingredient.costPerUnit;
    totalVarianceValue += varianceValue;
    touched.push(line.ingredientId);

    await prisma.$transaction(async (tx) => {
      await tx.stock.upsert({
        where: { branchId_ingredientId: { branchId: session.branchId, ingredientId: line.ingredientId } },
        create: { tenantId, branchId: session.branchId, ingredientId: line.ingredientId, quantity: countedQty, lastCountedAt: new Date(), lastCountedBy: completedBy.id, lastCountVariance: variance },
        update: { quantity: countedQty, lastCountedAt: new Date(), lastCountedBy: completedBy.id, lastCountVariance: variance },
      });
      await tx.stockMovement.create({
        data: {
          tenantId, branchId: session.branchId, ingredientId: line.ingredientId,
          type: 'ADJUSTMENT', quantity: variance, quantityBefore, quantityAfter: countedQty,
          countSessionId: sessionId, performedById: completedBy.id, performedByName: completedBy.name,
          note: `Physical count ${session.countNumber}`,
        },
      });
      await tx.stockCountLine.update({ where: { id: line.id }, data: { variance, varianceValue } });
    }, { timeout: 10000 });
  }

  const notes = driftedDuringCount > 0
    ? `${data.notes || ''} Note: ${driftedDuringCount} item(s) had stock activity between counting and completion — final adjustments were applied to the counted values.`.trim()
    : data.notes;

  const updated = await prisma.stockCountSession.update({
    where: { id: sessionId },
    data: {
      status: 'COMPLETED', completedById: completedBy.id, completedAt: new Date(),
      totalVarianceValue, notes,
    },
    include: { lines: { include: { ingredient: true } } },
  });

  if (Math.abs(totalVarianceValue) > VARIANCE_ANOMALY_THRESHOLD) {
    await prisma.anomalyEvent.create({
      data: {
        tenantId, branchId: session.branchId, type: 'STOCK_DISCREPANCY', severity: 'HIGH',
        description: `Physical count ${session.countNumber} found a total variance of PKR ${totalVarianceValue.toFixed(2)}.`,
        affectedEntityId: sessionId,
      },
    });
  }

  for (const ingredientId of touched) await postStockChangeEffects(tenantId, session.branchId, ingredientId);

  return updated;
}

export async function cancelCount(tenantId: string, sessionId: string) {
  const session = await prisma.stockCountSession.findFirst({ where: { id: sessionId, tenantId } });
  if (!session) return null;
  if (session.status !== 'IN_PROGRESS') throw new Error('Only an in-progress count can be cancelled');
  return prisma.stockCountSession.update({ where: { id: sessionId }, data: { status: 'CANCELLED' } });
}

export async function getVarianceReport(tenantId: string, sessionId: string) {
  const session = await getCountById(tenantId, sessionId);
  if (!session) return null;
  const lines = session.lines
    .filter(l => l.countedQty != null && l.variance != null && l.variance !== 0)
    .sort((a, b) => Math.abs(b.varianceValue || 0) - Math.abs(a.varianceValue || 0));
  return { session, variances: lines };
}
