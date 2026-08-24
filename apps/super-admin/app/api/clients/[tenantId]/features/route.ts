import { NextResponse } from 'next/server';
import { prisma } from '@dineiz/db';
import { getCurrentSuperAdmin } from '@/lib/auth';
import { logAuditAction } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const admin = await getCurrentSuperAdmin();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { tenantId } = await params;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { subscription: true },
    });

    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const tenantPlan = tenant.subscription?.plan || tenant.plan || 'STARTER';

    // Global Feature Flags
    const globalFlags = await prisma.featureFlag.findMany();

    // Tenant Overrides
    const overrides = await prisma.tenantFeatureOverride.findMany({
      where: { tenantId },
    });

    const overrideMap = new Map(overrides.map((o) => [o.featureKey, o.enabled]));

    // Map features with default plan access & override status
    const featuresWithStatus = globalFlags.map((flag) => {
      // Determine plan default access (FREE < STARTER < PRO < ENTERPRISE)
      const planLevels: Record<string, number> = { FREE: 1, STARTER: 2, PRO: 3, ENTERPRISE: 4 };
      const currentLevel = planLevels[tenantPlan] || 2;
      const requiredLevel = planLevels[flag.minimumPlan] || 1;

      const planDefaultAccess = currentLevel >= requiredLevel && flag.isEnabled;
      const hasOverride = overrideMap.has(flag.key);
      const overrideVal = overrideMap.get(flag.key);

      let overrideStatus: 'FOLLOWING_PLAN' | 'ENABLED' | 'DISABLED' = 'FOLLOWING_PLAN';
      if (hasOverride) {
        overrideStatus = overrideVal ? 'ENABLED' : 'DISABLED';
      }

      const effectiveAccess = hasOverride ? Boolean(overrideVal) : planDefaultAccess;

      return {
        id: flag.id,
        key: flag.key,
        name: flag.name,
        description: flag.description,
        minimumPlan: flag.minimumPlan,
        planDefaultAccess,
        overrideStatus,
        effectiveAccess,
      };
    });

    return NextResponse.json({ features: featuresWithStatus, tenantPlan });
  } catch (error: any) {
    console.error('Fetch feature overrides error:', error);
    return NextResponse.json({ error: 'Failed to fetch features' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const admin = await getCurrentSuperAdmin();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { tenantId } = await params;
    const { overrides } = await request.json(); // Array of { featureKey: string, overrideStatus: 'FOLLOWING_PLAN' | 'ENABLED' | 'DISABLED' }

    if (!Array.isArray(overrides)) {
      return NextResponse.json({ error: 'Invalid payload format' }, { status: 400 });
    }

    const beforeOverrides = await prisma.tenantFeatureOverride.findMany({ where: { tenantId } });

    // Process overrides in transaction
    await prisma.$transaction(async (tx) => {
      for (const item of overrides) {
        if (item.overrideStatus === 'FOLLOWING_PLAN') {
          // Delete override record if it exists
          await tx.tenantFeatureOverride.deleteMany({
            where: { tenantId, featureKey: item.featureKey },
          });
        } else {
          // Upsert override record
          const enabled = item.overrideStatus === 'ENABLED';
          await tx.tenantFeatureOverride.upsert({
            where: { tenantId_featureKey: { tenantId, featureKey: item.featureKey } },
            update: { enabled },
            create: { tenantId, featureKey: item.featureKey, enabled },
          });
        }
      }
    });

    const afterOverrides = await prisma.tenantFeatureOverride.findMany({ where: { tenantId } });

    const ipAddress = request.headers.get('x-forwarded-for') || '127.0.0.1';
    await logAuditAction({
      superAdminId: admin.id,
      action: 'FEATURE_OVERRIDE',
      targetTenantId: tenantId,
      before: beforeOverrides,
      after: afterOverrides,
      ipAddress,
      notes: `Updated ${overrides.length} feature flag overrides for tenant`,
    });

    return NextResponse.json({ success: true, message: 'Feature overrides saved successfully' });
  } catch (error: any) {
    console.error('Save feature overrides error:', error);
    return NextResponse.json({ error: 'Failed to save feature overrides' }, { status: 500 });
  }
}
