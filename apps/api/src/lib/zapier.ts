import { prisma } from '@dineiz/db';

export type ZapierEventName =
  | 'order.created'
  | 'order.updated'
  | 'order.cancelled'
  | 'order.delivered'
  | (string & {});

export async function listActiveZapierSubscriptions(tenantId: string, event: ZapierEventName) {
  return prisma.zapierWebhookSubscription.findMany({
    where: { tenantId, event, isActive: true },
  });
}

export function buildZapierHeaders(sub: { secret: string | null }) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (sub.secret) headers['X-Dineiz-Webhook-Secret'] = sub.secret;
  return headers;
}

