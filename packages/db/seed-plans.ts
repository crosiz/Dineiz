import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const PLANS = {
  GO_FREE: {
    id: 'GO_FREE',
    name: 'Dineiz Go Free',
    displayName: 'Go Free',
    price: { monthly: 0, annual: 0 },
    currency: 'PKR',
    limits: {
      branches: 1,
      staff: 1,
      dailyOrders: 30,
      reportDaysHistory: 1,
    },
    features: {
      mobileApp: true,
      tabletPOS: false,
      adminDashboard: false,
      kds: false,
      floorPlan: false,
      inventory: false,
      crmCustomers: false,
      loyaltyProgram: false,
      dealsPromos: false,
      analytics: false,
      reports: false,
      anomalies: false,
      forecast: false,
      aggregators: false,
      qrOrdering: false,
      webhooks: false,
      whatsappBot: false,
      bluetoothPrint: false,
      fbrIntegration: false,
      multiplePaymentMethods: false,
      staffRoles: false,
      shiftManagement: false,
      customBranding: false,
    }
  },
  GO_PRO: {
    id: 'GO_PRO',
    name: 'Dineiz Go Pro',
    displayName: 'Go Pro',
    price: { monthly: 999, annual: 9990 },
    currency: 'PKR',
    limits: { branches: 1, staff: 2, dailyOrders: -1, reportDaysHistory: 30 },
    features: {
      mobileApp: true, tabletPOS: false, adminDashboard: true,
      kds: false, floorPlan: false, inventory: false,
      crmCustomers: true, loyaltyProgram: true, dealsPromos: true,
      analytics: true, reports: true, anomalies: false,
      forecast: false, aggregators: false, qrOrdering: false,
      webhooks: false, whatsappBot: true, bluetoothPrint: true,
      fbrIntegration: true, multiplePaymentMethods: true,
      staffRoles: false, shiftManagement: true, customBranding: true,
    }
  },
  STARTER: {
    id: 'STARTER',
    name: 'Dineiz Starter',
    displayName: 'Starter',
    price: { monthly: 2999, annual: 29990 },
    currency: 'PKR',
    limits: { branches: 1, staff: 5, dailyOrders: -1, reportDaysHistory: 90 },
    features: {
      mobileApp: true, tabletPOS: true, adminDashboard: true,
      kds: true, floorPlan: true, inventory: false,
      crmCustomers: true, loyaltyProgram: true, dealsPromos: true,
      analytics: true, reports: true, anomalies: false,
      forecast: false, aggregators: false, qrOrdering: true,
      webhooks: false, whatsappBot: true, bluetoothPrint: true,
      fbrIntegration: true, multiplePaymentMethods: true,
      staffRoles: true, shiftManagement: true, customBranding: true,
    }
  },
  PRO: {
    id: 'PRO',
    name: 'Dineiz Pro',
    displayName: 'Pro',
    price: { monthly: 4999, annual: 49990 },
    currency: 'PKR',
    limits: { branches: 3, staff: -1, dailyOrders: -1, reportDaysHistory: 365 },
    features: {
      mobileApp: true, tabletPOS: true, adminDashboard: true,
      kds: true, floorPlan: true, inventory: true,
      crmCustomers: true, loyaltyProgram: true, dealsPromos: true,
      analytics: true, reports: true, anomalies: true,
      forecast: false, aggregators: true, qrOrdering: true,
      webhooks: true, whatsappBot: true, bluetoothPrint: true,
      fbrIntegration: true, multiplePaymentMethods: true,
      staffRoles: true, shiftManagement: true, customBranding: true,
    }
  },
  ENTERPRISE: {
    id: 'ENTERPRISE',
    name: 'Dineiz Enterprise',
    displayName: 'Enterprise',
    price: { monthly: 9999, annual: 99990 },
    currency: 'PKR',
    limits: { branches: -1, staff: -1, dailyOrders: -1, reportDaysHistory: -1 },
    features: {
      mobileApp: true, tabletPOS: true, adminDashboard: true,
      kds: true, floorPlan: true, inventory: true,
      crmCustomers: true, loyaltyProgram: true, dealsPromos: true,
      analytics: true, reports: true, anomalies: true,
      forecast: true, aggregators: true, qrOrdering: true,
      webhooks: true, whatsappBot: true, bluetoothPrint: true,
      fbrIntegration: true, multiplePaymentMethods: true,
      staffRoles: true, shiftManagement: true, customBranding: true,
    }
  }
};

async function main() {
  console.log('Seeding plans...');
  for (const plan of Object.values(PLANS)) {
    await prisma.planDefinition.upsert({
      where: { id: plan.id },
      update: {
        name: plan.name,
        displayName: plan.displayName,
        price: plan.price,
        currency: plan.currency,
        limits: plan.limits,
        features: plan.features,
      },
      create: {
        id: plan.id,
        name: plan.name,
        displayName: plan.displayName,
        price: plan.price,
        currency: plan.currency,
        limits: plan.limits,
        features: plan.features,
      },
    });
    console.log(`Upserted plan: ${plan.id}`);
  }
  console.log('Plans seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
