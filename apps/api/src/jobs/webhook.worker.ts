import { prisma } from '@swiftserve/db';
import crypto from 'crypto';

interface DeliverWebhookParams {
  webhookId: string;
  event: string;
  payload: any;
}

export async function deliverCustomWebhook({ webhookId, event, payload }: DeliverWebhookParams) {
  const webhook = await prisma.webhookEndpoint.findUnique({
    where: { id: webhookId }
  });

  if (!webhook || !webhook.isActive || webhook.status === 'DISABLED') {
    return;
  }

  const timestamp = new Date().toISOString();
  
  // Format payload
  const body = {
    event,
    tenantId: webhook.tenantId,
    timestamp,
    data: payload
  };

  const bodyStr = JSON.stringify(body);

  // Generate HMAC signature
  const signature = crypto
    .createHmac('sha256', webhook.secret)
    .update(bodyStr)
    .digest('hex');

  const headers = {
    'Content-Type': 'application/json',
    'X-Dineiz-Event': event,
    'X-Dineiz-Version': '1',
    'X-Dineiz-Signature': `sha256=${signature}`
  };

  const startTime = Date.now();
  let responseStatus: number | null = null;
  let responseBody: string | null = null;
  let success = false;

  try {
    const res = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: bodyStr
    });
    
    responseStatus = res.status;
    responseBody = await res.text();
    success = res.ok;
  } catch (error: any) {
    responseStatus = 500;
    responseBody = error.message;
    success = false;
  }

  const responseTime = Date.now() - startTime;

  // Log delivery
  await prisma.webhookDelivery.create({
    data: {
      webhookId,
      event,
      payload: bodyStr,
      requestHeaders: JSON.stringify(headers),
      responseStatus,
      responseBody,
      responseTime
    }
  });

  // Handle failure logic
  if (!success) {
    const newFailureCount = webhook.failureCount + 1;
    let newStatus = webhook.status;
    
    if (newFailureCount >= 5) {
      newStatus = 'FAILING';
    }

    // if consecutive failure is going on for 7 days, disable it (simple check: if it was failing for 7 days)
    if (newFailureCount >= 50) {
      newStatus = 'DISABLED';
    }

    await prisma.webhookEndpoint.update({
      where: { id: webhookId },
      data: {
        failureCount: newFailureCount,
        status: newStatus,
        lastTriggered: new Date()
      }
    });

    throw new Error(`Webhook delivery failed with status ${responseStatus}`);
  } else {
    // Reset failure count on success
    await prisma.webhookEndpoint.update({
      where: { id: webhookId },
      data: {
        failureCount: 0,
        status: 'ACTIVE',
        lastTriggered: new Date()
      }
    });
  }
}
