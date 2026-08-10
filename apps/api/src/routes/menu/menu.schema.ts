import { z } from 'zod';
import { CategoryCreateSchema, CategoryUpdateSchema, ItemCreateSchema, ItemUpdateSchema, GenerateAIDescriptionSchema } from '@dineiz/schemas';

export const ItemIdParamSchema = z.object({ id: z.string() });
export const CategoryIdParamSchema = z.object({ id: z.string() });

export { CategoryCreateSchema, CategoryUpdateSchema, ItemCreateSchema, ItemUpdateSchema, GenerateAIDescriptionSchema };
