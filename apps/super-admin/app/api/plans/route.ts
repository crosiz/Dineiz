import { NextResponse } from 'next';
import { prisma } from '@dineiz/db';
import { getCurrentSuperAdmin } from '@/lib/auth';
import { logAuditAction } from '@/lib/audit';

export async function GET() {
  try {
    const admin = await getCurrentSuperAdmin();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const plans = await prisma.planDefinition.findMany({
      orderBy: { createdAt: 'asc' },
    });

    const subscriptions = await prisma.tenantSubscription.groupBy({
      by: ['plan'],
      _count: { plan: true },
      _sum: { amount: true },
      where: { status: 'ACTIVE' },
    });

    const statsByPlan = subscriptions.reduce((acc, sub) => {
      acc[sub.plan] = {
        count: sub._count.plan,
        mrr: sub._sum.amount || 0,
      };
      return acc;
    }, {} as Record<string, { count: number; mrr: number }>);

    const plansWithStats = plans.map(plan => ({
      ...plan,
      tenantsCount: statsByPlan[plan.id]?.count || 0,
      mrr: statsByPlan[plan.id]?.mrr || 0,
    }));

    return NextResponse.json({ plans: plansWithStats });
  } catch (error: any) {
    console.error('Fetch plans error:', error);
    return NextResponse.json({ error: 'Failed to fetch plans' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const admin = await getCurrentSuperAdmin();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (admin.role !== 'OWNER' && admin.role !== 'SUPPORT') {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions to edit plans' }, { status: 403 });
    }

    const { id, name, displayName, price, currency, limits, features } = await request.json();

    if (!id || !name || !price || !limits || !features) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const existing = await prisma.planDefinition.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    const updated = await prisma.planDefinition.update({
      where: { id },
      data: {
        name,
        displayName,
        price,
        currency,
        limits,
        features,
      },
    });

    const ipAddress = request.headers.get('x-forwarded-for') || '127.0.0.1';
    await logAuditAction({
      superAdminId: admin.id,
      action: 'PLAN_CHANGED',
      before: existing as any,
      after: updated as any,
      ipAddress,
      notes: `Updated plan definition: ${id}`,
    });

    return NextResponse.json({ success: true, plan: updated });
  } catch (error: any) {
    console.error('Update plan error:', error);
    return NextResponse.json({ error: 'Failed to update plan' }, { status: 500 });
  }
}
