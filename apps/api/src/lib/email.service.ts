import { Resend } from 'resend';
import { prisma } from '@dineiz/db';
import { env } from '../env';
import { managerInviteEmail, passwordResetEmail, branchCreatedEmail } from '@dineiz/email';

const resend = new Resend(env.RESEND_API_KEY);

const FROM_EMAIL = env.EMAIL_FROM;
const REPORTS_EMAIL = 'Dineiz Reports <reports@dineiz.com>';
const NOREPLY_EMAIL = 'Dineiz <noreply@dineiz.com>';

interface EmailResult { success: boolean; messageId?: string; error?: string }

// ─────────────────────────────────────────────
// CORE SEND FUNCTION — every email in apps/api goes through this
// ─────────────────────────────────────────────
async function sendEmail(params: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  attachments?: Array<{ filename: string; content: Buffer }>;
  replyTo?: string;
}): Promise<EmailResult> {
  try {
    const result = await resend.emails.send({
      from: params.from ?? FROM_EMAIL,
      to: Array.isArray(params.to) ? params.to : [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
      attachments: params.attachments?.map(a => ({
        filename: a.filename,
        content: a.content,
      })),
      replyTo: params.replyTo,
    });
    console.log('[Email] Sent:', params.subject, 'to:', params.to, 'id:', result.data?.id);
    return { success: true, messageId: result.data?.id };
  } catch (error: any) {
    console.error('[Email] Failed:', params.subject, 'to:', params.to, error.message);
    return { success: false, error: error.message };
  }
}

// ─────────────────────────────────────────────
// BASE EMAIL TEMPLATE
// ─────────────────────────────────────────────
function baseTemplate(content: string, restaurantName?: string): string {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
      .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
      .header { background: linear-gradient(135deg, #FF6B35, #E63946); padding: 32px 40px; text-align: center; }
      .header h1 { color: white; margin: 0; font-size: 24px; font-weight: 700; }
      .header p { color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px; }
      .body { padding: 40px; }
      .body h2 { color: #1a1a1a; font-size: 20px; margin: 0 0 16px; }
      .body p { color: #4b5563; line-height: 1.6; margin: 0 0 16px; }
      .button { display: inline-block; background: #FF6B35; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; margin: 8px 0; }
      .info-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0; }
      .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
      .info-row:last-child { border-bottom: none; }
      .info-label { color: #6b7280; font-size: 14px; }
      .info-value { color: #1a1a1a; font-size: 14px; font-weight: 500; }
      .footer { background: #f9fafb; padding: 24px 40px; text-align: center; border-top: 1px solid #e5e7eb; }
      .footer p { color: #9ca3af; font-size: 13px; margin: 0; }
      .footer a { color: #FF6B35; text-decoration: none; }
      .warning-box { background: #FEF3C7; border: 1px solid #F59E0B; border-radius: 8px; padding: 16px 20px; margin: 16px 0; }
      .danger-box { background: #FEE2E2; border: 1px solid #EF4444; border-radius: 8px; padding: 16px 20px; margin: 16px 0; }
      .success-box { background: #D1FAE5; border: 1px solid #10B981; border-radius: 8px; padding: 16px 20px; margin: 16px 0; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>Dineiz</h1>
        <p>Restaurant Management Platform${restaurantName ? ` · ${restaurantName}` : ''}</p>
      </div>
      <div class="body">
        ${content}
      </div>
      <div class="footer">
        <p>Dineiz — Restaurant Management for Pakistan</p>
        <p><a href="https://dineiz.com">dineiz.com</a> · <a href="https://wa.me/923141986044">WhatsApp Support</a></p>
        <p style="margin-top: 8px; font-size: 11px;">Built by <a href="https://crosiz.com">Crosiz Technologies</a></p>
      </div>
    </div>
  </body>
  </html>
  `;
}

// ─────────────────────────────────────────────
// EMAIL LOG — best-effort audit row for every transactional send
// ─────────────────────────────────────────────
async function logEmail(params: {
  tenantId?: string | null;
  recipientEmail: string;
  template: 'MANAGER_INVITE' | 'PASSWORD_RESET' | 'BRANCH_CREATED';
  subject: string;
  result: EmailResult;
}) {
  try {
    await prisma.emailLog.create({
      data: {
        tenantId: params.tenantId ?? null,
        recipientEmail: params.recipientEmail,
        template: params.template,
        subject: params.subject,
        status: params.result.success ? 'SENT' : 'FAILED',
        providerMessageId: params.result.messageId,
        errorMessage: params.result.error,
        attempts: 1,
        sentAt: params.result.success ? new Date() : null,
      },
    });
  } catch (err) {
    console.error('[EmailLog] Failed to write log row:', err);
  }
}

// ─────────────────────────────────────────────
// MANAGER CREDENTIALS (when a branch manager / tenant admin is added as staff)
// ─────────────────────────────────────────────
export async function sendManagerInviteEmail(params: {
  to: string;
  managerName: string;
  restaurantName: string;
  branchName: string;
  loginUrl: string;
  temporaryPassword: string;
  tenantId?: string;
}): Promise<EmailResult> {
  const email = managerInviteEmail({
    managerName: params.managerName,
    restaurantName: params.restaurantName,
    branchName: params.branchName,
    email: params.to,
    temporaryPassword: params.temporaryPassword,
  });

  const result = await sendEmail({ to: params.to, subject: email.subject, html: email.html, text: email.text });
  await logEmail({ tenantId: params.tenantId, recipientEmail: params.to, template: 'MANAGER_INVITE', subject: email.subject, result });
  return result;
}

// ─────────────────────────────────────────────
// PASSWORD RESET
// ─────────────────────────────────────────────
export async function sendPasswordResetEmail(params: {
  to: string;
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
  tenantId?: string;
}): Promise<EmailResult> {
  const email = passwordResetEmail({
    name: params.name,
    resetUrl: params.resetUrl,
    expiresInMinutes: params.expiresInMinutes,
  });

  const result = await sendEmail({ to: params.to, subject: email.subject, html: email.html, text: email.text, from: NOREPLY_EMAIL });
  await logEmail({ tenantId: params.tenantId, recipientEmail: params.to, template: 'PASSWORD_RESET', subject: email.subject, result });
  return result;
}

// ─────────────────────────────────────────────
// BRANCH CREATED (tenant self-serves a new branch)
// ─────────────────────────────────────────────
export async function sendBranchCreatedEmail(params: {
  to: string;
  ownerName: string;
  restaurantName: string;
  branchName: string;
  branchCode: string;
  address: string;
  tenantId?: string;
}): Promise<EmailResult> {
  const email = branchCreatedEmail({
    ownerName: params.ownerName,
    restaurantName: params.restaurantName,
    branchName: params.branchName,
    branchCode: params.branchCode,
    address: params.address,
  });

  const result = await sendEmail({ to: params.to, subject: email.subject, html: email.html, text: email.text });
  await logEmail({ tenantId: params.tenantId, recipientEmail: params.to, template: 'BRANCH_CREATED', subject: email.subject, result });
  return result;
}

// ─────────────────────────────────────────────
// SCHEDULED REPORT WITH PDF/EXCEL/CSV ATTACHMENT
// ─────────────────────────────────────────────
export async function sendScheduledReportEmail(params: {
  to: string | string[];
  restaurantName: string;
  reportType: string;
  period: string;
  fileBuffer: Buffer;
  filename: string;
  summaryStats: { label: string; value: string }[];
}): Promise<EmailResult> {
  const statsHtml = params.summaryStats
    .map(s => `<div class="info-row"><span class="info-label">${s.label}</span><span class="info-value">${s.value}</span></div>`)
    .join('');

  const html = baseTemplate(`
    <h2>${params.reportType} Report</h2>
    <p>Your scheduled report for <strong>${params.restaurantName}</strong> is attached.</p>
    <p style="color: #6b7280;">Period: ${params.period}</p>

    ${params.summaryStats.length > 0 ? `
      <div class="info-box">
        <p style="font-weight: 600; margin: 0 0 12px; font-size: 14px; color: #374151;">Summary</p>
        ${statsHtml}
      </div>
    ` : ''}

    <p style="color: #6b7280; font-size: 14px;">The full report is attached. Open it with any PDF/spreadsheet viewer.</p>
    <a href="https://console.dineiz.com/reports" class="button">View All Reports →</a>
  `, params.restaurantName);

  return sendEmail({
    to: params.to,
    subject: `${params.reportType} Report — ${params.restaurantName} — ${params.period}`,
    html,
    from: REPORTS_EMAIL,
    attachments: [{
      filename: params.filename,
      content: params.fileBuffer,
    }],
  });
}

// ─────────────────────────────────────────────
// CRITICAL ANOMALY ALERT
// ─────────────────────────────────────────────
export async function sendAnomalyAlertEmail(params: {
  to: string;
  ownerName: string;
  restaurantName: string;
  anomalyType: string;
  description: string;
  branchName: string;
  detectedAt: string;
  reviewUrl: string;
}): Promise<EmailResult> {
  const readableType = params.anomalyType.replace(/_/g, ' ');
  const html = baseTemplate(`
    <h2>⚠ Security Alert — ${readableType}</h2>
    <p>Hi ${params.ownerName},</p>
    <p>A suspicious activity was detected at <strong>${params.branchName}</strong>.</p>

    <div class="danger-box">
      <strong>${readableType}</strong><br>
      ${params.description}
    </div>

    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Branch</span>
        <span class="info-value">${params.branchName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Detected At</span>
        <span class="info-value">${params.detectedAt}</span>
      </div>
    </div>

    <a href="${params.reviewUrl}" class="button">Review Anomaly →</a>
    <p style="margin-top: 16px; color: #6b7280; font-size: 14px;">Log into your dashboard to see full details and take action.</p>
  `, params.restaurantName);

  return sendEmail({
    to: params.to,
    subject: `⚠ Security Alert — ${readableType} — ${params.restaurantName}`,
    html,
  });
}

// Exported for the one remaining ad-hoc email (plain-text receipts) so it
// still goes through the single Resend client/from-address instead of
// rolling its own — without inventing a templated wrapper for a one-off.
export { sendEmail };
