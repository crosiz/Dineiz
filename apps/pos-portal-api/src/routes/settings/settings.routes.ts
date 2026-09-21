import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireRole, resolveBranchId } from '../../middleware/auth';
import * as settingsService from './settings.service';

const UpdateSettingsSchema = z.object({
  receipt: z
    .object({
      header: z.string().max(200).optional(),
      footer: z.string().max(200).optional(),
      paperSize: z.string().max(20).optional(),
      showLogo: z.boolean().optional(),
      showTaxBreakdown: z.boolean().optional(),
    })
    .optional(),
  tax: z
    .object({
      cashTaxRate: z.number().min(0).max(1).optional(),
      cardTaxRate: z.number().min(0).max(1).optional(),
      taxRegistrationNumber: z.string().max(50).optional(),
    })
    .optional(),
  payments: z
    .object({
      cash: z.boolean().optional(),
      card: z.boolean().optional(),
      jazzcash: z.boolean().optional(),
      easypaisa: z.boolean().optional(),
    })
    .optional(),
  workflow: z
    .object({
      autoAcceptOrders: z.boolean().optional(),
      requireManagerPinForDiscounts: z.boolean().optional(),
      autoPrintKot: z.boolean().optional(),
    })
    .optional(),
  notifications: z
    .object({
      newOrderAlerts: z.boolean().optional(),
      lowStockAlerts: z.boolean().optional(),
      shiftReminders: z.boolean().optional(),
      dailySummaryEmail: z.boolean().optional(),
    })
    .optional(),
  backup: z
    .object({
      lastBackupAt: z.string().nullable().optional(),
      frequency: z.string().max(20).optional(),
      storageUsedGb: z.number().min(0).optional(),
      storageLimitGb: z.number().min(0).optional(),
    })
    .optional(),
});

export const settingsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/settings', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = await resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    return settingsService.getSettings(branchId);
  });

  fastify.patch('/api/settings', { preHandler: requireRole(['TENANT_ADMIN', 'BRANCH_MANAGER']) }, async (request, reply) => {
    const branchId = await resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    const parsed = UpdateSettingsSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid request', issues: parsed.error.issues });
    return settingsService.updateSettings(branchId, parsed.data);
  });
};
