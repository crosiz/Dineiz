import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '@dineiz/db';
import { generateReportData } from './reports.service';
import { generateCSV, generateExcel, generatePDF } from './generators';
import { reportsQueue } from '../../lib/queue';
import { requireTenant } from '../../middleware/auth';

export const reportsRoutes: FastifyPluginAsyncZod = async (app) => {

  // POST /generate - Synchronously generate or queue report
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
      
      const actualName = reportName || reportType;

      const rawData = await generateReportData(tenantId, branchId, reportType, parameters);
      
      // If we are just getting JSON preview data, we could return it directly
      // but if the format is file, we generate the file
      if (format === 'CSV') {
        const csvString = generateCSV(rawData);
        // We could upload it or return as Base64. Let's return raw string for frontend blob creation.
        return { data: csvString, fileType: 'text/csv' };
      } else if (format === 'EXCEL') {
        const buffer = await generateExcel(rawData, actualName);
        return { data: buffer.toString('base64'), fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
      } else {
        // PDF mock upload to cloudinary
        const fileUrl = await generatePDF(rawData, actualName);
        return { fileUrl };
      }
    }
  );

  // POST /preview - Just get JSON raw data
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
