import { prisma } from '@dineiz/db';
import { sendWhatsAppMessage } from '../lib/whatsapp';
import { computeShiftTotals } from '../routes/shift/shift.service';
import { recomputeShiftAggregate } from '../lib/shiftAggregate';

export async function processAbandonedShifts() {
  console.log('Running abandoned shifts check...');
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

  // Spec Part 6 / Part 12 — a shift closed to PENDING_SYNC whose terminal
  // never came back online. After 6h, finalise it from whatever did reach the
  // server (the client's own sync-complete call is the normal path; this is
  // the safety net) so the dashboard doesn't show a permanently-pending row.
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const stalePendingSync = await prisma.shift.findMany({
    where: { status: 'PENDING_SYNC', pendingSyncAt: { lt: sixHoursAgo } },
    select: { id: true },
  });
  for (const s of stalePendingSync) {
    const totals = await computeShiftTotals(s.id);
    await recomputeShiftAggregate(s.id).catch(() => {});
    await prisma.shift.update({
      where: { id: s.id },
      data: { status: 'CLOSED', pendingSyncAt: null, pendingSyncCount: null, ...totals },
    });
    await prisma.shiftActivity.create({
      data: { shiftId: s.id, activityType: 'CLOSED', notes: 'Auto-finalised after 6h pending sync — flag for review' },
    }).catch(() => {});
    console.warn(`[abandonedShifts] auto-finalised stale PENDING_SYNC shift ${s.id}`);
  }

  // Part 13 — the "auto-close abandoned after N hours" threshold is a
  // per-tenant console setting. Sweep everything open >12h, then compare
  // each against its own tenant's configured window (default 24h).
  const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
  const shifts = await prisma.shift.findMany({
    where: {
      status: 'OPEN',
      openedAt: { lt: twelveHoursAgo },
    },
    include: {
      user: { select: { name: true, phone: true } },
      tenant: { select: { users: { where: { role: { in: ['TENANT_ADMIN', 'BRANCH_MANAGER'] } }, select: { phone: true } } } },
      branch: { select: { name: true } },
      activities: {
        orderBy: { occurredAt: 'desc' },
        take: 1,
      },
    },
  });

  const tenantIds = [...new Set(shifts.map((s) => s.tenantId))];
  const brandings = tenantIds.length
    ? await prisma.tenantBranding.findMany({ where: { tenantId: { in: tenantIds } }, select: { tenantId: true, autoCloseAbandonedHours: true } })
    : [];
  const windowByTenant = new Map(brandings.map((b) => [b.tenantId, b.autoCloseAbandonedHours ?? 24]));

  for (const shift of shifts) {
    const winHours = windowByTenant.get(shift.tenantId) ?? 24;
    const openTooLong = shift.openedAt < new Date(Date.now() - winHours * 60 * 60 * 1000);
    if (!openTooLong) continue;

    const lastActivity = shift.activities[0];
    const lastActivityTime = lastActivity ? lastActivity.occurredAt : shift.openedAt;

    if (lastActivityTime < twoHoursAgo) {
      // Freeze the sales figures onto the shift the same way a normal close
      // does. An abandoned shift that took PKR 40,000 should say so in Shift
      // Management, not read as a blank row — the cash is still missing and
      // someone has to account for it.
      const totals = await computeShiftTotals(shift.id);
      await prisma.shift.update({
        where: { id: shift.id },
        data: { status: 'ABANDONED', closedAt: new Date(), ...totals },
      });
      
      await prisma.shiftActivity.create({
        data: {
          shiftId: shift.id,
          activityType: 'FORCE_CLOSED',
          notes: 'Shift automatically marked as ABANDONED due to inactivity.',
        }
      });

      for (const manager of shift.tenant.users) {
        if (manager.phone) {
          const message = `Attention: ${shift.user.name}'s shift at ${shift.branch.name} has been inactive for 2 hours and was not closed properly. Please review shift #${shift.id.slice(-6)}.`;
          await sendWhatsAppMessage({ to: manager.phone, body: message }).catch((e) => console.error('Failed to send WA to', manager.phone, e));
        }
      }
    }
  }
}
