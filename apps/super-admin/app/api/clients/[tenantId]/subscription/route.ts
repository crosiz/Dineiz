import { NextResponse } from 'next/server';
import { prisma } from '@dineiz/db';
import { getCurrentSuperAdmin } from '@/lib/auth';
import { logAuditAction } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
    const { action, plan, billingCycle, extendDays, newStatus } = body;

    const subscription = await prisma.tenantSubscription.findUnique({
      where: { tenantId },
    });

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    const ipAddress = request.headers.get('x-forwarded-for') || '127.0.0.1';
    let beforeState = { ...subscription };
    let afterState: any = {};

    if (action === 'CHANGE_PLAN') {
      let amount = 8000;
      if (plan === 'FREE' || plan === 'FREE_GO') amount = 0;
      else if (plan === 'PRO_GO') amount = 12000;
      else if (plan === 'STARTER') amount = 8000;
      else if (plan === 'PRO') amount = 15000;
      else if (plan === 'ENTERPRISE') amount = 35000;

      const updated = await prisma.tenantSubscription.update({
        where: { tenantId },
        data: {
          plan,
          billingCycle: billingCycle || subscription.billingCycle,
          amount,
          status: subscription.status === 'TRIALING' ? 'ACTIVE' : subscription.status,
        },
      });

      await prisma.tenant.update({
        where: { id: tenantId },
        data: { plan },
      });

      afterState = updated;

      await logAuditAction({
        superAdminId: admin.id,
        action: 'PLAN_CHANGED',
        targetTenantId: tenantId,
        before: beforeState,
        after: afterState,
        ipAddress,
        notes: `Changed plan from ${subscription.plan} to ${plan} (${amount} PKR)`,
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
      const daysToAdd = Number(extendDays) || 7;
      const currentTrialEnd = subscription.trialEndsAt || new Date();
      const newTrialEnd = new Date(currentTrialEnd);
      newTrialEnd.setDate(newTrialEnd.getDate() + daysToAdd);

      const updated = await prisma.tenantSubscription.update({
        where: { tenantId },
        data: {
          status: 'TRIALING',
          trialEndsAt: newTrialEnd,
          nextRenewalDate: newTrialEnd,
        },
      });

      await prisma.tenant.update({
        where: { id: tenantId },
        data: { status: 'TRIALING' },
      });

      afterState = updated;

      await logAuditAction({
        superAdminId: admin.id,
        action: 'TRIAL_EXTENDED',
        targetTenantId: tenantId,
        before: beforeState,
        after: afterState,
        ipAddress,
        notes: `Extended trial by ${daysToAdd} days until ${newTrialEnd.toISOString().split('T')[0]}`,
      });
    } else if (action === 'END_TRIAL_EARLY') {
      const updated = await prisma.tenantSubscription.update({
        where: { tenantId },
        data: {
          status: 'ACTIVE',
          trialEndsAt: new Date(),
        },
      });

      await prisma.tenant.update({
        where: { id: tenantId },
        data: { status: 'ACTIVE' },
      });

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
      const updated = await prisma.tenantSubscription.update({
        where: { tenantId },
        data: {
          status: targetStatus,
          cancelledAt: targetStatus === 'CANCELLED' ? new Date() : null,
        },
      });

      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          status: targetStatus === 'CANCELLED' ? 'CANCELLED' : targetStatus === 'PAST_DUE' ? 'PAST_DUE' : 'ACTIVE',
        },
      });

      afterState = updated;

      await logAuditAction({
        superAdminId: admin.id,
        action: `SUBSCRIPTION_${targetStatus}`,
        targetTenantId: tenantId,
        before: beforeState,
        after: afterState,
        ipAddress,
        notes: `Updated subscription status to ${targetStatus}`,
      });
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ success: true, subscription: afterState });
  } catch (error: any) {
    console.error('Subscription update error:', error);
    return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
  }
}
