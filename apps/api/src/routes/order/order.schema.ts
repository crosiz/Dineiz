import { z } from 'zod';
import { OrderCreateSchema, OrderUpdateSchema } from '@swiftserve/schemas';

export const OrderListQuerySchema = z.object({
  branchId: z.string().optional(),
  status: z.string().optional(),
  tableId: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

export const OrderHistoryQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(10000).default(25),
  search: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  branchId: z.string().optional(),
  type: z.enum(['DINE_IN', 'TAKEAWAY', 'DELIVERY']).optional(),
  status: z.enum(['PENDING', 'IN_KITCHEN', 'READY', 'DELIVERED', 'CANCELLED']).optional(),
  paymentMethod: z.enum(['CASH', 'CARD', 'ONLINE', 'SPLIT']).optional(),
  cashierId: z.string().optional(),
  waiterId: z.string().optional(),
});

export const OrderLiveQuerySchema = z.object({
  branchId: z.string().optional(),
});

export const OrderIdParamSchema = z.object({ id: z.string() });

export const OrderAssignSchema = z.object({
  waiterId: z.string().nullable(),
  waiterName: z.string().nullable(),
});

export const OrderItemsAppendSchema = z.object({
  items: OrderCreateSchema.shape.items,
});

export const OrderItemDeleteParamSchema = z.object({ id: z.string(), itemId: z.string() });

export const OrderItemDeleteBodySchema = z.object({
  reason: z.string(),
  quantity: z.number().int().min(1),
  approvedByManagerId: z.string().optional(),
});

export { OrderCreateSchema, OrderUpdateSchema };
