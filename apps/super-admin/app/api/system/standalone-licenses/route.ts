import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { prisma } from '@dineiz/db';
import type { LicensePayload } from '@dineiz/pos-logic';
import { getCurrentSuperAdmin } from '@/lib/auth';
import { logAuditAction } from '@/lib/audit';
import { isLicenseSigningConfigured, signStandaloneLicense } from '@/lib/standaloneLicense';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const admin = await getCurrentSuperAdmin();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const licenses = await prisma.standaloneLicense.findMany({
      include: { tenant: { select: { name: true, plan: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      signingConfigured: isLicenseSigningConfigured(),
      licenses: licenses.map((l) => ({
        id: l.id,
        tenantId: l.tenantId,
        tenantName: l.tenant?.name,
        tenantPlan: l.tenant?.plan,
        buyerName: l.buyerName,
        buyerEmail: l.buyerEmail,
        buyerPhone: l.buyerPhone,
        licenseId: l.licenseId,
        restaurantName: l.restaurantName,
        machineFingerprint: l.machineFingerprint,
        issuedAt: l.issuedAt,
        expiresAt: l.expiresAt,
        isExpired: l.expiresAt ? l.expiresAt < new Date() : false,
        status: l.status,
        revokedAt: l.revokedAt,
        revokedReason: l.revokedReason,
        createdAt: l.createdAt,
      })),
    });
  } catch (error: any) {
    console.error('Fetch standalone licenses error:', error);
    return NextResponse.json({ error: 'Failed to fetch licenses' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getCurrentSuperAdmin();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (admin.role === 'SUPPORT') {
      return NextResponse.json({ error: 'Forbidden: SUPPORT role cannot issue licenses' }, { status: 403 });
    }
    if (!isLicenseSigningConfigured()) {
      return NextResponse.json(
        { error: 'License signing is not configured on this deployment (STANDALONE_LICENSE_PRIVATE_KEY is unset)' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { tenantId, buyerName, buyerEmail, buyerPhone, restaurantName, machineFingerprint, expiresInDays } = body;

    if (!restaurantName?.trim() || !machineFingerprint?.trim()) {
      return NextResponse.json(
        { error: 'restaurantName and machineFingerprint are required' },
        { status: 400 }
      );
    }
    // Standalone is sellable on its own — most buyers have no cloud Tenant at
    // all. Either link to a real tenant, or capture the buyer's own name
    // directly; one of the two is required so a license is never issued with
    // no record at all of who it was sold to.
    if (!tenantId && !buyerName?.trim()) {
      return NextResponse.json(
        { error: 'Select an existing tenant, or enter the buyer’s name for an offline-only sale.' },
        { status: 400 }
      );
    }

    const hasExpiry = expiresInDays != null && expiresInDays !== '';
    const expiresInDaysNumber = hasExpiry ? Number(expiresInDays) : null;
    if (hasExpiry && (!Number.isFinite(expiresInDaysNumber) || expiresInDaysNumber! <= 0)) {
      return NextResponse.json({ error: 'expiresInDays must be a positive number' }, { status: 400 });
    }

    if (tenantId) {
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
      if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const payload: LicensePayload = {
      licenseId: randomUUID(),
      restaurantName: restaurantName.trim(),
      machineFingerprint: machineFingerprint.trim(),
      issuedAt: new Date().toISOString(),
      expiresAt:
        expiresInDaysNumber != null
          ? new Date(Date.now() + expiresInDaysNumber * 24 * 60 * 60 * 1000).toISOString()
          : null,
    };

    const signed = signStandaloneLicense(payload);

    const record = await prisma.standaloneLicense.create({
      data: {
        tenantId: tenantId || null,
        buyerName: tenantId ? null : buyerName.trim(),
        buyerEmail: buyerEmail?.trim() || null,
        buyerPhone: buyerPhone?.trim() || null,
        licenseId: payload.licenseId,
        restaurantName: payload.restaurantName,
        machineFingerprint: payload.machineFingerprint,
        issuedAt: new Date(payload.issuedAt),
        expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
        signedLicenseJson: JSON.stringify(signed),
        issuedBy: admin.id,
      },
    });

    await logAuditAction({
      superAdminId: admin.id,
      action: 'STANDALONE_LICENSE_ISSUED',
      targetTenantId: tenantId || undefined,
      after: { licenseId: payload.licenseId, restaurantName: payload.restaurantName, machineFingerprint: payload.machineFingerprint, buyerName: tenantId ? undefined : buyerName },
      notes: tenantId
        ? `Issued a Standalone license for "${payload.restaurantName}"`
        : `Issued a Standalone license for "${payload.restaurantName}" (offline-only sale, no cloud tenant — buyer: ${buyerName})`,
    });

    return NextResponse.json({ success: true, id: record.id, signedLicense: signed });
  } catch (error: any) {
    console.error('Issue standalone license error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to issue license' }, { status: 500 });
  }
}
