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

/**
 * History query. `from`/`to` are plain YYYY-MM-DD calendar dates interpreted
 * in the *branch's* timezone, not the server's — a shift opened at 11pm in
 * Karachi belongs to that Karachi day even though the API runs in UTC.
 * The client sends a resolved range; presets (today/yesterday/week/month)
 * are just shorthands for one, so there is a single code path here.
 */
export const ShiftListQuerySchema = z.object({
  branchId: z.string().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(['OPEN', 'CLOSED', 'ABANDONED']).optional(),
  search: z.string().optional(),
  cashierId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
});
