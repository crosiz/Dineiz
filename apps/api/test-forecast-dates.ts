import { PrismaClient } from '@prisma/client';
import { generateRevenueForecast } from './src/routes/forecast/forecast.service';

const prisma = new PrismaClient();

import { redis } from './src/lib/redis';

async function main() {
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) throw new Error("No tenant");
  
  const keys = await redis.keys('forecast:*');
  if (keys.length > 0) await redis.del(...keys);
  
  const rev = await generateRevenueForecast(tenant.id);
  
  // Test python directly
  const response = await fetch(`http://localhost:8090/forecast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history: rev.actuals, horizon_days: 30, seasonality_mode: 'additive' })
  });
  if (!response.ok) {
      console.log("Python failed:", response.status, await response.text());
  } else {
      const data = await response.json();
      console.log("Python predictions:", data.forecast?.length);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
