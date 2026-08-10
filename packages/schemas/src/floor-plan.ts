import { z } from 'zod';

export const FloorItemSchema = z.object({
  id: z.string(),
  type: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  rotation: z.number(),
  label: z.string().optional(),
  capacity: z.number().optional(),
  tableId: z.string().optional(),
  shape: z.string().optional(),
  color: z.string().optional(),
  locked: z.boolean().optional(),
});

export const FloorDataSchema = z.object({
  floorNumber: z.number(),
  floorName: z.string(),
  width: z.number(),
  height: z.number(),
  backgroundColor: z.string(),
  items: z.array(FloorItemSchema),
});

export const FloorPlanUpdateSchema = z.object({
  floors: z.array(FloorDataSchema),
});

export const TableCreateSchema = z.object({
  branchId: z.string(),
  label: z.string(),
  capacity: z.number(),
  shape: z.string(),
  floorNumber: z.number().default(1),
  positionX: z.number().default(0),
  positionY: z.number().default(0),
  width: z.number().default(50),
  height: z.number().default(50),
  rotation: z.number().default(0),
});

export const TableUpdateSchema = z.object({
  label: z.string().optional(),
  capacity: z.number().optional(),
  isActive: z.boolean().optional(),
});
