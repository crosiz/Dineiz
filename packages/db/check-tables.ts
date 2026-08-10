import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { name: { in: ['Ali Hassan', 'Zara Sheikh'] } },
    select: { id: true, name: true, branchId: true }
  });
  
  console.log('Users:', users);
  
  for (const user of users) {
    if (user.branchId) {
      const tables = await prisma.table.findMany({ where: { branchId: user.branchId } });
      console.log(`Branch ${user.branchId} tables count: ${tables.length}`);
      
      if (tables.length === 0) {
         console.log(`Creating table for branch ${user.branchId}...`);
         const branch = await prisma.branch.findUnique({ where: { id: user.branchId } });
         await prisma.table.create({
            data: {
               tenantId: branch.tenantId,
               branchId: user.branchId,
               label: 'Test Table',
               capacity: 4,
               positionX: 50,
               positionY: 50,
               shape: 'round',
               width: 80,
               height: 80,
               rotation: 0,
               floorNumber: 1
            }
         });
         console.log('Table created!');
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
