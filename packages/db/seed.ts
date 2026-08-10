import 'dotenv/config';
import { hashPassword } from 'better-auth/crypto';
import { prisma } from './index';
import crypto from 'crypto';

function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

async function main() {
  const tenantId = process.env.SEED_TENANT_ID || 'seed-tenant';
  const tenantName = process.env.SEED_TENANT_NAME || 'Dineiz Go Demo';
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@dineiz.local';
  const adminName = process.env.SEED_ADMIN_NAME || 'Admin';
  const adminPin = process.env.SEED_ADMIN_PIN || '1234';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@123456';
  const branchName = process.env.SEED_BRANCH_NAME || 'Main Branch';

  const tenant = await prisma.tenant.upsert({
    where: { id: tenantId },
    create: { id: tenantId, name: tenantName },
    update: { name: tenantName },
  });

  const branch = await prisma.branch.upsert({
    where: { id: `${tenant.id}-main` },
    create: {
      id: `${tenant.id}-main`,
      tenantId: tenant.id,
      name: branchName,
      address: 'Demo Address',
      phone: '0000000000',
    },
    update: { name: branchName },
  });

  // POS pin login expects sha256(pin) (see `apps/api/src/routes/pin.ts`)
  const hashedPin = hashPin(adminPin);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      name: adminName,
      emailVerified: true,
      tenantId: tenant.id,
      branchId: branch.id,
      role: 'TENANT_ADMIN',
      posPin: hashedPin,
    },
    update: {
      name: adminName,
      tenantId: tenant.id,
      branchId: branch.id,
      role: 'TENANT_ADMIN',
      posPin: hashedPin,
      emailVerified: true,
    },
  });

  // Seed Better Auth credential so Dashboard email/password login works.
  // better-auth uses scrypt hashes via `better-auth/crypto`.
  const credentialHash = await hashPassword(adminPassword);

  // Create or Update Admin Credential
  const existingAdminCredential = await prisma.account.findFirst({
    where: { userId: admin.id, providerId: 'credential' },
  });
  if (existingAdminCredential) {
    await prisma.account.update({
      where: { id: existingAdminCredential.id },
      data: { password: credentialHash },
    });
  } else {
    await prisma.account.create({
      data: { userId: admin.id, providerId: 'credential', accountId: admin.id, password: credentialHash },
    });
  }

  // Add Manager User
  const managerEmail = 'manager@dineiz.local';
  const managerPassword = 'Manager@1234';
  const managerName = 'Manager';
  const managerPin = '5678';
  const hashedManagerPin = hashPin(managerPin);

  const manager = await prisma.user.upsert({
    where: { email: managerEmail },
    create: {
      email: managerEmail,
      name: managerName,
      emailVerified: true,
      tenantId: tenant.id,
      branchId: branch.id,
      role: 'BRANCH_MANAGER',
      posPin: hashedManagerPin,
    },
    update: {
      name: managerName,
      tenantId: tenant.id,
      branchId: branch.id,
      role: 'BRANCH_MANAGER',
      posPin: hashedManagerPin,
      emailVerified: true,
    },
  });

  // Create or Update Manager Credential
  const managerCredentialHash = await hashPassword(managerPassword);
  const existingManagerCredential = await prisma.account.findFirst({
    where: { userId: manager.id, providerId: 'credential' },
  });
  if (existingManagerCredential) {
    await prisma.account.update({
      where: { id: existingManagerCredential.id },
      data: { password: managerCredentialHash },
    });
  } else {
    await prisma.account.create({
      data: { userId: manager.id, providerId: 'credential', accountId: manager.id, password: managerCredentialHash },
    });
  }

  // Minimal menu so POS/QR/KDS screens have data.
  const category = await prisma.category.upsert({
    where: { id: `${tenant.id}-cat-demo` },
    create: {
      id: `${tenant.id}-cat-demo`,
      tenantId: tenant.id,
      name: 'Demo Items',
      description: 'Seeded demo category',
      sortOrder: 0,
    },
    update: {},
  });

  await prisma.item.upsert({
    where: { id: `${tenant.id}-item-burger` },
    create: {
      id: `${tenant.id}-item-burger`,
      tenantId: tenant.id,
      categoryId: category.id,
      name: 'Classic Burger',
      description: 'Seeded demo item',
      basePrice: 499,
      isAvailable: true,
      sortOrder: 0,
    },
    update: {},
  });

  await prisma.item.upsert({
    where: { id: `${tenant.id}-item-fries` },
    create: {
      id: `${tenant.id}-item-fries`,
      tenantId: tenant.id,
      categoryId: category.id,
      name: 'French Fries',
      description: 'Seeded demo item',
      basePrice: 199,
      isAvailable: true,
      sortOrder: 1,
    },
    update: {},
  });

  await prisma.branchMenuCategory.upsert({
    where: {
      branchId_categoryId: {
        branchId: branch.id,
        categoryId: category.id,
      },
    },
    create: {
      branchId: branch.id,
      categoryId: category.id,
      isAvailable: true,
    },
    update: {},
  });

  await prisma.branchMenuItem.upsert({
    where: {
      branchId_itemId: {
        branchId: branch.id,
        itemId: `${tenant.id}-item-burger`,
      },
    },
    create: {
      branchId: branch.id,
      itemId: `${tenant.id}-item-burger`,
      isAvailable: true,
      isInStock: true,
    },
    update: {},
  });

  await prisma.branchMenuItem.upsert({
    where: {
      branchId_itemId: {
        branchId: branch.id,
        itemId: `${tenant.id}-item-fries`,
      },
    },
    create: {
      branchId: branch.id,
      itemId: `${tenant.id}-item-fries`,
      isAvailable: true,
      isInStock: true,
    },
    update: {},
  });

  // Seed Customer
  const customer = await prisma.customer.upsert({
    where: { tenantId_phone: { phone: '03000000000', tenantId: tenant.id } },
    create: {
      tenantId: tenant.id,
      name: 'Demo Customer',
      phone: '03000000000',
      email: 'customer@demo.local',
    },
    update: {},
  });

  // Seed Table
  const table = await prisma.table.create({
    data: {
      tenantId: tenant.id,
      branchId: branch.id,
      label: 'T1',
      capacity: 4,
      positionX: 100,
      positionY: 100,
      shape: 'round',
      width: 80,
      height: 80,
      rotation: 0,
      floorNumber: 1,
    }
  });

  // Seed KdsStation
  const kdsStation = await prisma.kdsStation.create({
    data: {
      tenantId: tenant.id,
      branchId: branch.id,
      name: 'Grill Station',
      catchAll: true,
    }
  });

  // Seed Shift
  const shift = await prisma.shift.create({
    data: {
      tenantId: tenant.id,
      branchId: branch.id,
      userId: manager.id,
      openingFloat: 5000,
      status: 'OPEN',
    },
  });

  // Seed Order
  const order = await prisma.order.create({
    data: {
      tenantId: tenant.id,
      branchId: branch.id,
      orderNumber: 'ORD-1001',
      shiftId: shift.id,
      status: 'DELIVERED',
      type: 'DINE_IN',
      totalAmount: 698,
      netAmount: 698,
      items: {
        create: [
          {
            itemId: `${tenant.id}-item-burger`,
            quantity: 1,
            unitPrice: 499,
            subtotal: 499,
          },
          {
            itemId: `${tenant.id}-item-fries`,
            quantity: 1,
            unitPrice: 199,
            subtotal: 199,
          }
        ]
      },
      payments: {
        create: [
          {
            amount: 698,
            method: 'CASH',
            status: 'COMPLETED',
          }
        ]
      }
    }
  });

  console.log('Seed complete');
  console.log({ tenantId: tenant.id, branchId: branch.id, adminEmail: admin.email, adminPassword, adminPin });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

