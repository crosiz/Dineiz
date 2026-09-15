import { NextResponse } from 'next/server';
import { prisma } from '@dineiz/db';
import { getCurrentSuperAdmin } from '@/lib/auth';
import { logAuditAction } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SINGLETON_ID = 'platform_billing';

export async function GET() {
  try {
    const admin = await getCurrentSuperAdmin();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const settings = await prisma.platformBillingSettings.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID },
      update: {},
    });

    return NextResponse.json({ settings });
  } catch (error: any) {
    console.error('Fetch billing settings error:', error);
    return NextResponse.json({ error: 'Failed to fetch billing settings' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const admin = await getCurrentSuperAdmin();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (admin.role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden: only OWNER can edit payment-receiving details' }, { status: 403 });
    }

    const body = await request.json();
    const fields = [
      'bankName',
      'bankAccountTitle',
      'bankAccountNumber',
      'bankIban',
      'jazzCashNumber',
      'jazzCashAccountTitle',
      'easypaisaNumber',
      'easypaisaAccountTitle',
    ] as const;

    const data: Record<string, string | null> = {};
    for (const field of fields) {
      if (field in body) data[field] = body[field]?.trim() || null;
    }

    const settings = await prisma.platformBillingSettings.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, ...data, updatedBySuperAdminId: admin.id },
      update: { ...data, updatedBySuperAdminId: admin.id },
    });

    await logAuditAction({
      superAdminId: admin.id,
      action: 'BILLING_SETTINGS_UPDATED',
      notes: 'Updated platform payment-receiving details (bank/JazzCash/Easypaisa)',
      ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
    });

    return NextResponse.json({ settings });
  } catch (error: any) {
    console.error('Update billing settings error:', error);
    return NextResponse.json({ error: 'Failed to update billing settings' }, { status: 500 });
  }
}
