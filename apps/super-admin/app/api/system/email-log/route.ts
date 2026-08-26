import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@dineiz/db';
import { getCurrentSuperAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const admin = await getCurrentSuperAdmin();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const template = searchParams.get('template');
    const status = searchParams.get('status');

    const where: any = {};
    if (tenantId) where.tenantId = tenantId;
    if (template && template !== 'ALL') where.template = template;
    if (status && status !== 'ALL') where.status = status;

    const logs = await prisma.emailLog.findMany({
      where,
      include: { tenant: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return NextResponse.json({
      logs: logs.map((l) => ({
        id: l.id,
        tenantId: l.tenantId,
        tenantName: l.tenant?.name || null,
        recipientEmail: l.recipientEmail,
        template: l.template,
        subject: l.subject,
        status: l.status,
        errorMessage: l.errorMessage,
        attempts: l.attempts,
        sentAt: l.sentAt,
        createdAt: l.createdAt,
      })),
    });
  } catch (error: any) {
    console.error('Email log fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch email log' }, { status: 500 });
  }
}
