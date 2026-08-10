import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Use executeRaw to bypass Prisma schema checks for the column
  await prisma.$executeRaw`TRUNCATE TABLE "MobileSession" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE "OtpSession" CASCADE;`;
  
  // Also drop MobileUser table entirely if it exists, since we removed it from schema
  try {
    await prisma.$executeRaw`DROP TABLE "MobileUser" CASCADE;`;
    console.log("Dropped MobileUser table");
  } catch (e) {
    console.log("MobileUser table might not exist or already dropped");
  }
  
  console.log("Successfully truncated sessions!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
