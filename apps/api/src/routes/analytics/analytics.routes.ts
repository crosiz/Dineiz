import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { requireTenant } from '../../middleware/auth';
import {
  DailySalesQuerySchema, HourlyHeatmapQuerySchema, ItemPerformanceQuerySchema,
  TodayQuerySchema, RevenueQuerySchema, TopItemsQuerySchema, DashboardSummaryQuerySchema,
  FullDashboardQuerySchema, AnalyticsSummaryQuerySchema,
} from './analytics.schema';
import {
  handleDailySales, handleHourlyHeatmap, handleItemPerformance,
  handleTodayKpis, handleRevenueChart, handleTopItems, handleBranches, handleDashboardSummary,
  handleRevenueTrend, handleFullDashboard, handleAnalyticsSummary,
} from './analytics.handlers';

export const analyticsRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get('/api/analytics/dashboard', { schema: { querystring: FullDashboardQuerySchema }, preHandler: requireTenant }, handleFullDashboard);
  fastify.get('/api/analytics/dashboard-summary', { schema: { querystring: DashboardSummaryQuerySchema }, preHandler: requireTenant }, handleDashboardSummary);
  fastify.get('/api/analytics/summary', { schema: { querystring: AnalyticsSummaryQuerySchema }, preHandler: requireTenant }, handleAnalyticsSummary);
  fastify.get('/api/analytics/daily-sales', { schema: { querystring: DailySalesQuerySchema }, preHandler: requireTenant }, handleDailySales);
  fastify.get('/api/analytics/hourly-heatmap', { schema: { querystring: HourlyHeatmapQuerySchema }, preHandler: requireTenant }, handleHourlyHeatmap);
  fastify.get('/api/analytics/item-performance', { schema: { querystring: ItemPerformanceQuerySchema }, preHandler: requireTenant }, handleItemPerformance);
  fastify.get('/api/analytics/today', { schema: { querystring: TodayQuerySchema }, preHandler: requireTenant }, handleTodayKpis);
  fastify.get('/api/analytics/revenue', { schema: { querystring: RevenueQuerySchema }, preHandler: requireTenant }, handleRevenueChart);
  fastify.get('/api/analytics/revenue-trend', { preHandler: requireTenant }, handleRevenueTrend);
  fastify.get('/api/analytics/top-items', { schema: { querystring: TopItemsQuerySchema }, preHandler: requireTenant }, handleTopItems);
  fastify.get('/api/analytics/branches', { preHandler: requireTenant }, handleBranches);
};
