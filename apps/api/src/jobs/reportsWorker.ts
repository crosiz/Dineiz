import { prisma } from '@dineiz/db';
import { generateReportData, type ReportData } from '../routes/reports/reports.service';
import { generateCSV, generateExcel, generatePDF } from '../routes/reports/generators';
import { getTenantBranding } from '../routes/settings/settings.service';
import { saveReportFile, buildReportDownloadUrl, cleanupOldReportFiles } from '../lib/reportStorage';
import { Resend } from 'resend';
import twilio from 'twilio';
import { Worker, Job } from 'bullmq';
import { reportsQueue } from '../lib/queue';

import { env } from '../env';

const resend = new Resend(env.RESEND_API_KEY);

let twilioClient: twilio.Twilio | null = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_ACCOUNT_SID.startsWith('AC') && process.env.TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

function buildReportEmailHTML(data: ReportData, reportUrl: string, restaurantName: string) {
  const summaryRows = (data.summary || [])
    .map(s => `<tr><td style="padding:4px 12px 4px 0;color:#666;">${s.label}</td><td style="padding:4px 0;font-weight:600;">${typeof s.value === 'number' ? s.value.toLocaleString() : s.value}</td></tr>`)
    .join('');

  return `
    <h2>${data.title}</h2>
    <p>Scheduled report for <b>${restaurantName}</b> — ${data.period}</p>
    ${summaryRows ? `<table>${summaryRows}</table>` : ''}
    <p>The full report is attached${reportUrl ? ` and can also be <a href="${reportUrl}">downloaded here</a>` : ''}.</p>
    <p style="color:#999;font-size:11px;margin-top:24px;">Powered by Dineiz</p>
  `;
}

async function sendWhatsAppMessage(phone: string, message: { document: { link: string; filename: string }; caption: string }) {
  if (!twilioClient) {
    console.warn('Twilio not configured. Skipping WhatsApp message to', phone);
    return;
  }
  try {
    await twilioClient.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886',
      to: phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`,
      body: message.caption,
      mediaUrl: [message.document.link],
    });
    console.log(`Sent WhatsApp message to ${phone}`);
  } catch (err) {
    console.error('Twilio WhatsApp error:', err);
  }
}

export async function sendScheduledReport(scheduledReport: any) {
  const { reportType, parameters: params, format, recipients, whatsappNumber, tenantId, name: restaurantName, branchId } = scheduledReport;

  const data = await generateReportData(tenantId, branchId || undefined, reportType, params as any);
  const branding = await getTenantBranding(tenantId);
  if (!branding) throw new Error(`Tenant ${tenantId} not found — cannot render report branding`);

  let buffer: Buffer;
  let ext: 'pdf' | 'xlsx' | 'csv';
  let contentType: string;

  if (format === 'PDF') {
    buffer = await generatePDF(data, branding);
    ext = 'pdf';
    contentType = 'application/pdf';
  } else if (format === 'EXCEL') {
    buffer = await generateExcel(data, scheduledReport.name);
    ext = 'xlsx';
    contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  } else {
    buffer = Buffer.from(generateCSV(data), 'utf-8');
    ext = 'csv';
    contentType = 'text/csv';
  }

  // Store locally (no Cloudinary) so we have a shareable link for the email
  // body and for WhatsApp media delivery, which requires a public HTTPS URL.
  const { filename } = saveReportFile(buffer, ext);
  const reportUrl = buildReportDownloadUrl(filename);

  // Email — real attachment for every format, not just PDF.
  if (recipients?.length > 0) {
    try {
      await resend.emails.send({
        from: env.EMAIL_FROM,
        to: recipients,
        subject: `${data.title} — ${restaurantName}`,
        html: buildReportEmailHTML(data, reportUrl, restaurantName),
        attachments: [{ filename: `${reportType}-report.${ext}`, content: buffer }]
      });
      console.log(`[ReportsWorker] Sent email to ${recipients.join(', ')}`);
    } catch (e: any) {
      console.error(`[ReportsWorker] Failed to send email to ${recipients.join(', ')}`, e.message);
    }
  }

  // WhatsApp — media messages need a real document (PDF works reliably; a
  // spreadsheet/CSV as WhatsApp "document" media is also fine for Twilio).
  if (whatsappNumber) {
    await sendWhatsAppMessage(whatsappNumber, {
      document: { link: reportUrl, filename: `${reportType}-report.${ext}` },
      caption: `📊 ${data.title} for ${restaurantName}\nGenerated: ${new Date().toLocaleString('en-PK')}`
    });
  }

  const now = new Date();
  const nextRun = new Date(now);
  const [hours, minutes] = scheduledReport.runAtTime.split(':').map(Number);
  nextRun.setHours(hours, minutes, 0, 0);

  if (scheduledReport.frequency === 'DAILY') {
    nextRun.setDate(nextRun.getDate() + 1);
  } else if (scheduledReport.frequency === 'WEEKLY') {
    nextRun.setDate(nextRun.getDate() + 7);
  } else if (scheduledReport.frequency === 'MONTHLY') {
    nextRun.setMonth(nextRun.getMonth() + 1);
  }

  if (nextRun <= now) {
    nextRun.setDate(nextRun.getDate() + 1);
  }

  await prisma.scheduledReport.update({
    where: { id: scheduledReport.id },
    data: { lastRunAt: now, nextRunAt: nextRun, lastFileUrl: reportUrl }
  });
}

export async function runReportsJob() {
  cleanupOldReportFiles();

  const now = new Date();

  const dueReports = await prisma.scheduledReport.findMany({
    where: {
      status: 'ACTIVE',
      OR: [
        { nextRunAt: { lte: now } },
        { nextRunAt: null }
      ]
    }
  });

  console.log(`[ReportsWorker] Found ${dueReports.length} reports to execute.`);

  for (const report of dueReports) {
    try {
      console.log(`[ReportsWorker] Generating report ${report.id} (${report.name})`);
      await sendScheduledReport(report);
    } catch (err: any) {
      console.error(`[ReportsWorker] Error executing report ${report.id}:`, err.message);
    }
  }
}

export const initReportsWorker = () => {
  const worker = new Worker('reports', async (job: Job) => {
    if (job.name === 'runReportsJob') {
      await runReportsJob();
    }
  }, {
    connection: reportsQueue.opts.connection,
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 }
  });

  worker.on('failed', (job, err) => {
    console.error(`Reports Job failed: ${job?.id}`, err);
  });
  worker.on('error', (err) => console.error('BullMQ error [Worker-reports]:', err.message || err));
};
