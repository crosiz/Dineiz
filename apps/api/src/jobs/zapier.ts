import { prisma } from '@swiftserve/db';
import { buildZapierHeaders } from '../lib/zapier';

type ZapierDeliverJob = {
  subscriptionId: string;
  payload: any;
};

export async function deliverZapierWebhook(job: ZapierDeliverJob) {
  const sub = await prisma.zapierWebhookSubscription.findUnique({ where: { id: job.subscriptionId } });
  if (!sub || !sub.isActive) return { skipped: true };

  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 10_000);

    const resp = await fetch(sub.url, {
      method: 'POST',
      headers: buildZapierHeaders({ secret: sub.secret }),
      body: JSON.stringify(job.payload),
      signal: controller.signal,
    }).finally(() => clearTimeout(t));

    const ok = resp.ok;
    const text = await resp.text().catch(() => '');

    await prisma.zapierWebhookSubscription.update({
      where: { id: sub.id },
      data: {
        lastStatus: ok ? 'DELIVERED' : 'FAILED',
        lastError: ok ? null : (text || `HTTP ${resp.status}`),
        lastDeliveredAt: ok ? new Date() : sub.lastDeliveredAt,
      },
    });

    if (!ok) throw new Error(text || `Zapier HTTP ${resp.status}`);
    return { delivered: true, status: resp.status };
  } catch (err: any) {
    await prisma.zapierWebhookSubscription.update({
      where: { id: sub.id },
      data: {
        lastStatus: 'FAILED',
        lastError: String(err?.message ?? err),
      },
    });
    throw err;
  }
}

