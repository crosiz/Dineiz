import { NextResponse } from 'next/server';
import { prisma } from '@dineiz/db';
import { getCurrentSuperAdmin } from '@/lib/auth';
import { logAuditAction } from '@/lib/audit';
import { renderAndStoreInvoice, emailInvoice } from '@/lib/invoicing';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Creates an unpaid invoice for the tenant's current subscription amount —
// for billing ahead of payment, as opposed to the receipt generated from an
// already-recorded PaymentHistory row (see .../payments/[paymentId]/invoice).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const admin = await getCurrentSuperAdmin();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (admin.role === 'SUPPORT') {
      return NextResponse.json({ error: 'Forbidden: SUPPORT role cannot issue invoices' }, { status: 403 });
    }

    const { tenantId } = await params;
    const body = await request.json().catch(() => ({}));
    const action = body?.action === 'SEND' ? 'SEND' : 'GENERATE';

    const subscription = await prisma.tenantSubscription.findUnique({ where: { tenantId } });
    if (!subscription) {
      return NextResponse.json({ error: 'This tenant has no subscription to invoice' }, { status: 400 });
    }
    if (!subscription.amount || subscription.amount <= 0) {
      return NextResponse.json(
        { error: 'This subscription has no billing amount set (PKR 0) — set the plan amount on the Subscription tab before issuing an invoice' },
        { status: 400 }
      );
    }

    const due = await prisma.paymentHistory.create({
      data: {
        tenantId,
        amount: subscription.amount,
        currency: 'PKR',
        status: 'DUE',
        description: `${subscription.plan} plan — ${subscription.billingCycle === 'ANNUAL' ? 'Annual' : 'Monthly'} subscription`,
        planAtIssue: subscription.plan,
        billingCycleAtIssue: subscription.billingCycle,
      },
    });

    const result = await renderAndStoreInvoice(tenantId, due.id);

    await logAuditAction({
      superAdminId: admin.id,
      action: 'INVOICE_GENERATED',
      targetTenantId: tenantId,
      after: { paymentId: due.id, invoiceNumber: result.invoiceNumber, status: 'DUE' },
      ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
      notes: `Issued invoice ${result.invoiceNumber} for the current billing period`,
    });

    if (action === 'GENERATE') {
      return NextResponse.json({ success: true, invoiceNumber: result.invoiceNumber, paymentId: due.id });
    }

    const sendResult = await emailInvoice(result);
    if (!sendResult.ok) {
      return NextResponse.json({ error: sendResult.error, invoiceNumber: result.invoiceNumber, paymentId: due.id }, { status: sendResult.status });
    }
    return NextResponse.json({ success: true, invoiceNumber: result.invoiceNumber, paymentId: due.id });
  } catch (error: any) {
    console.error('Due-invoice generation error:', error);
    return NextResponse.json({ error: error?.message ?? 'Failed to generate invoice' }, { status: error?.status ?? 500 });
  }
}
