import 'dotenv/config';

export async function sendWhatsAppMessage(args: { to: string; body: string }) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return { ok: false, error: 'WhatsApp not configured' };

  const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: args.to,
      type: 'text',
      text: { body: args.body },
    }),
  });

  if (!res.ok) return { ok: false, error: `WhatsApp API ${res.status}` };
  return { ok: true, data: await res.json() };
}

