import { prisma } from '@dineiz/pos-portal-db';

export async function listStock(branchId: string) {
  return prisma.stockItem.findMany({ where: { branchId }, orderBy: { name: 'asc' } });
}

export async function listIngredients(branchId: string) {
  return prisma.ingredient.findMany({ where: { branchId }, include: { supplier: true }, orderBy: { name: 'asc' } });
}

export async function listRecipes(branchId: string) {
  return prisma.recipe.findMany({
    where: { branchId },
    include: { menuItem: true, lines: { include: { ingredient: true } } },
  });
}

export async function listPurchaseOrders(branchId: string) {
  return prisma.purchaseOrder.findMany({
    where: { branchId },
    include: { supplier: true, lines: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function listGoodsReceipts(branchId: string) {
  return prisma.goodsReceipt.findMany({
    where: { branchId },
    include: { purchaseOrder: true, receivedBy: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function listWastage(branchId: string) {
  return prisma.wastageEntry.findMany({ where: { branchId }, orderBy: { createdAt: 'desc' } });
}

export async function listStockChecks(branchId: string) {
  return prisma.stockCheck.findMany({ where: { branchId }, include: { conductedBy: true }, orderBy: { createdAt: 'desc' } });
}

export async function listMovements(branchId: string) {
  return prisma.stockMovement.findMany({ where: { branchId }, orderBy: { createdAt: 'desc' }, take: 100 });
}
