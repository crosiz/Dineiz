import { z } from 'zod';

export const DailySalesQuerySchema = z.object({
  branchId: z.string().min(1).optional(),
  days: z.coerce.number().min(1).max(365).default(30),
});

export const HourlyHeatmapQuerySchema = z.object({
  branchId: z.string().min(1).optional(),
  days: z.coerce.number().min(1).max(365).default(30),
});

export const ItemPerformanceQuerySchema = z.object({
  branchId: z.string().min(1).optional(),
  days: z.coerce.number().min(1).max(365).default(30),
  limit: z.coerce.number().min(1).max(200).default(50),
});

export const TodayQuerySchema = z.object({
  branchId: z.string().optional(),
  shiftId: z.string().optional(),
});

export const RevenueQuerySchema = z.object({
  days: z.coerce.number().min(1).max(365).default(7),
  branchId: z.string().optional(),
});

export const TopItemsQuerySchema = z.object({
  date: z.string().optional(),
  branchId: z.string().optional(),
});

export const DashboardSummaryQuerySchema = z.object({
  branchId: z.string().optional(),
  period: z.enum(['today', '7d', '30d']).optional(),
});

export const FullDashboardQuerySchema = z.object({
  branchId: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const AnalyticsSummaryQuerySchema = z.object({
  branchId: z.string().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Invalid from date format"),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Invalid to date format"),
});
