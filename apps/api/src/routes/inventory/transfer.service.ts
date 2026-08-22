import { prisma } from '@dineiz/db';
import { postStockChangeEffects } from './inventory.service';

async function generateTransferNumber(tenantId: string) {
  const year = new Date().getFullYear();
  const count = await prisma.stockTransfer.count({ where: { tenantId, createdAt: { gte: new Date(`${year}-01-01`) } } });
  return `TRF-${year}-${String(count + 1).padStart(4, '0')}`;
}

export async function getTransfers(tenantId: string, q: any) {
  const { branchId, status } = q;
  const where: any = { tenantId };
  if (branchId) where.OR = [{ fromBranchId: branchId }, { toBranchId: branchId }];
  if (status && status !== 'ALL') where.status = status;

  return prisma.stockTransfer.findMany({
    where,
    include: { lines: { include: { ingredient: true } }, fromBranch: true, toBranch: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getTransferById(tenantId: string, id: string) {
  return prisma.stockTransfer.findFirst({
    where: { id, tenantId },
    include: { lines: { include: { ingredient: true } }, fromBranch: true, toBranch: true },
  });
}

export async function createTransfer(
  tenantId: string,
  data: { fromBranchId: string; toBranchId: string; notes?: string; lines: { ingredientId: string; requestedQty: number; unit?: string }[] },
  requestedBy: { id: string; name: string }
) {
  if (data.fromBranchId === data.toBranchId) throw new Error('Source and destination branches must be different');
  const transferNumber = await generateTransferNumber(tenantId);

  return prisma.stockTransfer.create({
    data: {
      tenantId, fromBranchId: data.fromBranchId, toBranchId: data.toBranchId,
      transferNumber, status: 'PENDING', notes: data.notes,
      requestedById: requestedBy.id, requestedByName: requestedBy.name,
      lines: { create: data.lines.map(l => ({ ingredientId: l.ingredientId, requestedQty: l.requestedQty, unit: l.unit })) },
    },
    include: { lines: { include: { ingredient: true } }, fromBranch: true, toBranch: true },
  });
}

export async function dispatchTransfer(
  tenantId: string,
  id: string,
  data: { lines?: { ingredientId: string; dispatchedQty: number }[] },
  dispatchedBy: { id: string; name: string }
) {
  const transfer = await prisma.stockTransfer.findFirst({ where: { id, tenantId }, include: { lines: true } });
  if (!transfer) return null;
  if (transfer.status !== 'PENDING') throw new Error('Only pending transfers can be dispatched');

  const overrideMap = new Map((data.lines || []).map(l => [l.ingredientId, l.dispatchedQty]));

  await prisma.$transaction(async (tx) => {
    for (const line of transfer.lines) {
      const dispatchedQty = overrideMap.has(line.ingredientId) ? overrideMap.get(line.ingredientId)! : line.requestedQty;
      await tx.stockTransferLine.update({ where: { id: line.id }, data: { dispatchedQty } });
      if (dispatchedQty <= 0) continue;

      const before = await tx.stock.findUnique({ where: { branchId_ingredientId: { branchId: transfer.fromBranchId, ingredientId: line.ingredientId } } });
      const quantityBefore = before?.quantity ?? 0;
      const quantityAfter = Math.max(0, quantityBefore - dispatchedQty);

      await tx.stock.upsert({
        where: { branchId_ingredientId: { branchId: transfer.fromBranchId, ingredientId: line.ingredientId } },
        create: { tenantId, branchId: transfer.fromBranchId, ingredientId: line.ingredientId, quantity: quantityAfter },
        update: { quantity: quantityAfter },
      });

      await tx.stockMovement.create({
        data: {
          tenantId, branchId: transfer.fromBranchId, ingredientId: line.ingredientId,
          type: 'TRANSFER_OUT', quantity: -(quantityBefore - quantityAfter),
          quantityBefore, quantityAfter, transferId: id,
          performedById: dispatchedBy.id, performedByName: dispatchedBy.name,
          note: `Dispatched on transfer ${transfer.transferNumber}`,
        },
      });
    }

    await tx.stockTransfer.update({ where: { id }, data: { status: 'IN_TRANSIT', dispatchedAt: new Date(), approvedById: dispatchedBy.id } });
  }, { timeout: 30000 }); // loops over every transfer line

  for (const line of transfer.lines) await postStockChangeEffects(tenantId, transfer.fromBranchId, line.ingredientId);
  return getTransferById(tenantId, id);
}

export async function receiveTransfer(
  tenantId: string,
  id: string,
  data: { lines?: { ingredientId: string; receivedQty: number }[] },
  receivedBy: { id: string; name: string }
) {
  const transfer = await prisma.stockTransfer.findFirst({ where: { id, tenantId }, include: { lines: true } });
  if (!transfer) return null;
  if (transfer.status !== 'IN_TRANSIT' && transfer.status !== 'PARTIALLY_RECEIVED') throw new Error('Transfer must be in transit to receive');

  // Same rule as PO receiving: once the caller sends an explicit lines array,
  // an omitted line means "not received this round," not "receive the rest" —
  // otherwise a genuinely partial receipt would silently over-receive whatever
  // the client didn't mention.
  const explicitLines = data.lines !== undefined;
  const overrideMap = new Map((data.lines || []).map(l => [l.ingredientId, l.receivedQty]));
  let allFullyReceived = true;

  await prisma.$transaction(async (tx) => {
    for (const line of transfer.lines) {
      const already = line.receivedQty || 0;
      const dispatched = line.dispatchedQty ?? line.requestedQty;
      const receivingNow = overrideMap.has(line.ingredientId) ? overrideMap.get(line.ingredientId)! : (explicitLines ? 0 : (dispatched - already));
      const totalReceived = already + receivingNow;
      if (totalReceived < dispatched) allFullyReceived = false;

      await tx.stockTransferLine.update({ where: { id: line.id }, data: { receivedQty: totalReceived } });
      if (receivingNow <= 0) continue;

      const before = await tx.stock.findUnique({ where: { branchId_ingredientId: { branchId: transfer.toBranchId, ingredientId: line.ingredientId } } });
      const quantityBefore = before?.quantity ?? 0;
      const quantityAfter = quantityBefore + receivingNow;

      await tx.stock.upsert({
        where: { branchId_ingredientId: { branchId: transfer.toBranchId, ingredientId: line.ingredientId } },
        create: { tenantId, branchId: transfer.toBranchId, ingredientId: line.ingredientId, quantity: quantityAfter },
        update: { quantity: quantityAfter },
      });

      await tx.stockMovement.create({
        data: {
          tenantId, branchId: transfer.toBranchId, ingredientId: line.ingredientId,
          type: 'TRANSFER_IN', quantity: receivingNow,
          quantityBefore, quantityAfter, transferId: id,
          performedById: receivedBy.id, performedByName: receivedBy.name,
          note: `Received on transfer ${transfer.transferNumber}`,
        },
      });
    }

    await tx.stockTransfer.update({
      where: { id },
      data: { status: allFullyReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED', receivedAt: allFullyReceived ? new Date() : transfer.receivedAt, receivedById: receivedBy.id },
    });
  }, { timeout: 30000 }); // loops over every transfer line

  for (const line of transfer.lines) await postStockChangeEffects(tenantId, transfer.toBranchId, line.ingredientId);
  return getTransferById(tenantId, id);
}

export async function cancelTransfer(tenantId: string, id: string) {
  const transfer = await prisma.stockTransfer.findFirst({ where: { id, tenantId } });
  if (!transfer) return null;
  if (transfer.status !== 'PENDING') throw new Error('Only a pending transfer (not yet dispatched) can be cancelled');
  return prisma.stockTransfer.update({ where: { id }, data: { status: 'CANCELLED' } });
}
