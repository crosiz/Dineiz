import { z } from 'zod';

export const InventorySummaryQuerySchema = z.object({
  branchId: z.string().optional(),
});

export const IngredientsQuerySchema = z.object({
  branchId: z.string().optional(),
  search: z.string().optional(),
  status: z.string().optional(),
  sortBy: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
});

export const IngredientIdParamSchema = z.object({
  id: z.string().min(1),
});

export const IngredientCreateSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  unit: z.enum(['PCS', 'GRAM', 'KILOGRAM', 'ML', 'LITER']),
  minThreshold: z.number().min(0),
  branchIds: z.array(z.string()).optional(),
  imageUrl: z.string().optional(),
  initialStock: z.number().min(0).optional(),
  costPerUnit: z.number().min(0).optional(),
  supplierName: z.string().optional(),
});

export const IngredientUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  unit: z.enum(['PCS', 'GRAM', 'KILOGRAM', 'ML', 'LITER']).optional(),
  minThreshold: z.number().min(0).optional(),
  imageUrl: z.string().optional(),
});

export const StockAdjustSchema = z.object({
  quantity: z.number().positive(),
  type: z.enum(['ADD', 'SUBTRACT']),
  reason: z.string().optional(),
  branchId: z.string().min(1), // Passed from client since they might adjust for a specific branch
  note: z.string().optional(),
});

export const PurchaseOrderQuerySchema = z.object({
  branchId: z.string().optional(),
  status: z.enum(['DRAFT', 'SENT', 'RECEIVED', 'CANCELLED']).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
});

export const PurchaseOrderCreateSchema = z.object({
  branchId: z.string().min(1),
  supplierName: z.string().optional(),
  lines: z.array(z.object({
    ingredientId: z.string().min(1),
    orderedQty: z.number().positive(),
  })).min(1),
});

export const PurchaseOrderUpdateSchema = z.object({
  status: z.enum(['DRAFT', 'SENT', 'CANCELLED']).optional(),
  supplierName: z.string().optional(),
});

export const PurchaseOrderReceiveSchema = z.object({}); // Marks all lines as received based on orderedQty for now, or could pass lines if partial receive

export const WastageQuerySchema = z.object({
  branchId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
});

export const WastageCreateSchema = z.object({
  ingredientId: z.string().min(1),
  quantity: z.number().positive(),
  reason: z.string().min(1),
  branchId: z.string().min(1),
  note: z.string().optional(),
});

// For backward compatibility or other uses if needed
export const RecipeUpsertSchema = z.object({
  itemId: z.string().min(1),
  lines: z.array(z.object({
    ingredientId: z.string().min(1),
    quantity: z.number().positive(),
  })).min(1),
});
