const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const b = await prisma.branch.findFirst({ where: { name: 'Main Branch' }});
  console.log('Main Branch ID:', b?.id);
}

main().finally(() => prisma.$disconnect());
