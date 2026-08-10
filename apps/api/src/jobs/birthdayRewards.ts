import { prisma } from '@swiftserve/db';
import { getTwilio } from '../lib/messaging';

export async function runBirthdayRewardsJob(args: { tenantId: string }) {
  // Runs daily; sends birthday reward message to customers whose birthday is today.
  // This is intentionally minimal scaffolding: it logs/sends SMS if Twilio is configured.
  const anyPrisma = prisma as any;
  if (!anyPrisma.customer?.findMany) return { sent: 0, skipped: 0 };

  const today = new Date();
  const month = today.getUTCMonth() + 1;
  const day = today.getUTCDate();

  const customers = await anyPrisma.customer.findMany({
    where: {
      tenantId: args.tenantId,
      birthDate: { not: null },
    },
    select: { id: true, name: true, phone: true, birthDate: true },
  });

  const twilio = getTwilio();
  let sent = 0;
  let skipped = 0;

  for (const c of customers) {
    const d = new Date(c.birthDate);
    const m = d.getUTCMonth() + 1;
    const dd = d.getUTCDate();
    if (m !== month || dd !== day) continue;

    if (!c.phone) {
      skipped++;
      continue;
    }

    const message = `Happy Birthday ${c.name}! 🎉 Enjoy a special reward on your next order.`;
    if (twilio && process.env.TWILIO_FROM_NUMBER) {
      await twilio.messages.create({
        from: process.env.TWILIO_FROM_NUMBER,
        to: c.phone,
        body: message,
      });
      sent++;
    } else {
      // If Twilio isn't configured, we just count as skipped (no side effects)
      skipped++;
    }
  }

  return { sent, skipped };
}

