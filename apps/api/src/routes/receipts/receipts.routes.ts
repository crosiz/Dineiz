import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { prisma } from '@swiftserve/db';
import { requireTenant } from '../../middleware/auth';
import { z } from 'zod';
import { getResend, getTwilio } from '../../lib/messaging';
import { env } from '../../env';
import { sendWhatsAppMessage } from '../../lib/whatsapp';

const SendReceiptSchema = z.object({
  orderId: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().min(6).optional(),
  whatsapp: z.string().min(6).optional(),
});

export const receiptsRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.post('/api/receipts/send', {
    schema: { body: SendReceiptSchema },
    preHandler: requireTenant,
  }, async (request, reply) => {
    const tenantId = request.user!.tenantId!;
    const { orderId, email, phone, whatsapp } = (request.body as any);

    const order = await prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: { branch: true, items: { include: { item: { select: { name: true } } } }, payments: true },
    });
    if (!order) return reply.status(404).send({ error: 'Order not found' });

    const summary = [
      `Order: ${order.orderNumber}`,
      `Token: ${order.tokenNumber ?? '-'}`,
      `Total: ${order.netAmount}`,
      `Items: ${order.items.map(i => `${i.quantity}x ${i.item.name}`).join(', ')}`,
    ].join('\n');

    const out: any = { email: null, sms: null };

    if (email) {
      const resend = getResend();
      if (!resend) out.email = { ok: false, error: 'Resend not configured' };
      else {
        await resend.emails.send({
          from: env.EMAIL_FROM,
          to: email,
          subject: `Your receipt (${order.orderNumber})`,
          text: summary,
        });
        out.email = { ok: true };
      }
    }

    if (phone) {
      const twilio = getTwilio();
      if (!twilio || !process.env.TWILIO_FROM_NUMBER) out.sms = { ok: false, error: 'Twilio not configured' };
      else {
        await twilio.messages.create({ from: process.env.TWILIO_FROM_NUMBER, to: phone, body: summary });
        out.sms = { ok: true };
      }
    }

    if (whatsapp) {
      out.whatsapp = await sendWhatsAppMessage({ to: whatsapp, body: summary });
    }

    return out;
  });
};



