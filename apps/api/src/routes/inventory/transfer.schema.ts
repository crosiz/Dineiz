import { z } from 'zod';

export const TransferQuerySchema = z.object({
  branchId: z.string().optional(),
  status: z.enum(['PENDING', 'IN_TRANSIT', 'RECEIVED', 'PARTIALLY_RECEIVED', 'CANCELLED', 'ALL']).optional(),
});

export const TransferIdParamSchema = z.object({ id: z.string().min(1) });

export const TransferCreateSchema = z.object({
  fromBranchId: z.string().min(1),
  toBranchId: z.string().min(1),
  notes: z.string().optional(),
  lines: z.array(z.object({
    ingredientId: z.string().min(1),
    requestedQty: z.number().positive(),
    unit: z.string().optional(),
  })).min(1),
});

export const TransferDispatchSchema = z.object({
  lines: z.array(z.object({ ingredientId: z.string().min(1), dispatchedQty: z.number().min(0) })).optional(),
});

export const TransferReceiveSchema = z.object({
  lines: z.array(z.object({ ingredientId: z.string().min(1), receivedQty: z.number().min(0) })).optional(),
});
