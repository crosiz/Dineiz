import { z } from 'zod';

export const createTenantSchema = z.object({
  name: z.string().min(2),
  domain: z.string().optional(),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;

export const updateTenantSettingsSchema = z.object({
  name: z.string().min(2).optional(),
  domain: z.string().optional(),
  logoUrl: z.string().url().optional(),
  colorPrimary: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color").optional(),
  colorSecondary: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color").optional(),
});

export type UpdateTenantSettingsInput = z.infer<typeof updateTenantSettingsSchema>;

export const createBranchSchema = z.object({
  name: z.string().min(2),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  country: z.string().optional().default('Pakistan'),
  phone: z.string().min(1, "Phone is required"),
  email: z.string().email().optional().or(z.literal('')),
  openingTime: z.string().optional(),
  closingTime: z.string().optional(),
  currency: z.string().optional(),
  timezone: z.string().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  kdsEnabled: z.boolean().optional(),
  kotAutoPrint: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export type CreateBranchInput = z.infer<typeof createBranchSchema>;

export const updateBranchSchema = createBranchSchema.partial();
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
