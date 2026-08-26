import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma, Role } from '@dineiz/db';
import { getCurrentSuperAdmin, hashPassword } from '@/lib/auth';
import {
  welcomeEmail,
  trialReminderEmail,
  trialExtendedEmail,
  trialEndedEmail,
  paymentReceivedEmail,
  renewalReminderEmail,
  paymentFailedEmail,
  suspensionWarningEmail,
  suspendedEmail,
  reactivatedEmail,
  planChangedEmail,
} from '@dineiz/email';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key_for_dev');
const BILLING_URL = 'https://console.dineiz.com/settings/billing';

// Resend regenerates content from current tenant/subscription state rather than
// replaying stored bytes — EmailLog does not persist rendered HTML, and for
// most templates the current record is what should be communicated anyway.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentSuperAdmin();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const log = await prisma.emailLog.findUnique({ where: { id } });
    if (!log) return NextResponse.json({ error: 'Email log entry not found' }, { status: 404 });
    if (!log.tenantId) return NextResponse.json({ error: 'This email has no associated tenant to resend against' }, { status: 400 });

    const tenant = await prisma.tenant.findUnique({
      where: { id: log.tenantId },
      include: {
        subscription: true,
        users: { where: { role: Role.TENANT_ADMIN }, select: { id: true, name: true, email: true } },
        branches: { select: { name: true, branchCode: true }, take: 10 },
      },
    });
    if (!tenant) return NextResponse.json({ error: 'Tenant no longer exists' }, { status: 404 });

    const owner = tenant.users[0];
    const to = owner?.email || log.recipientEmail;
    const ownerName = owner?.name || 'there';
    const restaurantName = tenant.name;
    const sub = tenant.subscription;

    let email: { subject: string; html: string; text: string };

    switch (log.template) {
      case 'WELCOME': {
        if (!owner) return NextResponse.json({ error: 'No tenant admin found to resend the welcome email to' }, { status: 400 });
        const newPassword = crypto.randomBytes(6).toString('hex');
        await prisma.user.update({ where: { id: owner.id }, data: { password: await hashPassword(newPassword) } });
        email = welcomeEmail({
          ownerName, restaurantName, email: to, password: newPassword,
          plan: sub?.plan || tenant.plan, trialEndsAt: sub?.trialEndsAt?.toDateString(),
          branchCodes: tenant.branches.map((b) => ({ branchName: b.name, code: b.branchCode || '' })),
        });
        break;
      }
      case 'TRIAL_REMINDER_7':
      case 'TRIAL_REMINDER_3':
      case 'TRIAL_REMINDER_1': {
        const days = Number(log.template.split('_').pop()) as 7 | 3 | 1;
        email = trialReminderEmail({ ownerName, restaurantName, daysLeft: days, trialEndsAt: sub?.trialEndsAt?.toDateString() || 'soon', billingUrl: BILLING_URL });
        break;
      }
      case 'TRIAL_EXTENDED':
        email = trialExtendedEmail({ ownerName, restaurantName, newTrialEndsAt: sub?.trialEndsAt?.toDateString() || 'soon' });
        break;
      case 'TRIAL_ENDED':
        email = trialEndedEmail({ ownerName, restaurantName, billingUrl: BILLING_URL });
        break;
      case 'PAYMENT_RECEIVED':
        email = paymentReceivedEmail({
          ownerName, restaurantName,
          amount: `PKR ${(sub?.lastPaymentAmount || sub?.amount || 0).toLocaleString()}`,
          method: sub?.lastPaymentMethod || 'Bank transfer',
          periodStart: sub?.currentPeriodStart?.toDateString() || '',
          periodEnd: sub?.currentPeriodEnd?.toDateString() || '',
          billingUrl: BILLING_URL,
        });
        break;
      case 'RENEWAL_REMINDER':
        email = renewalReminderEmail({ ownerName, restaurantName, amount: `PKR ${(sub?.amount || 0).toLocaleString()}`, dueDate: sub?.currentPeriodEnd?.toDateString() || '', billingUrl: BILLING_URL });
        break;
      case 'PAYMENT_FAILED':
        email = paymentFailedEmail({ ownerName, restaurantName, amount: `PKR ${(sub?.amount || 0).toLocaleString()}`, gracePeriodDays: sub?.gracePeriodDays || 7, billingUrl: BILLING_URL });
        break;
      case 'SUSPENSION_WARNING':
        email = suspensionWarningEmail({ ownerName, restaurantName, daysLeft: 1, billingUrl: BILLING_URL });
        break;
      case 'SUSPENDED':
        email = suspendedEmail({ ownerName, restaurantName, billingUrl: BILLING_URL });
        break;
      case 'REACTIVATED':
        email = reactivatedEmail({ ownerName, restaurantName });
        break;
      case 'PLAN_CHANGED':
        email = planChangedEmail({ ownerName, restaurantName, oldPlan: '—', newPlan: sub?.plan || tenant.plan, effectiveDate: new Date().toDateString(), planUrl: BILLING_URL });
        break;
      default:
        return NextResponse.json({ error: `Resend is not supported for ${log.template} from this panel` }, { status: 400 });
    }

    let status: 'SENT' | 'FAILED' = 'SENT';
    let providerMessageId: string | undefined;
    let errorMessage: string | undefined;
    if (process.env.RESEND_API_KEY) {
      try {
        const result = await resend.emails.send({ from: 'Dineiz Billing <billing@dineiz.com>', to, subject: email.subject, html: email.html, text: email.text });
        providerMessageId = result.data?.id;
      } catch (err: any) {
        status = 'FAILED';
        errorMessage = err?.message || String(err);
      }
    } else {
      status = 'FAILED';
      errorMessage = 'RESEND_API_KEY not configured';
    }

    const newLog = await prisma.emailLog.create({
      data: {
        tenantId: log.tenantId, recipientEmail: to, template: log.template, subject: email.subject,
        status, providerMessageId, errorMessage, attempts: log.attempts + 1, dedupeKey: log.dedupeKey,
        sentAt: status === 'SENT' ? new Date() : null,
      },
    });

    return NextResponse.json({ success: status === 'SENT', log: newLog });
  } catch (error: any) {
    console.error('Email resend error:', error);
    return NextResponse.json({ error: 'Failed to resend email' }, { status: 500 });
  }
}
