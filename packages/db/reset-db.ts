import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  await prisma.order.deleteMany({});
  await prisma.shift.deleteMany({});
  console.log('Deleted all orders and shifts');
}
main().catch(console.error).finally(() => prisma.$disconnect());
