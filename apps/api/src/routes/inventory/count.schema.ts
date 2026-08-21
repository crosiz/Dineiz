import { z } from 'zod';

export const CountQuerySchema = z.object({
  branchId: z.string().optional(),
  status: z.enum(['IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ALL']).optional(),
});

export const CountIdParamSchema = z.object({ id: z.string().min(1) });

export const CountStartSchema = z.object({
  branchId: z.string().min(1),
  countType: z.enum(['FULL', 'PARTIAL', 'SPOT']).default('FULL'),
  categories: z.array(z.string()).optional(),
  ingredientIds: z.array(z.string()).optional(),
});

export const CountLineUpdateSchema = z.object({
  ingredientId: z.string().min(1),
  countedQty: z.number().min(0),
  notes: z.string().optional(),
});

export const CountCompleteSchema = z.object({
  notes: z.string().optional(),
});
