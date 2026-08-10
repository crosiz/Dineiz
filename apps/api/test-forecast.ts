import { PrismaClient } from '@prisma/client';
import { generateInventoryForecast } from './src/routes/forecast/forecast.service';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) throw new Error("No tenant");
  
  console.log("Testing generateInventoryForecast...");
  try {
    const inv = await generateInventoryForecast(tenant.id);
    console.log("Inventory success:", !!inv);
  } catch (err) {
    console.error("Inventory failed:", err);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
