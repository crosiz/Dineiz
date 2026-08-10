import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, phone: true, tenantId: true, branchId: true }
  });
  console.log("Users:", JSON.stringify(users, null, 2));

  const mobileSessions = await prisma.mobileSession.findMany();
  console.log("Mobile Sessions:", JSON.stringify(mobileSessions, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
