import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const branches = await prisma.branch.findMany();
  console.log("Branches:");
  for (const b of branches) {
    console.log(`- ${b.name} (${b.id})`);
  }

  console.log("\nUsers:");
  const users = await prisma.user.findMany({ select: { name: true, role: true, branchId: true } });
  for (const u of users) {
    console.log(`- ${u.name} | Role: ${u.role} | Branch: ${u.branchId}`);
  }
}

run().finally(() => prisma.$disconnect());
