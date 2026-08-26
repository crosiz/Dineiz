import { NextResponse } from 'next/server';
import { prisma } from '@dineiz/db';
import { getCurrentSuperAdmin } from '@/lib/auth';
import { logAuditAction } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentSuperAdmin();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (admin.role === 'SUPPORT') {
      return NextResponse.json({ error: 'Forbidden: SUPPORT role cannot revoke plan overrides' }, { status: 403 });
    }

    const { id } = await params;
    const existing = await prisma.tenantFeatureOverride.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Override not found' }, { status: 404 });

    await prisma.tenantFeatureOverride.delete({ where: { id } });

    await logAuditAction({
      superAdminId: admin.id,
      action: 'LIMIT_OVERRIDDEN',
      targetTenantId: existing.tenantId,
      before: existing,
      notes: `Revoked ${existing.featureKey} override (tenant reverts to plan default)`,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Revoke plan override error:', error);
    return NextResponse.json({ error: 'Failed to revoke plan override' }, { status: 500 });
  }
}
