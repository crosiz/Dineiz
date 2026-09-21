import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireAuth, resolveBranchId } from '../../middleware/auth';
import * as shiftsService from './shifts.service';

const OpenShiftSchema = z.object({ openingFloat: z.number().int().nonnegative(), notes: z.string().optional() });
const CloseShiftSchema = z.object({ countedCash: z.number().int().nonnegative() });

export const shiftRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/shifts/current', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = await resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    const shift = await shiftsService.getCurrentShift(branchId);
    if (!shift) return reply.status(404).send({ error: 'No open shift' });
    return shift;
  });

  fastify.get('/api/shifts/history', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = await resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    return shiftsService.listHistory(branchId);
  });

  fastify.get('/api/shifts/open-orders-count', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = await resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    return { count: await shiftsService.listOpenOrdersCount(branchId) };
  });

  fastify.get('/api/shifts/close-preview', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = await resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    try {
      return await shiftsService.previewClose(branchId);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.post('/api/shifts/open', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = await resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    const parsed = OpenShiftSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid request', issues: parsed.error.issues });
    try {
      const shift = await shiftsService.openShift(branchId, request.user!.id, parsed.data.openingFloat, parsed.data.notes);
      return reply.status(201).send(shift);
    } catch (err: any) {
      return reply.status(409).send({ error: err.message });
    }
  });

  fastify.post('/api/shifts/:id/close', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = await resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    const { id } = request.params as { id: string };
    const parsed = CloseShiftSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid request', issues: parsed.error.issues });
    try {
      return await shiftsService.closeShift(branchId, id, parsed.data.countedCash);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });
};
