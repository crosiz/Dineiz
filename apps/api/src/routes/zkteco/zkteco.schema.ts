import { z } from 'zod';

export const createDeviceSchema = z.object({
  name: z.string().min(1),
  ipAddress: z.string().min(1),
  port: z.number().default(4370),
  branchId: z.string().min(1)
});

export const enrollUserSchema = z.object({
  userId: z.string().min(1)
});
