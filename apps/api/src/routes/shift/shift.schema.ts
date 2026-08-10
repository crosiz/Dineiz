import { z } from 'zod';

export const OpenShiftSchema = z.object({
  branchId: z.string().min(1),
  openingFloat: z.number().min(0).default(0),
});

export const CashEntrySchema = z.object({
  type: z.enum(['CASH_IN', 'CASH_OUT']),
  amount: z.number().positive(),
  reason: z.string().optional(),
});

export const DenominationSchema = z.object({
  denomination: z.number().positive(),
  quantity: z.number().int().nonnegative(),
});

export const CloseShiftSchema = z.object({
  closingCash: z.number().min(0),
  notes: z.string().optional(),
  denominations: z.array(DenominationSchema).optional(),
  overridePin: z.string().optional(),
  overrideReason: z.string().optional(),
});

export const CanCloseQuerySchema = z.object({
  shiftId: z.string(),
  branchId: z.string(),
});

export const ShiftIdParamSchema = z.object({ id: z.string() });

export const ShiftListQuerySchema = z.object({
  branchId: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
});
