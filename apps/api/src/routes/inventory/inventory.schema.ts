import { z } from 'zod';

const UnitEnum = z.enum(['PCS', 'GRAM', 'KILOGRAM', 'ML', 'LITER']);

export const InventorySummaryQuerySchema = z.object({
  branchId: z.string().optional(),
});

export const IngredientsQuerySchema = z.object({
  branchId: z.string().optional(),
  search: z.string().optional(),
  status: z.string().optional(),
  category: z.string().optional(),
  sortBy: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(1000).default(10),
});

export const IngredientIdParamSchema = z.object({
  id: z.string().min(1),
});

const BranchStockSchema = z.object({
  branchId: z.string().min(1),
  initialStock: z.number().min(0).optional(),
  minThreshold: z.number().min(0).optional(),
  maxThreshold: z.number().min(0).optional(),
});

export const IngredientCreateSchema = z.object({
  name: z.string().min(1),
  nameUrdu: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  category: z.string().min(1),
  unit: UnitEnum,
  purchaseUnit: UnitEnum.optional(),
  purchaseToBase: z.number().positive().optional(),
  minThreshold: z.number().min(0),
  branchIds: z.array(z.string()).optional(),
  branchStocks: z.array(BranchStockSchema).optional(),
  imageUrl: z.string().optional(),
  initialStock: z.number().min(0).optional(),
  costPerUnit: z.number().min(0).optional(),
  costPerPurchaseUnit: z.number().min(0).optional(),
  supplierId: z.string().optional(),
  supplierName: z.string().optional(),
  shelfLifeDays: z.number().int().positive().optional(),
  storageType: z.string().optional(),
});

export const IngredientUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  nameUrdu: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  category: z.string().min(1).optional(),
  unit: UnitEnum.optional(),
  purchaseUnit: UnitEnum.optional(),
  purchaseToBase: z.number().positive().optional(),
  minThreshold: z.number().min(0).optional(),
  imageUrl: z.string().optional(),
  costPerUnit: z.number().min(0).optional(),
  costPerPurchaseUnit: z.number().min(0).optional(),
  supplierId: z.string().nullable().optional(),
  supplierName: z.string().optional(),
  shelfLifeDays: z.number().int().positive().nullable().optional(),
  storageType: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const StockAdjustSchema = z.object({
  quantity: z.number().positive(),
  type: z.enum(['ADD', 'SUBTRACT']),
  reason: z.string().optional(),
  branchId: z.string().min(1),
  note: z.string().optional(),
});

export const StockHistoryQuerySchema = z.object({
  branchId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(200).default(50),
});

export const CostImpactPreviewSchema = z.object({
  newCostPerUnit: z.number().min(0),
});

export const ImportCsvSchema = z.object({
  csv: z.string().min(1),
});

// ── Suppliers ─────────────────────────────────────────────────────────────

export const SupplierCreateSchema = z.object({
  name: z.string().min(1),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  paymentTerms: z.string().optional(),
  deliveryDays: z.array(z.string()).optional(),
  minOrderValue: z.number().min(0).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  notes: z.string().optional(),
});

export const SupplierUpdateSchema = SupplierCreateSchema.partial();

// ── Purchase orders ──────────────────────────────────────────────────────

export const PurchaseOrderQuerySchema = z.object({
  branchId: z.string().optional(),
  status: z.enum(['DRAFT', 'SENT', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'CANCELLED', 'ALL']).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
});

export const PurchaseOrderCreateSchema = z.object({
  branchId: z.string().min(1),
  supplierId: z.string().optional(),
  supplierName: z.string().optional(),
  expectedDate: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(z.object({
    ingredientId: z.string().min(1),
    orderedQty: z.number().positive(),
    unit: z.string().optional(),
    estimatedUnitCost: z.number().min(0).optional(),
  })).min(1),
});

export const PurchaseOrderUpdateSchema = z.object({
  supplierId: z.string().optional(),
  supplierName: z.string().optional(),
  expectedDate: z.string().optional(),
  notes: z.string().optional(),
});

export const PurchaseOrderReceiveSchema = z.object({
  lines: z.array(z.object({
    ingredientId: z.string().min(1),
    receivedQty: z.number().min(0),
    actualUnitCost: z.number().min(0).optional(),
    updateIngredientCost: z.boolean().optional(),
    expiryDate: z.string().optional(),
    batchNumber: z.string().optional(),
  })).optional(),
  invoiceNumber: z.string().optional(),
  invoiceImageUrl: z.string().optional(),
  notes: z.string().optional(),
});

export const AutoGeneratePOSchema = z.object({
  branchId: z.string().optional(),
});

// ── Wastage ──────────────────────────────────────────────────────────────

export const WastageQuerySchema = z.object({
  branchId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  reason: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
});

export const WastageAnalyticsQuerySchema = z.object({
  branchId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const WastageCreateSchema = z.object({
  ingredientId: z.string().min(1),
  quantity: z.number().positive(),
  reason: z.string().min(1),
  branchId: z.string().min(1),
  notes: z.string().optional(),
  photoUrl: z.string().optional(),
  shiftId: z.string().optional(),
  approvedById: z.string().optional(),
  approvedByName: z.string().optional(),
});

// ── Recipes ──────────────────────────────────────────────────────────────

export const RecipeLineSchema = z.object({
  ingredientId: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().min(1).optional(),
  conversionToBase: z.number().positive().optional(),
  isOptional: z.boolean().optional(),
  wastagePercent: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

export const RecipeUpsertSchema = z.object({
  itemId: z.string().min(1),
  variationId: z.string().nullable().optional(),
  yieldQty: z.number().positive().optional(),
  prepTimeMinutes: z.number().int().positive().optional(),
  instructions: z.string().optional(),
  lines: z.array(RecipeLineSchema).min(1),
});

export const RecipeQueryParamSchema = z.object({
  itemId: z.string().min(1),
});

export const RecipeCopySchema = z.object({
  sourceItemId: z.string().min(1),
  sourceVariationId: z.string().nullable().optional(),
  targetItemId: z.string().min(1),
  targetVariationId: z.string().nullable().optional(),
});
