import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@dineiz/db';
import { getCurrentSuperAdmin } from '@/lib/auth';
import { logAuditAction } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Re-download a previously-issued license's signed JSON (e.g. the customer lost their file). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentSuperAdmin();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const license = await prisma.standaloneLicense.findUnique({ where: { id } });
    if (!license) return NextResponse.json({ error: 'License not found' }, { status: 404 });

    return NextResponse.json({ signedLicense: JSON.parse(license.signedLicenseJson) });
  } catch (error: any) {
    console.error('Fetch standalone license error:', error);
    return NextResponse.json({ error: 'Failed to fetch license' }, { status: 500 });
  }
}

/**
 * Bookkeeping only — see the StandaloneLicense model's doc comment in
 * schema.prisma. This cannot invalidate a license file already on a
 * customer's offline machine; it only marks our own record.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentSuperAdmin();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (admin.role === 'SUPPORT') {
      return NextResponse.json({ error: 'Forbidden: SUPPORT role cannot revoke licenses' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const reason: string | undefined = body?.reason;

    const existing = await prisma.standaloneLicense.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'License not found' }, { status: 404 });
    if (existing.status === 'REVOKED') {
      return NextResponse.json({ error: 'This license is already revoked' }, { status: 400 });
    }

    const updated = await prisma.standaloneLicense.update({
      where: { id },
      data: { status: 'REVOKED', revokedAt: new Date(), revokedReason: reason?.trim() || null },
    });

    await logAuditAction({
      superAdminId: admin.id,
      action: 'STANDALONE_LICENSE_REVOKED',
      targetTenantId: existing.tenantId,
      before: { status: existing.status },
      after: { status: updated.status },
      notes: `Marked Standalone license for "${existing.restaurantName}" as revoked (record-keeping only — the offline app cannot be notified). ${reason ? `Reason: ${reason}` : ''}`,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Revoke standalone license error:', error);
    return NextResponse.json({ error: 'Failed to revoke license' }, { status: 500 });
  }
}
