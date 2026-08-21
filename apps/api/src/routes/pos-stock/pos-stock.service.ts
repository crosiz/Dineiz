import { prisma } from '@dineiz/db';
import { getAffectedItems, adjustStock } from '../inventory/inventory.service';
import { getFcm } from '../../lib/fcm';

export async function getStockStatus(tenantId: string, branchId: string) {
  const stocks = await prisma.stock.findMany({
    where: { tenantId, branchId },
    include: { ingredient: true },
  });

  const items = await Promise.all(stocks
    .filter(s => s.ingredient.isActive && !s.ingredient.isDeleted)
    .map(async s => {
      let status: 'OUT' | 'LOW' | 'OK' = 'OK';
      if (s.quantity <= 0) status = 'OUT';
      else if (s.reorderLevel > 0 && s.quantity <= s.reorderLevel) status = 'LOW';

      const affected = await getAffectedItems(tenantId, s.ingredientId);

      // Estimated remaining portions, using the most demanding recipe line for this ingredient.
      let estimatedPortions: number | null = null;
      if (affected.length > 0 && s.quantity > 0) {
        const lines = await prisma.recipeLine.findMany({
          where: { ingredientId: s.ingredientId, isOptional: false, recipe: { tenantId, isActive: true } },
        });
        const perPortion = lines.length
          ? Math.max(...lines.map(l => l.quantity * l.conversionToBase * (1 + l.wastagePercent / 100)))
          : 0;
        if (perPortion > 0) estimatedPortions = Math.floor(s.quantity / perPortion);
      }

      return {
        ingredientId: s.ingredientId,
        name: s.ingredient.name,
        unit: s.ingredient.unit,
        quantity: s.quantity,
        threshold: s.reorderLevel,
        status,
        affectedItems: affected,
        estimatedPortions,
        updatedAt: s.updatedAt,
      };
    }));

  items.sort((a, b) => {
    const rank = { OUT: 0, LOW: 1, OK: 2 } as const;
    return rank[a.status] - rank[b.status] || a.name.localeCompare(b.name);
  });

  return {
    counts: {
      out: items.filter(i => i.status === 'OUT').length,
      low: items.filter(i => i.status === 'LOW').length,
      ok: items.filter(i => i.status === 'OK').length,
    },
    items,
  };
}

export async function quickAdjustStock(tenantId: string, branchId: string, data: { ingredientId: string; quantity: number; reason: string }, performedBy: { id: string; name: string }) {
  const ingredient = await prisma.ingredient.findFirst({ where: { id: data.ingredientId, tenantId } });
  if (!ingredient) throw new Error('Ingredient not found');
  const current = await prisma.stock.findUnique({ where: { branchId_ingredientId: { branchId, ingredientId: data.ingredientId } } });
  const currentQty = current?.quantity ?? 0;
  const delta = data.quantity - currentQty;
  if (delta === 0) return current;
  return adjustStock(tenantId, data.ingredientId, { branchId, quantity: Math.abs(delta), type: delta > 0 ? 'ADD' : 'SUBTRACT', reason: 'Quick Adjust (POS)', note: data.reason }, performedBy);
}

export async function notifyManagerLowStock(tenantId: string, branchId: string, data: { ingredientId: string }, requestedBy: { name: string }) {
  const [ingredient, stock, branch] = await Promise.all([
    prisma.ingredient.findFirst({ where: { id: data.ingredientId, tenantId } }),
    prisma.stock.findUnique({ where: { branchId_ingredientId: { branchId, ingredientId: data.ingredientId } } }),
    prisma.branch.findUnique({ where: { id: branchId } }),
  ]);
  if (!ingredient) throw new Error('Ingredient not found');

  const messaging = getFcm();
  if (!messaging) return { sent: false };

  const devices = await prisma.userDevice.findMany({
    where: { user: { tenantId, branchId, role: { in: ['BRANCH_MANAGER', 'TENANT_ADMIN'] as any } } },
    select: { token: true },
  });
  const tokens = devices.map(d => d.token).filter(Boolean);
  if (tokens.length === 0) return { sent: false };

  await messaging.sendEachForMulticast({
    tokens,
    notification: {
      title: 'Stock alert from POS',
      body: `${requestedBy.name} flagged ${ingredient.name} at ${branch?.name || 'branch'} (qty: ${stock?.quantity ?? 0} ${ingredient.unit}).`,
    },
  });

  return { sent: true };
}
