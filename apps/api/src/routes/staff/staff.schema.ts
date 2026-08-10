import { z } from 'zod';

export const StaffQuerySchema = z.object({
  tenantId: z.string().optional(),
  branchId: z.string().optional(),
  role: z.string().optional(),
  status: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  hasOrders: z.coerce.boolean().optional(),
});

export const CreateStaffSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().optional(),
  role: z.enum(['SUPER_ADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER', 'CASHIER', 'WAITER', 'KITCHEN_STAFF', 'RIDER']),
  branchId: z.string(),
  password: z.string().optional().or(z.literal('')),
  posPin: z.string().optional().or(z.literal('')),
});

export const UpdateStaffSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  branchId: z.string().optional(),
});

export const ResetPinSchema = z.object({
  newPin: z.string().length(4).regex(/^\d{4}$/, 'PIN must be exactly 4 digits'),
});

export type StaffQuery = z.infer<typeof StaffQuerySchema>;
export type CreateStaff = z.infer<typeof CreateStaffSchema>;
export type UpdateStaff = z.infer<typeof UpdateStaffSchema>;
export type ResetPin = z.infer<typeof ResetPinSchema>;
