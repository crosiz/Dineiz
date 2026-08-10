import { NextResponse } from 'next';
import { prisma, Role } from '@dineiz/db';
import { Resend } from 'resend';
import { logAuditAction } from '@/lib/audit';

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key');

export async function GET(request: Request) {
  return handleRenewalReminders(request);
}

export async function POST(request: Request) {
  return handleRenewalReminders(request);
}

async function handleRenewalReminders(request: Request) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sevenDaysOut = new Date(today);
    sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);

    const threeDaysOut = new Date(today);
    threeDaysOut.setDate(threeDaysOut.getDate() + 3);

    const oneDayOut = new Date(today);
    oneDayOut.setDate(oneDayOut.getDate() + 1);

    // Subscriptions active or trialing
    const activeSubscriptions = await prisma.tenantSubscription.findMany({
      where: {
        status: { in: ['ACTIVE', 'TRIALING'] },
      },
      include: {
        tenant: {
          include: {
            users: { where: { role: Role.TENANT_ADMIN }, select: { name: true, email: true, phone: true } },
          },
        },
      },
    });

    const reminderResults = [];

    for (const sub of activeSubscriptions) {
      const renewalDate = new Date(sub.nextRenewalDate || sub.currentPeriodEnd);
      renewalDate.setHours(0, 0, 0, 0);

      const diffTime = renewalDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 7 || diffDays === 3 || diffDays === 1) {
        const owner = sub.tenant.users[0] || { name: 'Owner', email: '', phone: '' };
        const formattedDate = renewalDate.toLocaleDateString('en-PK', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
        const amount = sub.amount || (sub.plan === 'PRO' ? 15000 : 8000);
        const paymentLink = `https://console.dineiz.com/billing/pay?subId=${sub.id}`;

        const whatsappText = `Salam ${owner.name}! Aapki Dineiz ${sub.plan} subscription ${formattedDate} ko renew hogi. PKR ${amount.toLocaleString()} ki payment karein: ${paymentLink}. Shukriya!`;

        // Send Email HTML Invoice
        if (owner.email && process.env.RESEND_API_KEY) {
          try {
            await resend.emails.send({
              from: 'Dineiz Billing <billing@dineiz.com>',
              to: owner.email,
              subject: `Subscription Renewal Reminder — ${sub.tenant.name}`,
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #0f172a; padding: 24px; border: 1px solid #e2e8f0; rounded-radius: 12px;">
                  <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #ff5722; padding-bottom: 16px;">
                    <h2 style="color: #ff5722; margin: 0;">DINEIZ POS</h2>
                    <span style="font-size: 14px; color: #64748b;">Invoice Renewal Notice</span>
                  </div>
                  <p style="margin-top: 20px;">Salam <strong>${owner.name}</strong>,</p>
                  <p>Your subscription for <strong>${sub.tenant.name}</strong> is due for renewal in <strong>${diffDays} day(s)</strong> on <strong>${formattedDate}</strong>.</p>
                  
                  <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr><td style="padding: 6px 0;"><strong>Plan:</strong></td><td>${sub.plan} (${sub.billingCycle})</td></tr>
                      <tr><td style="padding: 6px 0;"><strong>Amount Due:</strong></td><td style="color: #ff5722; font-weight: bold;">PKR ${amount.toLocaleString()}</td></tr>
                      <tr><td style="padding: 6px 0;"><strong>Renewal Date:</strong></td><td>${formattedDate}</td></tr>
                    </table>
                  </div>
                  
                  <p style="text-align: center; margin-top: 30px;">
                    <a href="${paymentLink}" style="background: #ff5722; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; inline-block;">Pay Now Online</a>
                  </p>
                </div>
              `,
            });
          } catch (e) {
            console.warn('Reminder email error:', e);
          }
        }

        // Log to SuperAdminMessage communication history
        await prisma.superAdminMessage.create({
          data: {
            tenantId: sub.tenantId,
            channel: 'BOTH',
            subject: `Automated Renewal Reminder (${diffDays} days left)`,
            body: whatsappText,
            status: 'SENT',
            recipientsCount: 1,
            targetSegment: 'RENEWAL_REMINDER',
          },
        });

        reminderResults.push({ tenant: sub.tenant.name, diffDays, amount });
      }
    }

    // Process expired subscriptions check
    const expiredSubscriptions = await prisma.tenantSubscription.findMany({
      where: {
        status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] },
        nextRenewalDate: { lt: today },
      },
      include: { tenant: true },
    });

    const pastDueAlerts = [];
    const superAdminReviewFlags = [];

    for (const sub of expiredSubscriptions) {
      const renewalDate = new Date(sub.nextRenewalDate);
      renewalDate.setHours(0, 0, 0, 0);

      const daysOverdue = Math.floor((today.getTime() - renewalDate.getTime()) / (1000 * 60 * 60 * 24));

      // Overdue > 3 days: Mark PAST_DUE, restrict features to FREE tier, notify super admin
      if (daysOverdue >= 3 && sub.status !== 'PAST_DUE') {
        await prisma.tenantSubscription.update({
          where: { id: sub.id },
          data: { status: 'PAST_DUE', plan: 'FREE' },
        });

        await prisma.tenant.update({
          where: { id: sub.tenantId },
          data: { status: 'PAST_DUE', plan: 'FREE' },
        });

        const alertNote = `Client [${sub.tenant.name}] is now ${daysOverdue} days past due for PKR ${sub.amount || 8000}. Restricted to Free tier.`;

        await logAuditAction({
          action: 'AUTOMATED_PAST_DUE_RESTRICTION',
          targetTenantId: sub.tenantId,
          notes: alertNote,
        });

        pastDueAlerts.push(alertNote);
      }

      // Overdue > 14 days: Flag for Super Admin review (do not auto delete)
      if (daysOverdue >= 14) {
        const flagNote = `FLAGGED FOR REVIEW: Client [${sub.tenant.name}] is ${daysOverdue} days past due. Requires Super Admin manual action.`;
        superAdminReviewFlags.push(flagNote);
      }
    }

    return NextResponse.json({
      success: true,
      remindersSentCount: reminderResults.length,
      reminderResults,
      pastDueAlerts,
      superAdminReviewFlags,
    });
  } catch (error: any) {
    console.error('Renewal reminder job error:', error);
    return NextResponse.json({ error: 'Failed to process renewal reminders' }, { status: 500 });
  }
}
