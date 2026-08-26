import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@dineiz/db';
import { getCurrentSuperAdmin } from '@/lib/auth';
import { logAuditAction } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Numeric plan-limit overrides (maxBranches, maxStaff, ...) — a super admin
// grants a tenant a ceiling different from their plan default, with a reason
// and an optional expiry. Distinct from the boolean FeatureFlag overrides
// managed per-tenant on the client detail page's FEATURE_FLAGS tab.
const NUMERIC_LIMIT_KEYS = ['maxBranches', 'maxStaff'];

export async function GET(request: NextRequest) {
  try {
    const admin = await getCurrentSuperAdmin();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const overrides = await prisma.tenantFeatureOverride.findMany({
      where: { featureKey: { in: NUMERIC_LIMIT_KEYS } },
      include: { tenant: { select: { name: true, plan: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      overrides: overrides.map((o) => ({
        id: o.id,
        tenantId: o.tenantId,
        tenantName: o.tenant?.name,
        tenantPlan: o.tenant?.plan,
        featureKey: o.featureKey,
        limit: o.limit,
        reason: o.reason,
        grantedBy: o.grantedBy,
        expiresAt: o.expiresAt,
        isExpired: o.expiresAt ? o.expiresAt < new Date() : false,
        createdAt: o.createdAt,
      })),
    });
  } catch (error: any) {
    console.error('Fetch plan overrides error:', error);
    return NextResponse.json({ error: 'Failed to fetch plan overrides' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getCurrentSuperAdmin();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (admin.role === 'SUPPORT') {
      return NextResponse.json({ error: 'Forbidden: SUPPORT role cannot grant plan overrides' }, { status: 403 });
    }

    const body = await request.json();
    const { tenantId, featureKey, limit, reason, expiresAt } = body;

    if (!tenantId || !featureKey || limit === undefined || !reason?.trim()) {
      return NextResponse.json({ error: 'tenantId, featureKey, limit, and reason are all required' }, { status: 400 });
    }
    if (!NUMERIC_LIMIT_KEYS.includes(featureKey)) {
      return NextResponse.json({ error: `Unsupported override key: ${featureKey}` }, { status: 400 });
    }

    const override = await prisma.tenantFeatureOverride.upsert({
      where: { tenantId_featureKey: { tenantId, featureKey } },
      update: { limit: Number(limit), reason: reason.trim(), grantedBy: admin.id, expiresAt: expiresAt ? new Date(expiresAt) : null },
      create: { tenantId, featureKey, limit: Number(limit), reason: reason.trim(), grantedBy: admin.id, expiresAt: expiresAt ? new Date(expiresAt) : null },
    });

    await logAuditAction({
      superAdminId: admin.id,
      action: 'LIMIT_OVERRIDDEN',
      targetTenantId: tenantId,
      after: override,
      notes: `Set ${featureKey} override to ${limit} — ${reason}`,
    });

    return NextResponse.json({ success: true, override });
  } catch (error: any) {
    console.error('Create plan override error:', error);
    return NextResponse.json({ error: 'Failed to create plan override' }, { status: 500 });
  }
}
