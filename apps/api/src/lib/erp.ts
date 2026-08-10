import { prisma } from '@swiftserve/db';

export async function getErpIntegration(tenantId: string) {
  return prisma.erpIntegration.findUnique({ where: { tenantId } });
}

export type ErpSyncResult = {
  syncedOrders: number;
  from: string;
  to: string;
};

// Intentionally minimal "proper" ERP sync:
// - incremental based on lastSyncedAt
// - sends one batch payload to ERPNext-style endpoint
// - stores lastSyncedAt + lastError
export async function syncOrdersToErpNext(tenantId: string): Promise<ErpSyncResult> {
  const cfg = await getErpIntegration(tenantId);
  if (!cfg?.enabled || cfg.provider !== 'ERPNEXT' || !cfg.baseUrl || !cfg.apiKey) {
    throw new Error('ERPNext integration not configured');
  }

  const from = cfg.lastSyncedAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
  const to = new Date();

  const orders = await prisma.order.findMany({
    where: { tenantId, updatedAt: { gt: from, lte: to } },
    include: { items: true, payments: true },
    orderBy: { updatedAt: 'asc' },
    take: 500,
  });

  const payload = {
    tenantId,
    window: { from: from.toISOString(), to: to.toISOString() },
    orders,
  };

  const endpoint = `${cfg.baseUrl.replace(/\/+$/, '')}/api/swiftserve/orders/batch`;
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(text || `ERPNext HTTP ${resp.status}`);
  }

  await prisma.erpIntegration.update({
    where: { tenantId },
    data: { lastSyncedAt: to, lastError: null },
  });

  return { syncedOrders: orders.length, from: from.toISOString(), to: to.toISOString() };
}

