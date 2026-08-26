import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@dineiz/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Resend signs webhooks the way Svix does: HMAC-SHA256 over
// `${svix-id}.${svix-timestamp}.${rawBody}` using the base64-decoded secret,
// compared against each `v1,<base64sig>` entry in the svix-signature header.
function verifySignature(rawBody: string, headers: Headers, secret: string): boolean {
  const id = headers.get('svix-id');
  const timestamp = headers.get('svix-timestamp');
  const signatureHeader = headers.get('svix-signature');
  if (!id || !timestamp || !signatureHeader) return false;

  // Reject stale deliveries/replays beyond 5 minutes.
  const timestampMs = Number(timestamp) * 1000;
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60_000) return false;

  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const signedContent = `${id}.${timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secretBytes).update(signedContent).digest('base64');

  return signatureHeader
    .split(' ')
    .some((entry) => {
      const [, sig] = entry.split(',');
      if (!sig) return false;
      const a = Buffer.from(sig);
      const b = Buffer.from(expected);
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const secret = process.env.RESEND_WEBHOOK_SECRET;

  if (secret) {
    if (!verifySignature(rawBody, request.headers, secret)) {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }
  } else {
    console.warn('[resend webhook] RESEND_WEBHOOK_SECRET not set — accepting unverified payload');
  }

  let event: { type?: string; data?: { email_id?: string; to?: string[] } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const providerMessageId = event.data?.email_id;
  if (!providerMessageId) {
    return NextResponse.json({ received: true, note: 'no email_id on payload' });
  }

  const log = await prisma.emailLog.findFirst({ where: { providerMessageId } });
  if (!log) {
    return NextResponse.json({ received: true, note: 'no matching EmailLog row' });
  }

  switch (event.type) {
    case 'email.delivered':
      await prisma.emailLog.update({ where: { id: log.id }, data: { status: 'DELIVERED', deliveredAt: new Date() } });
      break;
    case 'email.bounced':
      await prisma.emailLog.update({ where: { id: log.id }, data: { status: 'BOUNCED' } });
      if (log.tenantId) {
        console.error(`[resend webhook] Hard bounce for tenant ${log.tenantId} (${log.recipientEmail}) — surfaced on the super admin dashboard's Needs Attention panel`);
      }
      break;
    case 'email.complained':
      await prisma.emailLog.update({ where: { id: log.id }, data: { status: 'BOUNCED', errorMessage: 'Recipient marked as spam' } });
      break;
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
