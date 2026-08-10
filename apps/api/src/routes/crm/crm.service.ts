import { prisma } from '@swiftserve/db';

export async function listCustomers(tenantId: string, query: { q?: string; limit: number; cursor?: string }) {
  const { q, limit, cursor } = query;
  const where: any = {
    tenantId,
    ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { phone: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }] } : {}),
  };

  const rows = await (prisma as any).customer.findMany({
    where, orderBy: { createdAt: 'desc' }, take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? data[data.length - 1].id : null;

  const balances = await Promise.all(data.map(async (c: any) => {
    const agg = await (prisma as any).loyaltyPointLedger.aggregate({ where: { tenantId, customerId: c.id }, _sum: { points: true } });
    return { customerId: c.id, balance: agg._sum.points ?? 0 };
  }));
  const balMap = new Map(balances.map((b) => [b.customerId, b.balance]));
  return { data: data.map((c: any) => ({ ...c, pointsBalance: balMap.get(c.id) ?? 0 })), nextCursor };
}

export async function createCustomer(tenantId: string, body: { name: string; phone?: string; email?: string }) {
  return (prisma as any).customer.create({ data: { tenantId, name: body.name, phone: body.phone, email: body.email } });
}

export async function getCustomer(tenantId: string, id: string) {
  const customer = await (prisma as any).customer.findFirst({ where: { id, tenantId } });
  if (!customer) return null;
  const ledger = await (prisma as any).loyaltyPointLedger.findMany({ where: { tenantId, customerId: id }, orderBy: { createdAt: 'desc' }, take: 200 });
  const balanceAgg = await (prisma as any).loyaltyPointLedger.aggregate({ where: { tenantId, customerId: id }, _sum: { points: true } });
  return { customer, pointsBalance: balanceAgg._sum.points ?? 0, ledger };
}

export async function adjustPoints(tenantId: string, body: { customerId: string; type: string; points: number; reference?: string; note?: string }) {
  const { customerId, type, points, reference, note } = body;
  const signedPoints = type === 'REDEEM' ? -points : points;

  if (signedPoints < 0) {
    const agg = await (prisma as any).loyaltyPointLedger.aggregate({ where: { tenantId, customerId }, _sum: { points: true } });
    const bal = agg._sum.points ?? 0;
    if (bal + signedPoints < 0) throw Object.assign(new Error('Insufficient points'), { status: 400 });
  }

  return (prisma as any).loyaltyPointLedger.create({ data: { tenantId, customerId, type, points: signedPoints, reference, note } });
}
