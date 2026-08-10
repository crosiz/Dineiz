const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: 'TENANT_ADMIN' } });
  if (admin) {
    const tenant = await prisma.tenant.update({
      where: { id: admin.tenantId },
      data: { plan: 'ENTERPRISE' }
    });
    console.log('Upgraded Tenant Plan:', tenant.plan);
  } else {
    console.log('No TENANT_ADMIN found');
  }
}

main().finally(() => prisma.$disconnect());
