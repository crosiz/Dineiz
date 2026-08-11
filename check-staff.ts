import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkStaff() {
  const branch = await prisma.branch.findFirst({ orderBy: { name: 'asc' } });
  if (!branch) {
    console.log('No branches found!');
    process.exit(0);
  }
  console.log(`Found branch: ${branch.name} (${branch.id})`);

  const staff = await prisma.user.findMany({
    where: { 
      branchId: branch.id
    }
  });

  console.log(`Found ${staff.length} staff members.`);
  for (const s of staff) {
    console.log(`- ${s.name} (${s.role}) - PIN: ${s.posPin ? 'Set' : 'Not Set'}`);
  }
  process.exit(0);
}

checkStaff();
