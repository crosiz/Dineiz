import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '@dineiz/db';
import { generateReportData } from './reports.service';
import { generateCSV, generateExcel, generatePDF } from './generators';
import { requireTenant } from '../../middleware/auth';
import { getTenantBranding } from '../settings/settings.service';
import { resolveReportFile } from '../../lib/reportStorage';
import fs from 'fs';

// Writes raw bytes straight to the underlying HTTP response, bypassing
// Fastify's reply.send() serializer pipeline. Necessary because this plugin
// uses fastify-type-provider-zod, whose serializer JSON-encodes anything
// passed to reply.send() that isn't matched by a response schema — including
// Buffers (they'd come out as `{"0":37,"1":80,...}` instead of real bytes).
// Routes without a zod schema (e.g. shift.routes.ts) don't hit this; ours
// declare a body schema for validation, so we route the response manually.
function sendBinary(reply: any, buffer: Buffer, contentType: string, disposition: string) {
  reply.raw.writeHead(200, {
    'Content-Type': contentType,
    'Content-Disposition': disposition,
    'Content-Length': buffer.length,
    'Access-Control-Allow-Origin': reply.request?.headers?.origin || '*',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
  });
  reply.raw.end(buffer);
  reply.sent = true;
}

export const reportsRoutes: FastifyPluginAsyncZod = async (app) => {

  // POST /generate - generate the real file and stream it directly to the browser.
  // No Cloudinary, no intermediate storage — bytes go straight from the
  // generator to the response, same pattern as shift.handlers.ts.
  app.post(
    '/generate',
    {
      preHandler: requireTenant,
      schema: {
        body: z.object({
          reportType: z.string(),
          reportName: z.string().optional(),
          format: z.enum(['PDF', 'EXCEL', 'CSV']),
          parameters: z.any()
        })
      }
    },
    async (request, reply) => {
      const { tenantId, branchId } = request.user as any;
      const { reportType, reportName, format, parameters } = request.body as any;
      const actualName = (reportName || reportType).replace(/[^a-zA-Z0-9-_ ]/g, '').trim() || reportType;

      const rawData = await generateReportData(tenantId, branchId, reportType, parameters);

      if (format === 'CSV') {
        const buffer = Buffer.from(generateCSV(rawData), 'utf-8');
        sendBinary(reply, buffer, 'text/csv', `attachment; filename="${actualName}.csv"`);
      } else if (format === 'EXCEL') {
        const buffer = await generateExcel(rawData, actualName);
        sendBinary(reply, buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', `attachment; filename="${actualName}.xlsx"`);
      } else {
        const branding = await getTenantBranding(tenantId);
        if (!branding) return reply.status(404).send({ message: 'Tenant not found' });
        const buffer = await generatePDF(rawData, branding);
        sendBinary(reply, buffer, 'application/pdf', `attachment; filename="${actualName}.pdf"`);
      }
    }
  );

  // POST /preview - structured JSON data, rendered as a table client-side (CSV/Excel formats)
  app.post(
    '/preview',
    {
      preHandler: requireTenant,
      schema: {
        body: z.object({
          reportType: z.string(),
          parameters: z.any()
        })
      }
    },
    async (request, reply) => {
      const { tenantId, branchId } = request.user as any;
      const { reportType, parameters } = request.body as any;
      const rawData = await generateReportData(tenantId, branchId, reportType, parameters);
      return { data: rawData };
    }
  );

  // POST /preview/pdf - the actual "preview": a real rendered PDF, streamed
  // inline (not attachment) so the browser can display it directly. Same
  // generator as /generate, zero cloud storage either way.
  app.post(
    '/preview/pdf',
    {
      preHandler: requireTenant,
      schema: {
        body: z.object({
          reportType: z.string(),
          parameters: z.any()
        })
      }
    },
    async (request, reply) => {
      const { tenantId, branchId } = request.user as any;
      const { reportType, parameters } = request.body as any;

      const rawData = await generateReportData(tenantId, branchId, reportType, parameters);
      const branding = await getTenantBranding(tenantId);
      if (!branding) return reply.status(404).send({ message: 'Tenant not found' });
      const buffer = await generatePDF(rawData, branding);

      sendBinary(reply, buffer, 'application/pdf', 'inline');
    }
  );

  // GET /download/:filename - serves locally-stored scheduled-report files
  // (see lib/reportStorage.ts). Token-based filename, no auth required since
  // this is also the link Twilio/WhatsApp fetches, and Resend email links.
  app.get(
    '/download/:filename',
    {
      schema: { params: z.object({ filename: z.string() }) }
    },
    async (request, reply) => {
      const { filename } = request.params as { filename: string };
      const filePath = resolveReportFile(filename);
      if (!filePath) return reply.status(404).send({ message: 'Report file not found or expired' });

      const ext = filename.split('.').pop();
      const contentType = ext === 'pdf' ? 'application/pdf'
        : ext === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv';

      const buffer = fs.readFileSync(filePath);
      sendBinary(reply, buffer, contentType, `attachment; filename="report.${ext}"`);
    }
  );

  // GET /scheduled - List all scheduled reports
  app.get('/scheduled', { preHandler: requireTenant }, async (request, reply) => {
    const { tenantId } = request.user as any;
    const reports = await prisma.scheduledReport.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' }
    });
    return reports;
  });

  // POST /scheduled - Create scheduled report
  app.post(
    '/scheduled',
    {
      preHandler: requireTenant,
      schema: {
        body: z.object({
          name: z.string(),
          reportType: z.string(),
          format: z.enum(['PDF', 'EXCEL', 'CSV']),
          frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
          runAtTime: z.string(),
          parameters: z.any(),
          recipients: z.array(z.string()).optional(),
          whatsappNumber: z.string().optional().nullable()
        })
      }
    },
    async (request, reply) => {
      const { tenantId, branchId } = request.user as any;
      const body = request.body as any;

      const newReport = await prisma.scheduledReport.create({
        data: {
          tenantId,
          branchId,
          name: body.name,
          reportType: body.reportType,
          format: body.format,
          frequency: body.frequency,
          runAtTime: body.runAtTime,
          parameters: body.parameters,
          recipients: body.recipients || [],
          whatsappNumber: body.whatsappNumber,
          status: 'ACTIVE'
        }
      });
      return newReport;
    }
  );

  // PUT /scheduled/:id/toggle - Toggle active/paused
  app.put(
    '/scheduled/:id/toggle',
    {
      preHandler: requireTenant,
      schema: {
        params: z.object({
          id: z.string()
        }),
        body: z.object({
          status: z.enum(['ACTIVE', 'PAUSED'])
        })
      }
    },
    async (request, reply) => {
      const { tenantId } = request.user as any;
      const { id } = request.params as any;
      const body = request.body as any;

      const existing = await prisma.scheduledReport.findFirst({ where: { id, tenantId }});
      if (!existing) return reply.status(404).send({ message: 'Not found' });

      const updated = await prisma.scheduledReport.update({
        where: { id },
        data: { status: body.status }
      });
      return updated;
    }
  );

  // DELETE /scheduled/:id
  app.delete(
    '/scheduled/:id',
    {
      preHandler: requireTenant,
      schema: {
        params: z.object({
          id: z.string()
        })
      }
    },
    async (request, reply) => {
      const { tenantId } = request.user as any;
      const { id } = request.params as any;

      const existing = await prisma.scheduledReport.findFirst({ where: { id, tenantId }});
      if (!existing) return reply.status(404).send({ message: 'Not found' });

      await prisma.scheduledReport.delete({ where: { id } });
      return { success: true };
    }
  );

  // New strict endpoints for pre-aggregated PDF generation on frontend
  app.get('/shift', { preHandler: requireTenant }, async (request, reply) => {
    const { shiftId } = request.query as { shiftId: string };
    const tenantId = request.user!.tenantId!;
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId, tenantId },
      include: {
        user: true,
        orders: {
          include: { payments: true, table: true },
          orderBy: { createdAt: 'asc' }
        }
      }
    });
    return reply.send(shift);
  });

  app.get('/daily', { preHandler: requireTenant }, async (request, reply) => {
    const { branchId, date } = request.query as { branchId: string, date: string };
    const tenantId = request.user!.tenantId!;
    const start = new Date(date); start.setHours(0,0,0,0);
    const end = new Date(date); end.setHours(23,59,59,999);

    const orders = await prisma.order.findMany({
      where: { tenantId, branchId, status: 'COMPLETED', createdAt: { gte: start, lte: end } },
      include: { payments: true, items: true }
    });
    return reply.send({ date, ordersCount: orders.length, orders });
  });

  app.get('/revenue', { preHandler: requireTenant }, async (request, reply) => {
    const { branchId, from, to } = request.query as { branchId: string, from: string, to: string };
    const tenantId = request.user!.tenantId!;
    const start = new Date(from);
    const end = new Date(to);

    const orders = await prisma.order.findMany({
      where: { tenantId, branchId, status: 'COMPLETED', createdAt: { gte: start, lte: end } },
      include: { payments: true }
    });

    return reply.send({ from, to, ordersCount: orders.length, orders });
  });

};
