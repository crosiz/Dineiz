import { prisma } from '@dineiz/db';

export const PLANS = {
  STARTER: {
    name: 'Starter Plan',
    monthlyPrice: 4999,
    annualPrice: 4999 * 12 * 0.8,
    branchLimit: 1,
    staffLimit: 5,
    storageLimitGB: 5,
    features: ['1 Branch', '5 Staff Members', 'Standard Support', 'Basic Analytics']
  },
  PRO: {
    name: 'Pro Plan',
    monthlyPrice: 11999,
    annualPrice: 11999 * 12 * 0.8,
    branchLimit: 10,
    staffLimit: null, // unlimited
    storageLimitGB: 50,
    features: ['10 Branches', 'Unlimited Staff', 'Advanced Analytics', 'KDS & Floor Plan', 'Integrations']
  },
  ENTERPRISE: {
    name: 'Enterprise',
    monthlyPrice: null, // Custom
    annualPrice: null,
    branchLimit: null,
    staffLimit: null,
    storageLimitGB: 500,
    features: ['Unlimited Branches', 'Custom Integrations', '24/7 Priority Support', 'Dedicated Account Manager', 'SLA Guarantee']
  }
};

export async function getTenantSubscription(tenantId: string) {
  let sub = await prisma.tenantSubscription.findUnique({
    where: { tenantId }
  });

  if (!sub) {
    const nextRenewal = new Date();
    nextRenewal.setMonth(nextRenewal.getMonth() + 1);
    sub = await prisma.tenantSubscription.create({
      data: {
        tenantId,
        plan: 'STARTER',
        billingCycle: 'MONTHLY',
        nextRenewalDate: nextRenewal,
      }
    });
  }

  // Calculate usage
  const branchesUsed = await prisma.branch.count({
    where: { tenantId, deletedAt: null }
  });

  const activeStaff = await prisma.user.count({
    where: { tenantId, status: 'ACTIVE' }
  });

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const ordersThisMonth = await prisma.order.count({
    where: {
      tenantId,
      createdAt: { gte: startOfMonth }
    }
  });

  const planDef = PLANS[sub.plan as keyof typeof PLANS] || PLANS.STARTER;

  return {
    plan: sub.plan,
    planName: planDef.name,
    monthlyPrice: sub.billingCycle === 'ANNUAL' ? (planDef.annualPrice! / 12) : planDef.monthlyPrice,
    currency: 'PKR',
    billingCycle: sub.billingCycle,
    nextRenewalDate: sub.nextRenewalDate.toISOString(),
    status: sub.status,
    usage: {
      branchesUsed,
      branchLimit: planDef.branchLimit,
      activeStaff,
      staffLimit: planDef.staffLimit,
      ordersThisMonth,
      storageUsedGB: 2.4, // Mock for now
      storageLimitGB: planDef.storageLimitGB
    },
    features: planDef.features
  };
}

export async function getPaymentHistory(tenantId: string) {
  const history = await prisma.paymentHistory.findMany({
    where: { tenantId },
    orderBy: { paidAt: 'desc' }
  });
  
  if (history.length === 0) {
    // Generate some mock history for demo
    const mock = await prisma.paymentHistory.create({
      data: {
        tenantId,
        amount: 11999,
        description: 'Pro Plan - Monthly',
        paidAt: new Date(),
      }
    });
    return [mock];
  }
  
  return history;
}

export async function changePlan(tenantId: string, newPlan: string, billingCycle: string) {
  const nextRenewal = new Date();
  nextRenewal.setMonth(nextRenewal.getMonth() + (billingCycle === 'ANNUAL' ? 12 : 1));

  await prisma.tenantSubscription.update({
    where: { tenantId },
    data: {
      plan: newPlan,
      billingCycle,
      nextRenewalDate: nextRenewal
    }
  });
  
  const planDef = PLANS[newPlan as keyof typeof PLANS] || PLANS.STARTER;
  
  if (newPlan !== 'ENTERPRISE') {
    await prisma.paymentHistory.create({
      data: {
        tenantId,
        amount: billingCycle === 'ANNUAL' ? planDef.annualPrice! : planDef.monthlyPrice!,
        description: `${planDef.name} - ${billingCycle === 'ANNUAL' ? 'Annual' : 'Monthly'}`,
        paidAt: new Date()
      }
    });
  }

  return { success: true, message: 'Plan updated successfully' };
}
