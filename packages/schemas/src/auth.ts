import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(8),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const posLoginSchema = z.object({
  tenantId: z.string(),
  branchId: z.string(),
  pin: z.string().length(4).regex(/^\d+$/, "PIN must be numeric"),
});

export type PosLoginInput = z.infer<typeof posLoginSchema>;
