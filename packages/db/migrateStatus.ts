import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$executeRawUnsafe(`UPDATE "Order" SET status = 'COMPLETED' WHERE status = 'DELIVERED'`);
  console.log(`Updated ${result} orders from DELIVERED to COMPLETED`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
