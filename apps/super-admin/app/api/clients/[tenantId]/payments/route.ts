import { NextResponse } from 'next/server';
import { prisma } from '@dineiz/db';
import { getCurrentSuperAdmin } from '@/lib/auth';
import { logAuditAction } from '@/lib/audit';
import { paymentReceivedEmail, reactivatedEmail } from '@dineiz/email';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key_for_dev');

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
    const { amount, paidAt, method = 'BANK_TRANSFER', reference, notes, periodEnd } = body;

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

    // Extend subscription renewal date by 1 month/year based on cycle, or an explicit period end
    const subscription = await prisma.tenantSubscription.findUnique({ where: { tenantId } });
    const wasInactive = subscription ? ['SUSPENDED', 'PAST_DUE', 'EXPIRED', 'CANCELLED'].includes(subscription.status) : false;
    let nextRenewal: Date | null = null;

    if (subscription) {
      const currentRenewal = new Date(subscription.nextRenewalDate > new Date() ? subscription.nextRenewalDate : new Date());
      nextRenewal = periodEnd ? new Date(periodEnd) : new Date(currentRenewal);
      if (!periodEnd) {
        if (subscription.billingCycle === 'ANNUAL') {
          nextRenewal.setFullYear(nextRenewal.getFullYear() + 1);
        } else {
          nextRenewal.setMonth(nextRenewal.getMonth() + 1);
        }
      }

      await prisma.tenantSubscription.update({
        where: { tenantId },
        data: {
          status: 'ACTIVE',
          nextRenewalDate: nextRenewal,
          currentPeriodStart: currentRenewal,
          currentPeriodEnd: nextRenewal,
          lastPaymentAt: paymentDate,
          lastPaymentAmount: Number(amount),
          lastPaymentMethod: method,
          lastPaymentReference: reference || null,
          suspendedAt: null,
          suspensionDeferred: false,
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

    // Notify the tenant — best-effort, never blocks the payment record itself
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { users: { where: { role: 'TENANT_ADMIN' }, select: { email: true, name: true } } },
      });
      const ownerEmail = tenant?.users?.[0]?.email;
      if (ownerEmail && subscription) {
        const emailParams = { ownerName: tenant?.users?.[0]?.name || 'there', restaurantName: tenant?.name || 'your restaurant' };
        const email = wasInactive
          ? reactivatedEmail(emailParams)
          : paymentReceivedEmail({
              ...emailParams,
              amount: `PKR ${Number(amount).toLocaleString()}`,
              method,
              periodStart: paymentDate.toDateString(),
              periodEnd: (nextRenewal || paymentDate).toDateString(),
              billingUrl: 'https://console.dineiz.com/settings/billing',
            });

        let status: 'SENT' | 'FAILED' = 'SENT';
        let providerMessageId: string | undefined;
        let errorMessage: string | undefined;
        if (process.env.RESEND_API_KEY) {
          const result = await resend.emails.send({
            from: 'Dineiz Billing <billing@dineiz.com>',
            to: ownerEmail,
            subject: email.subject,
            html: email.html,
            text: email.text,
          });
          providerMessageId = result.data?.id;
        } else {
          status = 'FAILED';
          errorMessage = 'RESEND_API_KEY not configured';
        }
        await prisma.emailLog.create({
          data: {
            tenantId, recipientEmail: ownerEmail, template: wasInactive ? 'REACTIVATED' : 'PAYMENT_RECEIVED',
            subject: email.subject, status, providerMessageId, errorMessage, attempts: 1,
            sentAt: status === 'SENT' ? new Date() : null,
          },
        });
      }
    } catch (emailErr) {
      console.warn('Payment confirmation email failed:', emailErr);
    }

    return NextResponse.json({ success: true, payment });
  } catch (error: any) {
    console.error('Manual payment error:', error);
    return NextResponse.json({ error: 'Failed to record manual payment' }, { status: 500 });
  }
}
