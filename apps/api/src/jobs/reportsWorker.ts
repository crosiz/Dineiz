import { prisma } from '@dineiz/db';
import { generateReportData } from '../routes/reports/reports.service';
import { generateCSV, generateExcel, generatePDF, generatePDFBuffer } from '../routes/reports/generators';
import { Resend } from 'resend';
import { v2 as cloudinary } from 'cloudinary';
import twilio from 'twilio';
import { Worker, Job } from 'bullmq';
import { reportsQueue } from '../lib/queue';

import { env } from '../env';

const resend = new Resend(env.RESEND_API_KEY);

let twilioClient: twilio.Twilio | null = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_ACCOUNT_SID.startsWith('AC') && process.env.TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET
});

function buildReportEmailHTML(data: any, reportUrl: string, branding: any) {
  return `
    <h2>Your Scheduled Report</h2>
    <p>Please find attached the scheduled report you requested.</p>
    <p>You can also <a href="${reportUrl}">download it here</a>.</p>
  `;
}

async function sendWhatsAppMessage(phone: string, message: any) {
  if (!twilioClient) {
    console.warn('Twilio not configured. Skipping WhatsApp message to', phone);
    return;
  }
  try {
    await twilioClient.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886',
      to: phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`,
      body: message.caption,
      mediaUrl: message.document ? [message.document.link] : undefined
    });
    console.log(`Sent WhatsApp message to ${phone}`);
  } catch (err) {
    console.error('Twilio WhatsApp error:', err);
  }
}

export async function sendScheduledReport(scheduledReport: any) {
  const { reportType, parameters: params, format, recipients, whatsappNumber, tenantId, name: restaurantName, branchId } = scheduledReport;

  // Generate report data
  const data = await generateReportData(tenantId, branchId || undefined, reportType, params as any);

  let reportUrl = '';
  let pdfBuffer: Buffer | null = null;

  if (format === 'PDF') {
    pdfBuffer = await generatePDFBuffer(reportType, data, {});
    
    // Upload to Cloudinary for a temporary shareable URL
    reportUrl = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { resource_type: 'raw', folder: `${tenantId}/reports`, format: 'pdf',
          public_id: `${reportType}-${Date.now()}`,
          invalidate: true, tags: ['auto-delete'] },
        (error, result) => {
          if (error) {
            // fallback for mock environment
            console.error('Cloudinary upload error:', error);
            resolve(`https://mock-storage.com/${scheduledReport.id}.pdf`);
          } else {
            resolve(result?.secure_url || '');
          }
        }
      );
      if (pdfBuffer) {
        uploadStream.end(pdfBuffer);
      } else {
        resolve(`https://mock-storage.com/${scheduledReport.id}.pdf`);
      }
    });
  } else if (format === 'CSV') {
    // Generate file
    const csvString = generateCSV(data);
    reportUrl = `https://mock-storage.com/${scheduledReport.id}.csv`;
  } else if (format === 'EXCEL') {
    const buffer = await generateExcel(data, scheduledReport.name);
    reportUrl = `https://mock-storage.com/${scheduledReport.id}.xlsx`;
  }

  // Send via Resend email
  if (recipients?.length > 0 && format === 'PDF' && pdfBuffer) {
    try {
      await resend.emails.send({
        from: env.EMAIL_FROM,
        to: recipients,
        subject: `${reportType} Report — ${restaurantName}`,
        html: buildReportEmailHTML(data, reportUrl, {}),
        attachments: [{ filename: `${reportType}-report.pdf`, content: pdfBuffer }]
      });
      console.log(`[ReportsWorker] Sent email to ${recipients.join(', ')}`);
    } catch (e: any) {
      console.error(`[ReportsWorker] Failed to send email to ${recipients.join(', ')}`, e.message);
    }
  }

  // Send via WhatsApp
  const whatsappRecipients = whatsappNumber ? [whatsappNumber] : [];
  if (whatsappRecipients?.length > 0 && format === 'PDF') {
    for (const phone of whatsappRecipients) {
      await sendWhatsAppMessage(phone, {
        type: 'document',
        document: { link: reportUrl, filename: `${reportType}-report.pdf` },
        caption: `📊 ${reportType} Report for ${restaurantName}\nGenerated: ${new Date().toLocaleString('en-PK')}`
      });
    }
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

  // Update last run timestamp
  await prisma.scheduledReport.update({
    where: { id: scheduledReport.id },
    data: { lastRunAt: now, nextRunAt: nextRun, lastFileUrl: reportUrl }
  });
}

export async function runReportsJob() {
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
