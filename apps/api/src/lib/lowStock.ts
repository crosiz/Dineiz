import { prisma } from '@swiftserve/db';
import { getFcm } from './fcm';

export async function sendLowStockIfNeeded(args: {
  tenantId: string;
  branchId: string;
  ingredientId: string;
}) {
  const messaging = getFcm();
  if (!messaging) return;

  const stock = await prisma.stock.findUnique({
    where: { branchId_ingredientId: { branchId: args.branchId, ingredientId: args.ingredientId } },
    include: { ingredient: true, branch: true },
  });
  if (!stock) return;
  if (stock.reorderLevel <= 0) return;
  if (stock.quantity > stock.reorderLevel) return;

  const devices = await prisma.userDevice.findMany({
    where: {
      user: {
        tenantId: args.tenantId,
        role: { in: ['SUPER_ADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER'] as any },
      },
    },
    select: { token: true },
  });
  const tokens = devices.map(d => d.token).filter(Boolean);
  if (tokens.length === 0) return;

  await messaging.sendEachForMulticast({
    tokens,
    notification: {
      title: 'Low stock alert',
      body: `${stock.ingredient.name} is low at ${stock.branch.name} (qty: ${stock.quantity}).`,
    },
    data: {
      tenantId: args.tenantId,
      branchId: args.branchId,
      ingredientId: args.ingredientId,
      quantity: String(stock.quantity),
      reorderLevel: String(stock.reorderLevel),
    },
  });
}

