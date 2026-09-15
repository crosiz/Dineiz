/**
 * Dev cleanup: void every "orphan" order — an active order (PENDING /
 * IN_KITCHEN / READY) whose shift is not OPEN. These pile up from force-closed
 * and inactivity-abandoned shifts during testing and re-trigger the blocking
 * OrphanResolutionModal on every shift open.
 *
 * Run from the repo root:  npx tsx apps/api/scripts/clear-orphan-orders.ts
 * Add --branch <branchId> to limit to one branch (default: all branches).
 */
import { prisma } from '@dineiz/db';

async function main() {
  const branchArg = process.argv.indexOf('--branch');
  const branchId = branchArg > -1 ? process.argv[branchArg + 1] : undefined;

  const where = {
    status: { in: ['PENDING', 'IN_KITCHEN', 'READY'] as const },
    shift: { status: { not: 'OPEN' as const } },
    ...(branchId ? { branchId } : {}),
  };

  const orphans = await prisma.order.findMany({
    where,
    select: { id: true, orderNumber: true, status: true, branchId: true },
  });

  if (orphans.length === 0) {
    console.log('No orphan orders found. Nothing to do.');
    return;
  }

  console.log(`Found ${orphans.length} orphan order(s):`);
  for (const o of orphans) console.log(`  ${o.orderNumber}  ${o.status}  (branch ${o.branchId})`);

  const ids = orphans.map((o) => o.id);

  // Poisoned PKR-0 payment attempts leave zero-value Payment rows; drop them so
  // the voided order doesn't carry a bogus payment.
  const zeroPays = await prisma.payment.deleteMany({ where: { orderId: { in: ids }, amount: { lte: 0 } } });
  if (zeroPays.count) console.log(`Deleted ${zeroPays.count} zero-value payment row(s).`);

  const res = await prisma.order.updateMany({
    where: { id: { in: ids } },
    data: { status: 'CANCELLED', notes: 'Dev cleanup: abandoned test order from a closed shift (bulk-voided).' },
  });
  console.log(`\nVoided ${res.count} orphan order(s). Tables and close-shift blockers will clear.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
