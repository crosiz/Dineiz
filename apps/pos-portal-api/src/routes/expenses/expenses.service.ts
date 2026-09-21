import { prisma } from '@dineiz/pos-portal-db';

export async function listExpenses(branchId: string) {
  return prisma.expense.findMany({
    where: { branchId },
    include: { category: true, paidBy: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function listCategories(branchId: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const categories = await prisma.expenseCategory.findMany({
    where: { branchId },
    include: { expenses: { where: { createdAt: { gte: monthStart } }, select: { amount: true } } },
  });
  return categories.map(({ expenses, ...c }) => ({
    ...c,
    spentThisMonth: expenses.reduce((sum, e) => sum + e.amount, 0),
  }));
}

export async function listPettyCash(branchId: string) {
  return prisma.pettyCashEntry.findMany({ where: { branchId }, orderBy: { createdAt: 'desc' } });
}
