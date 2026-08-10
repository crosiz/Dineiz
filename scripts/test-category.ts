import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const categories = await prisma.category.findMany();
  const branches = await prisma.branch.findMany();

  for (const cat of categories) {
    for (const branch of branches) {
      if (branch.tenantId !== cat.tenantId) continue;
      
      const existing = await prisma.branchMenuCategory.findUnique({
        where: {
          branchId_categoryId: {
            branchId: branch.id,
            categoryId: cat.id,
          }
        }
      });

      if (!existing) {
        await prisma.branchMenuCategory.create({
          data: {
            branchId: branch.id,
            categoryId: cat.id,
            isAvailable: true,
          }
        });
        console.log(`Created missing branch config for category ${cat.name} in branch ${branch.name}`);
      }
    }
  }

  // Same for items to be safe
  const items = await prisma.item.findMany();
  for (const item of items) {
    for (const branch of branches) {
      if (branch.tenantId !== item.tenantId) continue;

      const existing = await prisma.branchMenuItem.findUnique({
        where: {
          branchId_itemId: {
            branchId: branch.id,
            itemId: item.id,
          }
        }
      });

      if (!existing) {
        await prisma.branchMenuItem.create({
          data: {
            branchId: branch.id,
            itemId: item.id,
            isAvailable: true,
            isInStock: true,
          }
        });
        console.log(`Created missing branch config for item ${item.name} in branch ${branch.name}`);
      }
    }
  }
}
main();
