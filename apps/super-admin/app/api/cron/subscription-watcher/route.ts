import { NextResponse } from 'next/server';
import { prisma, Role, EmailTemplate } from '@dineiz/db';
import { Resend } from 'resend';
import { logAuditAction } from '@/lib/audit';
import {
  trialReminderEmail,
  trialEndedEmail,
  renewalReminderEmail,
  paymentFailedEmail,
  suspensionWarningEmail,
  suspendedEmail,
} from '@dineiz/email';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key_for_dev');
const BILLING_URL = 'https://console.dineiz.com/settings/billing';

function dayDiff(from: Date, to: Date) {
  const a = new Date(from); a.setHours(0, 0, 0, 0);
  const b = new Date(to); b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

async function alreadySent(dedupeKey: string) {
  const existing = await prisma.emailLog.findFirst({ where: { dedupeKey, status: { in: ['SENT', 'DELIVERED', 'QUEUED'] } } });
  return !!existing;
}

async function sendAndLog(params: {
  tenantId: string;
  to: string | null;
  template: 'TRIAL_REMINDER_7' | 'TRIAL_REMINDER_3' | 'TRIAL_REMINDER_1' | 'TRIAL_ENDED' | 'RENEWAL_REMINDER' | 'PAYMENT_FAILED' | 'SUSPENSION_WARNING' | 'SUSPENDED';
  email: { subject: string; html: string; text: string };
  dedupeKey: string;
}) {
  if (!params.to) return;
  let status: 'SENT' | 'FAILED' = 'SENT';
  let providerMessageId: string | undefined;
  let errorMessage: string | undefined;
  try {
    if (process.env.RESEND_API_KEY) {
      const result = await resend.emails.send({
        from: 'Dineiz Billing <billing@dineiz.com>',
        to: params.to,
        subject: params.email.subject,
        html: params.email.html,
        text: params.email.text,
      });
      providerMessageId = result.data?.id;
    } else {
      status = 'FAILED';
      errorMessage = 'RESEND_API_KEY not configured';
    }
  } catch (err: any) {
    status = 'FAILED';
    errorMessage = err?.message || String(err);
  }
  await prisma.emailLog.create({
    data: {
      tenantId: params.tenantId,
      recipientEmail: params.to,
      template: params.template,
      subject: params.email.subject,
      status,
      providerMessageId,
      errorMessage,
      attempts: 1,
      dedupeKey: params.dedupeKey,
      sentAt: status === 'SENT' ? new Date() : null,
    },
  });
}

async function hasOpenShift(tenantId: string) {
  const openShift = await prisma.shift.findFirst({ where: { tenantId, status: 'OPEN' } });
  return !!openShift;
}

const RETRY_TEMPLATES: EmailTemplate[] = [
  EmailTemplate.TRIAL_REMINDER_7, EmailTemplate.TRIAL_REMINDER_3, EmailTemplate.TRIAL_REMINDER_1, EmailTemplate.TRIAL_ENDED,
  EmailTemplate.RENEWAL_REMINDER, EmailTemplate.PAYMENT_FAILED, EmailTemplate.SUSPENSION_WARNING, EmailTemplate.SUSPENDED,
];

// Backoff in place of a BullMQ retry queue (this app runs on Vercel, which
// can't host a long-lived worker): 5min after attempt 1, 30min after attempt 2,
// 2hr after attempt 3, then give up and leave it FAILED for manual resend.
const RETRY_BACKOFF_MS = [5 * 60_000, 30 * 60_000, 120 * 60_000];

function buildRetryEmail(
  template: EmailTemplate,
  params: { ownerName: string; restaurantName: string; sub: { trialEndsAt: Date | null; currentPeriodEnd: Date; amount: number; gracePeriodDays: number } }
) {
  const { ownerName, restaurantName, sub } = params;
  switch (template) {
    case 'TRIAL_REMINDER_7':
    case 'TRIAL_REMINDER_3':
    case 'TRIAL_REMINDER_1': {
      const daysLeft = Number(template.split('_').pop()) as 7 | 3 | 1;
      return trialReminderEmail({ ownerName, restaurantName, daysLeft, trialEndsAt: sub.trialEndsAt?.toDateString() || 'soon', billingUrl: BILLING_URL });
    }
    case 'TRIAL_ENDED':
      return trialEndedEmail({ ownerName, restaurantName, billingUrl: BILLING_URL });
    case 'RENEWAL_REMINDER':
      return renewalReminderEmail({ ownerName, restaurantName, amount: `PKR ${sub.amount.toLocaleString()}`, dueDate: sub.currentPeriodEnd.toDateString(), billingUrl: BILLING_URL });
    case 'PAYMENT_FAILED':
      return paymentFailedEmail({ ownerName, restaurantName, amount: `PKR ${sub.amount.toLocaleString()}`, gracePeriodDays: sub.gracePeriodDays, billingUrl: BILLING_URL });
    case 'SUSPENSION_WARNING':
      return suspensionWarningEmail({ ownerName, restaurantName, daysLeft: 1, billingUrl: BILLING_URL });
    case 'SUSPENDED':
      return suspendedEmail({ ownerName, restaurantName, billingUrl: BILLING_URL });
  }
}

async function retryFailedEmails() {
  let retried = 0;
  const candidates = await prisma.emailLog.findMany({
    where: { status: 'FAILED', attempts: { lt: 3 }, template: { in: RETRY_TEMPLATES }, tenantId: { not: null } },
    orderBy: { createdAt: 'asc' },
    take: 50,
  });

  for (const log of candidates) {
    const backoffMs = RETRY_BACKOFF_MS[Math.min(log.attempts, RETRY_BACKOFF_MS.length - 1)];
    if (Date.now() - log.createdAt.getTime() < backoffMs) continue;

    const tenant = await prisma.tenant.findUnique({
      where: { id: log.tenantId! },
      include: { subscription: true, users: { where: { role: Role.TENANT_ADMIN }, select: { name: true, email: true } } },
    });
    if (!tenant?.subscription) continue;
    const owner = tenant.users[0];
    const to = owner?.email || log.recipientEmail;

    const email = buildRetryEmail(log.template, {
      ownerName: owner?.name || 'there',
      restaurantName: tenant.name,
      sub: tenant.subscription,
    });
    if (!email) continue;

    await sendAndLog({ tenantId: tenant.id, to, template: log.template as any, email, dedupeKey: log.dedupeKey || `${tenant.id}:${log.template}:retry:${log.id}` });
    await prisma.emailLog.update({ where: { id: log.id }, data: { attempts: log.attempts + 1 } });
    retried++;
  }
  return retried;
}

export async function GET(request: Request) {
  return runWatcher(request);
}
export async function POST(request: Request) {
  return runWatcher(request);
}

async function runWatcher(request: Request) {
  const providedSecret = request.headers.get('authorization')?.replace('Bearer ', '');
  if (process.env.CRON_SECRET && providedSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const results = { trialReminders: 0, trialExpired: 0, renewalReminders: 0, pastDue: 0, suspensionWarnings: 0, suspended: 0, suspensionDeferred: 0, retriedEmails: 0 };

    results.retriedEmails = await retryFailedEmails();

    const subscriptions = await prisma.tenantSubscription.findMany({
      where: { status: { in: ['TRIALING', 'ACTIVE', 'PAST_DUE'] } },
      include: {
        tenant: { include: { users: { where: { role: Role.TENANT_ADMIN }, select: { name: true, email: true } } } },
      },
    });

    for (const sub of subscriptions) {
      const owner = sub.tenant.users[0];
      const ownerEmail = owner?.email || null;
      const ownerName = owner?.name || 'there';
      const restaurantName = sub.tenant.name;

      if (sub.status === 'TRIALING' && sub.trialEndsAt) {
        const daysLeft = dayDiff(now, sub.trialEndsAt);
        const refKey = sub.trialEndsAt.toISOString().split('T')[0];

        if (daysLeft <= 0) {
          await prisma.tenantSubscription.update({ where: { id: sub.id }, data: { status: 'EXPIRED' } });
          await prisma.tenant.update({ where: { id: sub.tenantId }, data: { status: 'CANCELLED' } });
          await logAuditAction({ action: 'TRIAL_ENDED', targetTenantId: sub.tenantId, notes: 'Trial expired without payment' });
          const dedupeKey = `${sub.tenantId}:TRIAL_ENDED:${refKey}`;
          if (!(await alreadySent(dedupeKey))) {
            await sendAndLog({
              tenantId: sub.tenantId, to: ownerEmail, template: 'TRIAL_ENDED', dedupeKey,
              email: trialEndedEmail({ ownerName, restaurantName, billingUrl: BILLING_URL }),
            });
            results.trialExpired++;
          }
        } else if ([7, 3, 1].includes(daysLeft)) {
          const template = (`TRIAL_REMINDER_${daysLeft}` as 'TRIAL_REMINDER_7' | 'TRIAL_REMINDER_3' | 'TRIAL_REMINDER_1');
          const dedupeKey = `${sub.tenantId}:${template}:${refKey}`;
          if (!(await alreadySent(dedupeKey))) {
            await sendAndLog({
              tenantId: sub.tenantId, to: ownerEmail, template, dedupeKey,
              email: trialReminderEmail({ ownerName, restaurantName, daysLeft: daysLeft as 7 | 3 | 1, trialEndsAt: sub.trialEndsAt.toDateString(), billingUrl: BILLING_URL }),
            });
            results.trialReminders++;
          }
        }
      } else if (sub.status === 'ACTIVE') {
        const daysLeft = dayDiff(now, sub.currentPeriodEnd);
        const refKey = sub.currentPeriodEnd.toISOString().split('T')[0];

        if (daysLeft <= 0) {
          await prisma.tenantSubscription.update({ where: { id: sub.id }, data: { status: 'PAST_DUE' } });
          await prisma.tenant.update({ where: { id: sub.tenantId }, data: { status: 'PAST_DUE' } });
          await logAuditAction({ action: 'PAST_DUE', targetTenantId: sub.tenantId, notes: 'Billing period ended without payment' });
          const dedupeKey = `${sub.tenantId}:PAYMENT_FAILED:${refKey}`;
          if (!(await alreadySent(dedupeKey))) {
            await sendAndLog({
              tenantId: sub.tenantId, to: ownerEmail, template: 'PAYMENT_FAILED', dedupeKey,
              email: paymentFailedEmail({ ownerName, restaurantName, amount: `PKR ${sub.amount.toLocaleString()}`, gracePeriodDays: sub.gracePeriodDays, billingUrl: BILLING_URL }),
            });
            results.pastDue++;
          }
        } else if ([7, 3, 1].includes(daysLeft)) {
          const dedupeKey = `${sub.tenantId}:RENEWAL_REMINDER:${refKey}`;
          if (!(await alreadySent(dedupeKey))) {
            await sendAndLog({
              tenantId: sub.tenantId, to: ownerEmail, template: 'RENEWAL_REMINDER', dedupeKey,
              email: renewalReminderEmail({ ownerName, restaurantName, amount: `PKR ${sub.amount.toLocaleString()}`, dueDate: sub.currentPeriodEnd.toDateString(), billingUrl: BILLING_URL }),
            });
            results.renewalReminders++;
          }
        }
      } else if (sub.status === 'PAST_DUE') {
        const graceEnds = new Date(sub.currentPeriodEnd);
        graceEnds.setDate(graceEnds.getDate() + sub.gracePeriodDays);
        const daysUntilGraceEnds = dayDiff(now, graceEnds);
        const refKey = graceEnds.toISOString().split('T')[0];

        if ([3, 1].includes(daysUntilGraceEnds)) {
          const dedupeKey = `${sub.tenantId}:SUSPENSION_WARNING:${refKey}`;
          if (!(await alreadySent(dedupeKey))) {
            await sendAndLog({
              tenantId: sub.tenantId, to: ownerEmail, template: 'SUSPENSION_WARNING', dedupeKey,
              email: suspensionWarningEmail({ ownerName, restaurantName, daysLeft: daysUntilGraceEnds, billingUrl: BILLING_URL }),
            });
            results.suspensionWarnings++;
          }
        } else if (now > graceEnds) {
          if (await hasOpenShift(sub.tenantId)) {
            if (!sub.suspensionDeferred) {
              await prisma.tenantSubscription.update({ where: { id: sub.id }, data: { suspensionDeferred: true } });
            }
            results.suspensionDeferred++;
          } else {
            await prisma.tenantSubscription.update({ where: { id: sub.id }, data: { status: 'SUSPENDED', suspendedAt: now, suspensionDeferred: false } });
            await prisma.tenant.update({ where: { id: sub.tenantId }, data: { status: 'SUSPENDED' } });
            await logAuditAction({ action: 'SUSPENDED', targetTenantId: sub.tenantId, notes: `Grace period expired ${daysUntilGraceEnds * -1} days ago` });
            const dedupeKey = `${sub.tenantId}:SUSPENDED:${refKey}`;
            if (!(await alreadySent(dedupeKey))) {
              await sendAndLog({
                tenantId: sub.tenantId, to: ownerEmail, template: 'SUSPENDED', dedupeKey,
                email: suspendedEmail({ ownerName, restaurantName, billingUrl: BILLING_URL }),
              });
            }
            results.suspended++;
          }
        }
      }
    }

    return NextResponse.json({ success: true, evaluatedSubscriptions: subscriptions.length, results });
  } catch (error: any) {
    console.error('Subscription watcher error:', error);
    return NextResponse.json({ error: 'Subscription watcher failed', message: error.message }, { status: 500 });
  }
}
