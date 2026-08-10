import { z } from 'zod';

export const CustomerUpsertSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(6).optional(),
  email: z.string().email().optional(),
});

export const PointsAdjustSchema = z.object({
  customerId: z.string().min(1),
  type: z.enum(['EARN', 'REDEEM', 'ADJUST']),
  points: z.number().int().positive(),
  reference: z.string().optional(),
  note: z.string().optional(),
});

export const ListCustomersQuerySchema = z.object({
  q: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

export const CustomerIdParamSchema = z.object({ id: z.string().min(1) });
