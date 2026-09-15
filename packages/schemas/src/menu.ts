import { z } from 'zod';

export const CategoryCreateSchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  description: z.string().optional(),
  sortOrder: z.number().int().default(0),
});

export const CategoryUpdateSchema = CategoryCreateSchema.partial();

export const VariationSchema = z.object({
  id: z.string().optional(), // Optional for creation, required for updates
  name: z.string().min(1, 'Variation name is required'),
  price: z.number().min(0, 'Price must be positive'),
});

export const AddOnSchema = z.object({
  id: z.string().optional(), // Optional for creation, required for updates
  name: z.string().min(1, 'Add-on name is required'),
  price: z.number().min(0, 'Price must be positive'),
});

export const ItemCreateSchema = z.object({
  categoryId: z.string().min(1, 'Category ID is required'),
  name: z.string().min(1, 'Item name is required'),
  description: z.string().optional(),
  basePrice: z.number().min(0, 'Base price must be positive'),
  isAvailable: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  variations: z.array(VariationSchema).optional().default([]),
  addOns: z.array(AddOnSchema).optional().default([]),
});

export const ItemUpdateSchema = ItemCreateSchema.partial().extend({
  categoryId: z.string().optional(),
});

// Flat-CSV bulk import — one row per item. `variations` / `addOns` / `tags`
// arrive as encoded strings in the CSV and are parsed by the API before this
// schema validates the normalised shape.
export const MenuBulkUploadPriceOptionSchema = z.object({
  name: z.string().min(1, 'name is required'),
  price: z.number().min(0, 'price must be 0 or greater'),
});

export const MenuBulkUploadItemSchema = z.object({
  category: z.string().min(1, 'category is required'),
  categoryDescription: z.string().optional(),
  itemName: z.string().min(1, 'item_name is required'),
  itemDescription: z.string().optional(),
  basePrice: z.number().min(0, 'base_price must be 0 or greater'),
  unitType: z.string().optional(),
  isAvailable: z.boolean().default(true),
  tags: z.array(z.string()).default([]),
  variations: z.array(MenuBulkUploadPriceOptionSchema).default([]),
  addOns: z.array(MenuBulkUploadPriceOptionSchema).default([]),
});

export const MenuBulkUploadSchema = z.array(MenuBulkUploadItemSchema);

// CSV column headers, in canonical order — shared by the importer, the
// downloadable template, and the dashboard's "Export menu" action.
export const MENU_BULK_UPLOAD_COLUMNS = [
  'category',
  'category_description',
  'item_name',
  'item_description',
  'base_price',
  'unit_type',
  'is_available',
  'tags',
  'variations',
  'add_ons',
] as const;

export const GenerateAIDescriptionSchema = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
});
