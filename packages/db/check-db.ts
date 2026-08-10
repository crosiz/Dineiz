import { PrismaClient } from './src';

const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany({ include: { items: true, categories: true } });
  console.log("Tenants:", JSON.stringify(tenants, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
