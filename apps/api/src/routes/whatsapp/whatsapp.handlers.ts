import { FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { prisma } from '@dineiz/db';
import { whatsappQueue } from '../../lib/queue';
import { getConfig, updateConfig, listConversations, ingestInboundMessage } from './whatsapp.service';

export async function handleWebhookVerify(request: FastifyRequest, reply: FastifyReply) {
  const query = request.query as Record<string, string>;
  const mode = query['hub.mode'];
  const token = query['hub.verify_token'];
  const challenge = query['hub.challenge'];

  if (mode === 'subscribe' && process.env.WHATSAPP_VERIFY_TOKEN && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return reply.status(200).send(challenge);
  }
  return reply.status(403).send();
}

function isValidSignature(request: FastifyRequest): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) return true; // no secret configured — skip verification (dev/MVP)

  const signatureHeader = request.headers['x-hub-signature-256'] as string | undefined;
  const rawBody = (request as any).rawBody as Buffer | undefined;
  if (!signatureHeader || !rawBody) return false;

  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signatureHeader);
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

export async function handleWebhook(request: FastifyRequest, reply: FastifyReply) {
  // Meta expects a fast ack — always enqueue, never do the AI call inline.
  reply.status(200).send({ ok: true });

  try {
    if (!isValidSignature(request)) {
      request.log.warn('[WhatsApp Webhook] Invalid signature, dropping payload');
      return;
    }

    const body: any = request.body;
    if (body?.object !== 'whatsapp_business_account') return;

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages') continue;

        const value = change.value;
        const phoneNumberId = value?.metadata?.phone_number_id;
        const messages = value?.messages ?? [];
        if (!phoneNumberId || messages.length === 0) continue;

        const config = await prisma.whatsAppConfig.findFirst({ where: { metaPhoneNumberId: phoneNumberId } });
        if (!config || !config.isEnabled) continue;

        for (const msg of messages) {
          try {
            const result = await ingestInboundMessage(config, msg);
            if (result) await whatsappQueue.add('process-message', { messageId: result.messageId });
          } catch (err) {
            request.log.error(err, '[WhatsApp Webhook] Failed to ingest message');
          }
        }
      }
    }
  } catch (err) {
    request.log.error(err, '[WhatsApp Webhook] Error');
  }
}

export async function handleGetConfig(request: FastifyRequest, reply: FastifyReply) {
  const tenantId = request.user!.tenantId!;
  const config = await getConfig(tenantId);
  return reply.send({ config });
}

export async function handleUpdateConfig(request: FastifyRequest, reply: FastifyReply) {
  const tenantId = request.user!.tenantId!;
  const config = await updateConfig(tenantId, request.body as any);
  return reply.send({ config });
}

export async function handleListConversations(request: FastifyRequest, reply: FastifyReply) {
  const tenantId = request.user!.tenantId!;
  const { status, limit } = request.query as { status: 'active' | 'all'; limit: number };
  const conversations = await listConversations(tenantId, status, limit);
  return reply.send({ conversations });
}
