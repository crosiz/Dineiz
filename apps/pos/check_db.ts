const { PrismaClient } = require('@dineiz/db');
const prisma = new PrismaClient();

async function check() {
  const branches = await prisma.branch.findMany({ select: { id: true, name: true } });
  console.log("Branches:", branches);
  
  const staff = await prisma.user.findMany({ 
    select: { id: true, name: true, role: true, branchId: true }
  });
  console.log("Staff:", staff);
}

check().catch(console.error).finally(() => prisma.$disconnect());
