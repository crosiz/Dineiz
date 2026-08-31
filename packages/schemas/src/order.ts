import { z } from 'zod';

// Matches Prisma OrderStatus
export const OrderStatusEnum = z.enum(['PENDING', 'IN_KITCHEN', 'READY', 'COMPLETED', 'CANCELLED']);

// Matches Prisma OrderType
export const OrderTypeEnum = z.enum(['DINE_IN', 'TAKEAWAY', 'DELIVERY']);

// Matches Prisma PaymentMethod
export const PaymentMethodEnum = z.enum(['CASH', 'CARD', 'ONLINE', 'SPLIT']);

// Matches Prisma PaymentStatus
export const PaymentStatusEnum = z.enum(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED']);

export const OrderItemCreateSchema = z.object({
  itemId: z.string().min(1, 'Item ID is required'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  unitPrice: z.number().min(0, 'Unit price must be positive'),
  subtotal: z.number().min(0),
  notes: z.string().optional(),
  options: z.any().optional(), // JSON for variations/addons
});

export const OrderDealCreateSchema = z.object({
  dealId: z.string().optional(),
  dealName: z.string(),
  dealType: z.string(),
  discountApplied: z.number(),
  promoCodeUsed: z.string().optional(),
});

export const PaymentCreateSchema = z.object({
  amount: z.number().min(0),
  method: PaymentMethodEnum.default('CASH'),
  status: PaymentStatusEnum.default('COMPLETED'),
  transactionId: z.string().optional(),
});

export const OrderCreateSchema = z.object({
  branchId: z.string().min(1, 'Branch ID is required'),
  tableId: z.string().optional().nullable(),
  cashierId: z.string().optional().nullable(),
  tenantId: z.string().optional().nullable(),
  shiftId: z.string().optional().nullable(),

  // Part 4 — the terminal owns the order number. When the POS supplies one
  // (with the client-generated order id it was minted alongside), the server
  // trusts it verbatim instead of generating its own; `generateOrderNumber`
  // is only the fallback for sources that don't carry a number.
  orderNumber: z.string().min(1).max(24).optional(),
  clientId: z.string().min(1).optional(),

  status: OrderStatusEnum.default('PENDING'),
  type: OrderTypeEnum.default('DINE_IN'),
  
  totalAmount: z.number().min(0),
  discountAmount: z.number().min(0).default(0),
  taxAmount: z.number().min(0).default(0),
  netAmount: z.number().min(0),
  
  notes: z.string().optional(),
  
  items: z.array(OrderItemCreateSchema).min(1, 'Order must contain at least one item'),
  payments: z.array(PaymentCreateSchema).optional(),
  orderDeals: z.array(OrderDealCreateSchema).optional(),
});

export const OrderUpdateSchema = OrderCreateSchema.partial().extend({
  tokenNumber: z.string().optional(),
  // Part 3 — guest asked for / cancelled the bill request. ISO string to set,
  // null to clear.
  billRequestedAt: z.string().datetime().nullable().optional(),
  // Part 12 — required to complete a zero-total order; audit-only, not an
  // Order column.
  managerApprovalId: z.string().optional(),
});
