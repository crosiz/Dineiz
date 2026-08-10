import { NextResponse } from 'next';
import { prisma } from '@swiftserve/db';
import { getCurrentSuperAdmin } from '@/lib/auth';
import { logAuditAction } from '@/lib/audit';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const admin = await getCurrentSuperAdmin();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { tenantId } = await params;

    const payments = await prisma.paymentHistory.findMany({
      where: { tenantId },
      orderBy: { paidAt: 'desc' },
    });

    return NextResponse.json({ payments });
  } catch (error: any) {
    console.error('Fetch payments error:', error);
    return NextResponse.json({ error: 'Failed to fetch payment history' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const admin = await getCurrentSuperAdmin();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // SUPPORT role cannot record manual payments
    if (admin.role === 'SUPPORT') {
      return NextResponse.json({ error: 'Forbidden: SUPPORT role cannot record manual payments' }, { status: 403 });
    }

    const { tenantId } = await params;
    const body = await request.json();
    const { amount, paidAt, method = 'BANK_TRANSFER', reference, notes } = body;

    if (!amount || Number(amount) <= 0) {
      return NextResponse.json({ error: 'Valid payment amount is required' }, { status: 400 });
    }

    const paymentDate = paidAt ? new Date(paidAt) : new Date();

    const payment = await prisma.paymentHistory.create({
      data: {
        tenantId,
        amount: Number(amount),
        currency: 'PKR',
        method,
        reference: reference || null,
        status: 'PAID',
        description: `Manual Payment (${method}) - Ref: ${reference || 'N/A'}`,
        notes: notes || null,
        paidAt: paymentDate,
      },
    });

    // Extend subscription renewal date by 1 month or 1 year based on cycle
    const subscription = await prisma.tenantSubscription.findUnique({ where: { tenantId } });
    if (subscription) {
      const currentRenewal = new Date(subscription.nextRenewalDate > new Date() ? subscription.nextRenewalDate : new Date());
      const nextRenewal = new Date(currentRenewal);

      if (subscription.billingCycle === 'ANNUAL') {
        nextRenewal.setFullYear(nextRenewal.getFullYear() + 1);
      } else {
        nextRenewal.setMonth(nextRenewal.getMonth() + 1);
      }

      await prisma.tenantSubscription.update({
        where: { tenantId },
        data: {
          status: 'ACTIVE',
          nextRenewalDate: nextRenewal,
          currentPeriodStart: currentRenewal,
          currentPeriodEnd: nextRenewal,
        },
      });

      await prisma.tenant.update({
        where: { id: tenantId },
        data: { status: 'ACTIVE' },
      });
    }

    const ipAddress = request.headers.get('x-forwarded-for') || '127.0.0.1';
    await logAuditAction({
      superAdminId: admin.id,
      action: 'PAYMENT_ADDED',
      targetTenantId: tenantId,
      after: { paymentId: payment.id, amount: payment.amount, method: payment.method, reference: payment.reference },
      ipAddress,
      notes: `Recorded manual payment of PKR ${amount} via ${method} (Ref: ${reference || 'N/A'})`,
    });

    return NextResponse.json({ success: true, payment });
  } catch (error: any) {
    console.error('Manual payment error:', error);
    return NextResponse.json({ error: 'Failed to record manual payment' }, { status: 500 });
  }
}
