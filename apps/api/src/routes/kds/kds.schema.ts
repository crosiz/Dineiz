import { z } from 'zod';

export const KdsQueueQuerySchema = z.object({
  branchId: z.string().min(1),
  stationId: z.string().optional(),
});

export const KdsHistoryQuerySchema = z.object({
  branchId: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const KdsStatsQuerySchema = z.object({
  branchId: z.string().min(1),
  shiftId: z.string().optional(),
});

export const KdsOrderParamSchema = z.object({ id: z.string() });
export const KdsItemParamSchema  = z.object({ itemId: z.string() });
export const KdsBranchBodySchema = z.object({ branchId: z.string() });
export const KdsCancelBodySchema = z.object({ branchId: z.string(), reason: z.string().optional() });
