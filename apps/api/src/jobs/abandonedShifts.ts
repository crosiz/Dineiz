import { prisma } from '@dineiz/db';
import { sendWhatsAppMessage } from '../lib/whatsapp';
import { computeShiftTotals } from '../routes/shift/shift.service';

export async function processAbandonedShifts() {
  console.log('Running abandoned shifts check...');
  const twentyHoursAgo = new Date(Date.now() - 20 * 60 * 60 * 1000);
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

  const shifts = await prisma.shift.findMany({
    where: {
      status: 'OPEN',
      openedAt: { lt: twentyHoursAgo },
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

  for (const shift of shifts) {
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
