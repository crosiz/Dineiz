import { NextResponse } from 'next';
import { prisma } from '@dineiz/db';
import { getCurrentSuperAdmin } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const admin = await getCurrentSuperAdmin();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const actionFilter = searchParams.get('action');
    const tenantIdFilter = searchParams.get('tenantId');

    const whereClause: any = {};
    if (actionFilter && actionFilter !== 'ALL') {
      whereClause.action = actionFilter;
    }
    if (tenantIdFilter) {
      whereClause.targetTenantId = tenantIdFilter;
    }

    const logs = await prisma.auditLog.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        superAdmin: { select: { id: true, name: true, email: true, role: true } },
        targetTenant: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ logs });
  } catch (error: any) {
    console.error('Fetch audit trail error:', error);
    return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
  }
}
