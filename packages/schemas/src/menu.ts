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

export const MenuBulkUploadItemSchema = z.object({
  categoryName: z.string().min(1),
  categoryDescription: z.string().optional(),
  itemName: z.string().min(1),
  itemDescription: z.string().optional(),
  basePrice: z.number().min(0),
  isAvailable: z.boolean().default(true),
});

export const MenuBulkUploadSchema = z.array(MenuBulkUploadItemSchema);

export const GenerateAIDescriptionSchema = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
});
