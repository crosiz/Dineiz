/**
 * Per-tenant Meta WhatsApp Cloud API sender. Deliberately separate from
 * lib/whatsapp.ts::sendWhatsAppMessage, which sends from the platform's own
 * single WhatsApp number (WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID env vars,
 * used for staff alerts/receipts) — each restaurant using this bot has its
 * own Meta phone number and access token, stored on WhatsAppConfig.
 */
export interface WaCredentials {
  metaPhoneNumberId: string | null;
  metaAccessToken: string | null;
}

export async function sendMessage(config: WaCredentials, to: string, body: string): Promise<void> {
  if (!body) return;
  if (!config.metaPhoneNumberId || !config.metaAccessToken) {
    console.warn('[WhatsApp] sendMessage skipped — tenant has no Meta credentials configured');
    return;
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${config.metaPhoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.metaAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error(`[WhatsApp] sendMessage failed (${res.status}): ${errText}`);
    }
  } catch (err) {
    console.error('[WhatsApp] sendMessage error', err);
  }
}
