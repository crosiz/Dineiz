import { z } from 'zod';

export const PromoCreateSchema = z.object({
  code: z.string().min(3).max(32).transform((s) => s.trim().toUpperCase()),
  type: z.enum(['PERCENT', 'FIXED']).default('PERCENT'),
  value: z.number().positive(),
  minOrder: z.number().positive().optional(),
  maxDiscount: z.number().positive().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  usageLimit: z.number().int().positive().optional(),
  isActive: z.boolean().default(true),
});

export const ComboCreateSchema = z.object({
  name: z.string().min(1),
  price: z.number().positive(),
  isActive: z.boolean().default(true),
  items: z.array(z.object({ itemId: z.string().min(1), quantity: z.number().int().positive().default(1) })).min(1),
});

export const BxGyCreateSchema = z.object({
  name: z.string().min(1),
  buyItemId: z.string().min(1),
  buyQty: z.number().int().positive().default(1),
  getItemId: z.string().min(1),
  getQty: z.number().int().positive().default(1),
  isActive: z.boolean().default(true),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
});

export const ValidateDealsSchema = z.object({
  branchId: z.string().min(1).optional(),
  items: z.array(z.object({ itemId: z.string().min(1), quantity: z.number().int().positive(), unitPrice: z.number().positive() })).min(1),
  promoCode: z.string().min(1).optional(),
});

// Unified Deal Schemas
export const UnifiedDealCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  type: z.enum(['PERCENT', 'FIXED', 'BUY_X_GET_Y', 'HAPPY_HOUR', 'FREE_ITEM', 'COMBO_PRICE']),
  config: z.any(), // Can be strictly typed later depending on DealType
  minOrderValue: z.number().nullable().optional(),
  maxUsesTotal: z.number().int().nullable().optional(),
  maxUsesPerCustomer: z.number().int().nullable().optional(),
  validFrom: z.string().datetime().nullable().optional(),
  validUntil: z.string().datetime().nullable().optional(),
  validTimeStart: z.string().nullable().optional(),
  validTimeEnd: z.string().nullable().optional(),
  validDaysOfWeek: z.array(z.number().int().min(1).max(7)).optional(),
  orderTypeRestriction: z.array(z.string()).optional(),
  branchIds: z.array(z.string()).optional(),
  autoApply: z.boolean().default(false),
  requiresManagerApproval: z.boolean().default(false),
  showNameOnReceipt: z.boolean().default(true),
  allowStacking: z.boolean().default(false),
  requiresPromoCode: z.boolean().default(false),
  promoCode: z.string().nullable().optional(),
  promoCodeCaseSensitive: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const UnifiedDealUpdateSchema = UnifiedDealCreateSchema.partial();

export const PosEligibleDealsSchema = z.object({
  branchId: z.string().min(1),
  orderTotal: z.number().min(0),
  orderType: z.string().default('DINE_IN'),
  items: z.array(
    z.object({
      itemId: z.string().min(1),
      categoryId: z.string().min(1).optional(),
      quantity: z.number().int().positive(),
      unitPrice: z.number().min(0)
    })
  ).min(1)
});

export const PosValidatePromoSchema = PosEligibleDealsSchema.extend({
  promoCode: z.string().min(1)
});
