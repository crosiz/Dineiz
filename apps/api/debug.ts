import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  const tenants = await prisma.tenant.findMany();
  const branches = await prisma.branch.findMany();
  const items = await prisma.item.findMany();
  const branchItems = await prisma.branchMenuItem.findMany();

  console.log("Users:", JSON.stringify(users, null, 2));
  console.log("Tenants:", JSON.stringify(tenants, null, 2));
  console.log("Branches:", JSON.stringify(branches, null, 2));
  console.log("Items:", JSON.stringify(items, null, 2));
  console.log("BranchMenuItems:", JSON.stringify(branchItems, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
