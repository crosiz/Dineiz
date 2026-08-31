import { FastifyPluginAsync } from 'fastify';
import { requireAuth, requireRole } from '../../middleware/auth';
import {
  handleGetCurrentShift, handleListShifts, handleGetShift,
  handleOpenShift, handleCloseShift, handleCompleteShiftSync, handleAddCashEntry, handleGetShiftSummary,
  handleGetActiveShifts, handleForceCloseShift,
  handleGetShiftOrders, handleGetShiftActivity, handleGetActiveShiftStats,
  handleStartBreak, handleEndBreak, handleCanCloseShift,
  handleGetShiftReport
} from './shift.handlers';

export const shiftRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/shifts/current', { preHandler: requireAuth }, handleGetCurrentShift);
  fastify.get('/api/shifts', { preHandler: requireRole(['TENANT_ADMIN', 'BRANCH_MANAGER', 'CASHIER']) }, handleListShifts);
  fastify.get('/api/shifts/can-close', { preHandler: requireAuth }, handleCanCloseShift);
  fastify.get('/api/shifts/:id', { preHandler: requireAuth }, handleGetShift);
  fastify.post('/api/shifts/open', { preHandler: requireAuth }, handleOpenShift);
  fastify.post('/api/shifts/:id/close', { preHandler: requireRole(['CASHIER', 'BRANCH_MANAGER', 'TENANT_ADMIN']) }, handleCloseShift);
  // Spec Part 6 — the terminal finished shipping a PENDING_SYNC shift's
  // queued events; recompute + flip to CLOSED. Also the dashboard's manual
  // "Finalize" for a terminal that never came back online.
  fastify.post('/api/shifts/:id/sync-complete', { preHandler: requireRole(['CASHIER', 'BRANCH_MANAGER', 'TENANT_ADMIN']) }, handleCompleteShiftSync);
  fastify.post('/api/shifts/:id/cash-entries', { preHandler: requireAuth }, handleAddCashEntry);
  fastify.get('/api/shifts/:id/summary', { preHandler: requireAuth }, handleGetShiftSummary);
  fastify.get('/api/shifts/:id/report', { preHandler: requireAuth }, handleGetShiftReport);

  // ZKTeco Dashboard specific routes
  fastify.get('/api/shifts/active', { preHandler: requireAuth }, handleGetActiveShifts);
  fastify.put('/api/shifts/:id/force-close', { preHandler: requireRole(['BRANCH_MANAGER', 'TENANT_ADMIN']) }, handleForceCloseShift);

  // Shift Management dashboard routes
  fastify.get('/api/shifts/:id/orders', { preHandler: requireRole(['BRANCH_MANAGER', 'TENANT_ADMIN']) }, handleGetShiftOrders);
  fastify.get('/api/shifts/:id/activity', { preHandler: requireRole(['BRANCH_MANAGER', 'TENANT_ADMIN']) }, handleGetShiftActivity);
  fastify.get('/api/shifts/stats/active', { preHandler: requireRole(['BRANCH_MANAGER', 'TENANT_ADMIN']) }, handleGetActiveShiftStats);

  // Break tracking routes (cashier-accessible)
  fastify.post('/api/shifts/:id/break/start', { preHandler: requireAuth }, handleStartBreak);
  fastify.post('/api/shifts/:id/break/end', { preHandler: requireAuth }, handleEndBreak);
};
