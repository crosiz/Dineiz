import { z } from 'zod';

export const CustomerCreateSchema = z.object({
  name: z.string().min(1),
  phone: z.preprocess((val) => val === '' ? undefined : val, z.string().nullable().optional()),
  email: z.preprocess((val) => val === '' ? undefined : val, z.string().email().nullable().optional()),
  birthday: z.preprocess((val) => val === '' ? undefined : val, z.string().datetime().nullable().optional()),
  anniversary: z.preprocess((val) => val === '' ? undefined : val, z.string().datetime().nullable().optional()),
  notes: z.preprocess((val) => val === '' ? undefined : val, z.string().nullable().optional()),
  tags: z.array(z.string()).optional(),
  preferredPaymentMethod: z.preprocess((val) => val === '' ? undefined : val, z.string().nullable().optional()),
  preferredOrderType: z.string().nullable().optional(),
}).passthrough();

export const CustomerUpdateSchema = CustomerCreateSchema.partial();

export const CustomerQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().optional(),
  segment: z.string().optional(),
  sortBy: z.enum(['totalSpend', 'lastVisitAt', 'totalOrders', 'createdAt']).default('totalSpend'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
}).passthrough();

export const CustomerLookupSchema = z.object({
  phone: z.string().min(3),
}).passthrough();

export const AddNoteSchema = z.object({
  noteText: z.string().min(1),
}).passthrough();

export const CustomerOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).passthrough();

export const CustomerLoyaltyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).passthrough();

export const AdjustPointsSchema = z.object({
  points: z.number(),
  reason: z.string().min(1, 'Reason is required'),
}).passthrough();

export const CustomerImportSchema = z.object({
  customers: z.array(z.object({
    name: z.string(),
    phone: z.preprocess((val) => val === '' ? undefined : val, z.string().nullable().optional()),
    email: z.preprocess((val) => val === '' ? undefined : val, z.string().email().nullable().optional()),
    totalSpend: z.coerce.number().optional(),
    totalOrders: z.coerce.number().optional(),
    loyaltyPoints: z.coerce.number().optional(),
  }).passthrough()).min(1),
}).passthrough();
