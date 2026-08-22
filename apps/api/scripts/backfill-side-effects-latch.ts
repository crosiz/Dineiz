import { prisma } from '@dineiz/db';

async function main() {
  console.log('Running backfill for completed orders sideEffectsAppliedAt...');
  const result = await prisma.$executeRawUnsafe(`
    UPDATE "Order"
    SET "sideEffectsAppliedAt" = "updatedAt"
    WHERE status = 'COMPLETED' AND "sideEffectsAppliedAt" IS NULL;
  `);
  console.log(`Successfully backfilled ${result} completed order(s).`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Backfill error:', err);
  process.exit(1);
});
