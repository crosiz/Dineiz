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
  // null = drawer not counted (allowed when cashCountRequired is off, or on a
  // force close). closeShift() already treats null as "no variance".
  closingCash: z.number().min(0).nullable(),
  notes: z.string().optional(),
  denominations: z.array(DenominationSchema).optional(),
  overridePin: z.string().optional(),
  overrideReason: z.string().optional(),
  // Spec Part 6 — the terminal still has queued events; close to PENDING_SYNC.
  pendingSync: z.boolean().optional(),
  pendingSyncCount: z.number().int().nonnegative().optional(),
});

/**
 * Force close, initiated from the dashboard by an already-authenticated
 * manager. A reason is mandatory: this bypasses the pending-order guard and
 * ends someone else's shift, so the shift record has to say why.
 * `actualCash` is optional — omitting it records the drawer as never counted
 * rather than as zero.
 */
export const ForceCloseShiftSchema = z.object({
  reason: z.string().trim().min(3, 'Give a reason of at least 3 characters'),
  actualCash: z.number().min(0).optional(),
  notes: z.string().optional(),
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
  status: z.enum(['OPEN', 'CLOSED', 'ABANDONED', 'PENDING_SYNC']).optional(),
  search: z.string().optional(),
  cashierId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
});
