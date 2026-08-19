import { z } from 'zod';

export const WhatsAppConfigUpdateSchema = z.object({
  isEnabled: z.boolean().optional(),
  botName: z.string().min(1).optional(),
  botPersona: z.string().nullable().optional(),
  defaultBranchId: z.string().nullable().optional(),
  metaPhoneNumberId: z.string().nullable().optional(),
  metaAccessToken: z.string().nullable().optional(),
  allowedOrderTypes: z.array(z.enum(['TAKEAWAY', 'DELIVERY'])).optional(),
  minOrderAmount: z.number().min(0).optional(),
  operatingHours: z.record(z.string(), z.object({
    isOpen: z.boolean(),
    open: z.string(),
    close: z.string(),
  })).nullable().optional(),
  visibleCategoryIds: z.array(z.string()).optional(),
  jazzCashEnabled: z.boolean().optional(),
  easyPaisaEnabled: z.boolean().optional(),
  awayMessage: z.string().nullable().optional(),
});

export const WhatsAppConversationsQuerySchema = z.object({
  status: z.enum(['active', 'all']).default('active'),
  limit: z.coerce.number().min(1).max(100).default(50),
});
