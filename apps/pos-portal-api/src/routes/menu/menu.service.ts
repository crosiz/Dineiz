import { prisma } from '@dineiz/pos-portal-db';

export async function listCategories(branchId: string) {
  return prisma.menuCategory.findMany({ where: { branchId }, orderBy: { sortOrder: 'asc' }, include: { _count: { select: { items: true } } } });
}

export async function listItems(branchId: string) {
  return prisma.menuItem.findMany({ where: { branchId }, include: { category: true }, orderBy: { name: 'asc' } });
}

export async function createItem(branchId: string, data: { categoryId: string; name: string; price: number; popular?: boolean }) {
  return prisma.menuItem.create({ data: { branchId, ...data } });
}

export async function setItemAvailability(branchId: string, itemId: string, available: boolean) {
  return prisma.menuItem.update({ where: { id: itemId, branchId }, data: { available } });
}

export async function listVariationGroups(branchId: string) {
  return prisma.variationGroup.findMany({ where: { branchId }, include: { options: true } });
}

export async function listAddOnGroups(branchId: string) {
  return prisma.addOnGroup.findMany({ where: { branchId }, include: { options: true } });
}

export async function listDeals(branchId: string) {
  return prisma.deal.findMany({ where: { branchId }, orderBy: { name: 'asc' } });
}
