import { PrismaClient, SuperAdminRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seedSuperAdmin() {
  console.log('🌱 Seeding initial Super Admin and Feature Flags...');

  const superAdminEmail = process.env.SUPERADMIN_INITIAL_EMAIL || 'admin@dineiz.com';
  const superAdminPassword = process.env.SUPERADMIN_INITIAL_PASSWORD || 'SuperAdminSecret2026!';
  const superAdminName = 'Dineiz Owner';

  const hashedPassword = await bcrypt.hash(superAdminPassword, 12);

  const admin = await prisma.superAdmin.upsert({
    where: { email: superAdminEmail },
    update: {
      password: hashedPassword,
      role: SuperAdminRole.OWNER,
      isActive: true,
    },
    create: {
      email: superAdminEmail,
      name: superAdminName,
      password: hashedPassword,
      role: SuperAdminRole.OWNER,
      isActive: true,
    },
  });

  console.log(`✅ Super Admin created: ${admin.email} (Role: ${admin.role})`);

  // Default Feature Flags
  const defaultFlags = [
    { key: 'kds', name: 'Kitchen Display System (KDS)', description: 'Real-time kitchen display screens', minimumPlan: 'STARTER' },
    { key: 'loyalty', name: 'CRM & Loyalty Program', description: 'Customer points and rewards tiering', minimumPlan: 'PRO' },
    { key: 'multi_branch', name: 'Multi-Branch Management', description: 'Manage multiple branches under one account', minimumPlan: 'STARTER' },
    { key: 'analytics_pro', name: 'Advanced Analytics & AI Forecasting', description: 'Deep sales insights and inventory forecasting', minimumPlan: 'PRO' },
    { key: 'aggregator_integration', name: 'Food Aggregators (Foodpanda / Careem)', description: 'Auto-sync aggregator orders to POS', minimumPlan: 'ENTERPRISE' },
    { key: 'zapier', name: 'Zapier & Webhook Integrations', description: 'Connect third party services via webhooks', minimumPlan: 'PRO' },
    { key: 'zkteco', name: 'ZKTeco Biometric Attendance', description: 'Hardware biometric device integration', minimumPlan: 'PRO' },
  ];

  for (const flag of defaultFlags) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: { name: flag.name, description: flag.description, minimumPlan: flag.minimumPlan },
      create: {
        key: flag.key,
        name: flag.name,
        description: flag.description,
        minimumPlan: flag.minimumPlan,
        isEnabled: true,
      },
    });
  }

  console.log(`✅ Default feature flags seeded (${defaultFlags.length} flags)`);
}

seedSuperAdmin()
  .catch((e) => {
    console.error('❌ Error seeding super admin:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
