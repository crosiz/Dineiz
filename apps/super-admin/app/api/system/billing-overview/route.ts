import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@dineiz/db';
import { getCurrentSuperAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Consolidates what used to be three separate stub pages (payments, invoices,
// dunning) into one real view: payment history across every tenant, plus the
// past-due list sorted by urgency (most overdue first).
export async function GET(request: NextRequest) {
  try {
    const admin = await getCurrentSuperAdmin();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    const [payments, pastDueSubs] = await Promise.all([
      prisma.paymentHistory.findMany({
        where: tenantId ? { tenantId } : undefined,
        include: { tenant: { select: { name: true } } },
        orderBy: { paidAt: 'desc' },
        take: 200,
      }),
      prisma.tenantSubscription.findMany({
        where: { status: 'PAST_DUE' },
        include: { tenant: { select: { name: true } } },
        orderBy: { currentPeriodEnd: 'asc' },
      }),
    ]);

    const now = new Date();
    const pastDue = pastDueSubs.map((s) => ({
      tenantId: s.tenantId,
      tenantName: s.tenant.name,
      plan: s.plan,
      amount: s.amount,
      dueDate: s.currentPeriodEnd,
      daysOverdue: Math.max(0, Math.floor((now.getTime() - s.currentPeriodEnd.getTime()) / (1000 * 60 * 60 * 24))),
      graceEndsAt: new Date(s.currentPeriodEnd.getTime() + s.gracePeriodDays * 24 * 60 * 60 * 1000),
    }));

    return NextResponse.json({
      payments: payments.map((p) => ({
        id: p.id,
        tenantId: p.tenantId,
        tenantName: p.tenant.name,
        amount: p.amount,
        method: p.method,
        reference: p.reference,
        status: p.status,
        paidAt: p.paidAt,
      })),
      pastDue,
      totalOutstanding: pastDue.reduce((sum, p) => sum + p.amount, 0),
    });
  } catch (error: any) {
    console.error('Billing overview error:', error);
    return NextResponse.json({ error: 'Failed to fetch billing overview' }, { status: 500 });
  }
}
