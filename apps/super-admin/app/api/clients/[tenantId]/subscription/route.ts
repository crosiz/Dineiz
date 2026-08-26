import { NextResponse } from 'next/server';
import { prisma } from '@dineiz/db';
import { getCurrentSuperAdmin } from '@/lib/auth';
import { logAuditAction } from '@/lib/audit';
import { getPlanDefinition } from '@dineiz/schemas';
import {
  planChangedEmail,
  trialExtendedEmail,
  reactivatedEmail,
  suspendedEmail,
} from '@dineiz/email';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key_for_dev');

async function sendAndLog(params: {
  tenantId: string;
  to: string | null;
  template: 'PLAN_CHANGED' | 'TRIAL_EXTENDED' | 'REACTIVATED' | 'SUSPENDED';
  email: { subject: string; html: string; text: string };
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
      sentAt: status === 'SENT' ? new Date() : null,
    },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const admin = await getCurrentSuperAdmin();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // RBAC: SUPPORT role cannot change billing or subscription plans
    if (admin.role === 'SUPPORT') {
      return NextResponse.json(
        { error: 'Forbidden: SUPPORT role cannot modify billing or subscriptions' },
        { status: 403 }
      );
    }

    const { tenantId } = await params;
    const body = await request.json();
    const {
      action, plan, billingCycle, extendDays, extendReason, newStatus, cancellationReason,
      acknowledgeDowngrade,
    } = body;

    const subscription = await prisma.tenantSubscription.findUnique({ where: { tenantId } });
    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { users: { where: { role: 'TENANT_ADMIN' }, select: { email: true, name: true } } },
    });
    const ownerEmail = tenant?.users?.[0]?.email || null;
    const ownerName = tenant?.users?.[0]?.name || 'there';
    const restaurantName = tenant?.name || 'your restaurant';

    const ipAddress = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const beforeState = { ...subscription };
    let afterState: any = {};

    if (action === 'CHANGE_PLAN') {
      const planDef = getPlanDefinition(plan);
      const cycle = billingCycle || subscription.billingCycle;
      const newAmount = cycle === 'ANNUAL' ? (planDef.annualPrice ?? 0) : (planDef.monthlyPrice ?? 0);

      // Downgrade guard: block if current usage exceeds the new plan's limits
      const [branchCount, staffCount] = await Promise.all([
        prisma.branch.count({ where: { tenantId, deletedAt: null } }),
        prisma.user.count({ where: { tenantId, role: { notIn: ['TENANT_ADMIN'] }, status: { not: 'INACTIVE' } } }),
      ]);
      const exceeds: string[] = [];
      if (planDef.limits.maxBranches !== -1 && branchCount > planDef.limits.maxBranches) {
        exceeds.push(`${branchCount} branches exceed the new limit of ${planDef.limits.maxBranches}`);
      }
      if (planDef.limits.maxStaff !== -1 && staffCount > planDef.limits.maxStaff) {
        exceeds.push(`${staffCount} staff accounts exceed the new limit of ${planDef.limits.maxStaff}`);
      }
      if (exceeds.length > 0 && !acknowledgeDowngrade) {
        return NextResponse.json({
          error: 'DOWNGRADE_EXCEEDS_USAGE',
          message: 'This plan change would put the tenant over its new limits.',
          exceeds,
        }, { status: 409 });
      }

      const updated = await prisma.tenantSubscription.update({
        where: { tenantId },
        data: {
          plan,
          billingCycle: cycle,
          amount: newAmount,
          maxBranches: planDef.limits.maxBranches,
          maxStaff: planDef.limits.maxStaff,
          status: subscription.status === 'TRIALING' ? 'ACTIVE' : subscription.status,
        },
      });

      await prisma.tenant.update({ where: { id: tenantId }, data: { plan } });

      afterState = updated;

      await logAuditAction({
        superAdminId: admin.id,
        action: 'PLAN_CHANGED',
        targetTenantId: tenantId,
        before: beforeState,
        after: afterState,
        ipAddress,
        notes: `Changed plan from ${subscription.plan} to ${plan} (PKR ${newAmount})`,
      });

      await sendAndLog({
        tenantId,
        to: ownerEmail,
        template: 'PLAN_CHANGED',
        email: planChangedEmail({
          ownerName,
          restaurantName,
          oldPlan: subscription.plan,
          newPlan: plan,
          effectiveDate: new Date().toDateString(),
          planUrl: 'https://console.dineiz.com/settings/billing',
        }),
      });
    } else if (action === 'TOGGLE_CYCLE') {
      const targetCycle = billingCycle || (subscription.billingCycle === 'MONTHLY' ? 'ANNUAL' : 'MONTHLY');
      const updated = await prisma.tenantSubscription.update({
        where: { tenantId },
        data: { billingCycle: targetCycle },
      });

      afterState = updated;

      await logAuditAction({
        superAdminId: admin.id,
        action: 'BILLING_CYCLE_CHANGED',
        targetTenantId: tenantId,
        before: beforeState,
        after: afterState,
        ipAddress,
        notes: `Changed billing cycle to ${targetCycle}`,
      });
    } else if (action === 'EXTEND_TRIAL') {
      if (!extendReason || !String(extendReason).trim()) {
        return NextResponse.json({ error: 'A reason is required to extend a trial.' }, { status: 400 });
      }
      const daysToAdd = Number(extendDays) || 7;
      const currentTrialEnd = subscription.trialEndsAt && subscription.trialEndsAt > new Date() ? subscription.trialEndsAt : new Date();
      const newTrialEnd = new Date(currentTrialEnd);
      newTrialEnd.setDate(newTrialEnd.getDate() + daysToAdd);

      const updated = await prisma.tenantSubscription.update({
        where: { tenantId },
        data: {
          status: 'TRIALING',
          trialEndsAt: newTrialEnd,
          nextRenewalDate: newTrialEnd,
          trialExtendedCount: { increment: 1 },
          trialExtendedBy: admin.id,
          trialExtensionReason: String(extendReason).trim(),
        },
      });

      await prisma.tenant.update({ where: { id: tenantId }, data: { status: 'TRIALING' } });

      afterState = updated;

      await logAuditAction({
        superAdminId: admin.id,
        action: 'TRIAL_EXTENDED',
        targetTenantId: tenantId,
        before: beforeState,
        after: afterState,
        ipAddress,
        notes: `Extended trial by ${daysToAdd} days until ${newTrialEnd.toISOString().split('T')[0]} — ${extendReason}`,
      });

      await sendAndLog({
        tenantId,
        to: ownerEmail,
        template: 'TRIAL_EXTENDED',
        email: trialExtendedEmail({ ownerName, restaurantName, newTrialEndsAt: newTrialEnd.toDateString() }),
      });
    } else if (action === 'END_TRIAL_EARLY') {
      const updated = await prisma.tenantSubscription.update({
        where: { tenantId },
        data: { status: 'ACTIVE', trialEndsAt: new Date() },
      });

      await prisma.tenant.update({ where: { id: tenantId }, data: { status: 'ACTIVE' } });

      afterState = updated;

      await logAuditAction({
        superAdminId: admin.id,
        action: 'TRIAL_ENDED_EARLY',
        targetTenantId: tenantId,
        before: beforeState,
        after: afterState,
        ipAddress,
        notes: `Ended trial early and activated subscription`,
      });
    } else if (action === 'UPDATE_STATUS') {
      const targetStatus = newStatus || 'ACTIVE';
      const wasInactive = ['SUSPENDED', 'PAST_DUE', 'EXPIRED', 'CANCELLED'].includes(subscription.status);

      const updated = await prisma.tenantSubscription.update({
        where: { tenantId },
        data: {
          status: targetStatus,
          cancelledAt: targetStatus === 'CANCELLED' ? new Date() : null,
          cancellationReason: targetStatus === 'CANCELLED' ? (cancellationReason || null) : subscription.cancellationReason,
          suspendedAt: targetStatus === 'SUSPENDED' ? new Date() : subscription.suspendedAt,
          suspensionDeferred: targetStatus === 'SUSPENDED' ? false : subscription.suspensionDeferred,
        },
      });

      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          status: targetStatus === 'CANCELLED' ? 'CANCELLED' : targetStatus === 'PAST_DUE' ? 'PAST_DUE' : targetStatus === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE',
        },
      });

      afterState = updated;

      await logAuditAction({
        superAdminId: admin.id,
        action: targetStatus === 'SUSPENDED' ? 'SUSPENDED' : targetStatus === 'CANCELLED' ? 'CANCELLED' : `SUBSCRIPTION_${targetStatus}`,
        targetTenantId: tenantId,
        before: beforeState,
        after: afterState,
        ipAddress,
        notes: targetStatus === 'CANCELLED' && cancellationReason
          ? `Cancelled subscription — ${cancellationReason}`
          : `Updated subscription status to ${targetStatus}`,
      });

      if (targetStatus === 'SUSPENDED') {
        await sendAndLog({
          tenantId,
          to: ownerEmail,
          template: 'SUSPENDED',
          email: suspendedEmail({ ownerName, restaurantName, billingUrl: 'https://console.dineiz.com/settings/billing' }),
        });
      } else if (targetStatus === 'ACTIVE' && wasInactive) {
        await sendAndLog({
          tenantId,
          to: ownerEmail,
          template: 'REACTIVATED',
          email: reactivatedEmail({ ownerName, restaurantName }),
        });
      }
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ success: true, subscription: afterState });
  } catch (error: any) {
    console.error('Subscription update error:', error);
    return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
  }
}
