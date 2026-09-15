import { prisma } from '@dineiz/db';
import { getFcm } from './fcm';
import { enqueueCustomWebhookEvent } from './webhooks';

export async function sendLowStockIfNeeded(args: {
  tenantId: string;
  branchId: string;
  ingredientId: string;
}) {
  const stock = await prisma.stock.findUnique({
    where: { branchId_ingredientId: { branchId: args.branchId, ingredientId: args.ingredientId } },
    include: { ingredient: true, branch: true },
  });
  if (!stock) return;
  if (stock.reorderLevel <= 0) return;
  if (stock.quantity > stock.reorderLevel) return;

  // Webhook delivery is a separate notification channel from FCM push — it must not be
  // gated behind FCM being configured (the original early-return on `!messaging` above
  // this check meant a tenant with a working webhook but no FCM setup never got notified).
  enqueueCustomWebhookEvent({
    tenantId: args.tenantId,
    event: 'stock.low_alert',
    payload: {
      branchId: args.branchId,
      ingredientId: args.ingredientId,
      ingredientName: stock.ingredient.name,
      quantity: stock.quantity,
      reorderLevel: stock.reorderLevel,
    },
  }).catch(() => {});

  const messaging = getFcm();
  if (!messaging) return;

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

