import { z } from 'zod';

export const SettingsUpdateSchema = z.object({
  isActive: z.boolean(),
  baseEarnRatePoints: z.number().min(0),
  baseEarnRateSpend: z.number().min(0),
  minOrderValue: z.number().min(0),
  allowedOrderTypes: z.array(z.string()),
  isolateBranches: z.boolean(),
  expiryType: z.string(),
  expiryMonths: z.number().min(0),
  expiryFixedDate: z.string().nullable().optional(),
  minPointsToRedeem: z.number().min(0),
  redemptionValuePoints: z.number().min(0),
  redemptionValuePkr: z.number().min(0),
  maxRedemptionPercent: z.number().nullable().optional(),
  maxRedemptionFlat: z.number().nullable().optional(),
  requireFullPaymentBeforeRedeeming: z.boolean(),
  tierRecalculationMethod: z.string()
});

export const CategoryMultiplierSchema = z.object({
  categoryId: z.string(),
  multiplier: z.number().min(0)
});

export const UpdateCategoryMultipliersSchema = z.object({
  multipliers: z.array(CategoryMultiplierSchema)
});

export const TierCreateSchema = z.object({
  name: z.string(),
  minPoints: z.number().min(0),
  multiplier: z.number().min(0),
  badgeColor: z.string(),
  benefits: z.any().optional() // JSON
});

export const TierUpdateSchema = TierCreateSchema.partial();

export const CampaignCreateSchema = z.object({
  name: z.string(),
  type: z.string(),
  value: z.number().min(0),
  condition: z.string().nullable().optional(), // JSON
  validFrom: z.string().nullable().optional(),
  validTo: z.string().nullable().optional(),
  isActive: z.boolean()
});

export const CampaignUpdateSchema = CampaignCreateSchema.partial();
