import 'dotenv/config';
import { prisma } from '@dineiz/db';
import { computeShiftTotals } from '../src/routes/shift/shift.service';

/**
 * Backfills the stored sales columns on shifts that ended without them.
 *
 * Until now only a normal close wrote totalSales/totalCash/totalCard/… onto a
 * Shift. A shift that was auto-marked ABANDONED by the inactivity sweeper (or
 * force-closed early on) kept them NULL, so Shift Management showed it as a
 * PKR 0 row and the range totals under-reported by whatever those shifts took.
 * The sweeper now writes them (see jobs/abandonedShifts.ts); this fixes the
 * shifts that ended before that.
 *
 * Safe to re-run: it only touches non-OPEN shifts whose totalSales is NULL,
 * and it derives every figure from orders and payments that already exist —
 * nothing is invented. Run with --dry to see what would change.
 *
 *   pnpm --filter api exec tsx scripts/backfill-shift-totals.ts --dry
 *   pnpm --filter api exec tsx scripts/backfill-shift-totals.ts
 */
async function main() {
  const dryRun = process.argv.includes('--dry');

  const shifts = await prisma.shift.findMany({
    where: { status: { not: 'OPEN' }, totalSales: null },
    select: { id: true, status: true, openedAt: true, openingFloat: true, closingCash: true, branch: { select: { name: true } }, user: { select: { name: true } } },
    orderBy: { openedAt: 'asc' },
  });

  console.log(`${shifts.length} shift(s) with missing totals${dryRun ? ' (dry run — nothing will be written)' : ''}\n`);
  if (shifts.length === 0) return;

  let written = 0;
  let recoveredSales = 0;

  for (const shift of shifts) {
    const totals = await computeShiftTotals(shift.id);
    recoveredSales += totals.totalSales;

    // Variance is only meaningful where the drawer was actually counted; an
    // abandoned shift never was, so it stays null rather than being invented.
    const cashEntries = await prisma.shiftCashEntry.groupBy({ by: ['type'], where: { shiftId: shift.id }, _sum: { amount: true } });
    const cashIn = cashEntries.find((e) => e.type === 'CASH_IN')?._sum.amount ?? 0;
    const cashOut = cashEntries.find((e) => e.type === 'CASH_OUT')?._sum.amount ?? 0;
    const expected = shift.openingFloat + totals.totalCash + cashIn - cashOut;
    const cashVariance = shift.closingCash === null ? null : Number((shift.closingCash - expected).toFixed(2));

    const label = `${shift.openedAt.toISOString().slice(0, 10)} ${shift.status.padEnd(9)} ${(shift.branch?.name ?? '?').padEnd(18)} ${(shift.user?.name ?? '?').padEnd(14)}`;
    console.log(`${label} sales=${Math.round(totals.totalSales)} orders=${totals.totalOrders} variance=${cashVariance ?? 'n/a'}`);

    if (!dryRun) {
      await prisma.shift.update({ where: { id: shift.id }, data: { ...totals, ...(cashVariance !== null ? { cashVariance } : {}) } });
      written++;
    }
  }

  console.log(`\n${dryRun ? 'Would recover' : 'Recovered'} PKR ${Math.round(recoveredSales).toLocaleString('en-US')} across ${shifts.length} shift(s).`);
  if (!dryRun) console.log(`${written} shift(s) updated.`);
}

main()
  .catch((e) => { console.error('Backfill failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
