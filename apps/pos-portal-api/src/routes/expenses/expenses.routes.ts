import { FastifyPluginAsync } from 'fastify';
import { requireAuth, resolveBranchId } from '../../middleware/auth';
import * as expensesService from './expenses.service';

export const expensesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/expenses', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    return expensesService.listExpenses(branchId);
  });

  fastify.get('/api/expenses/categories', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    return expensesService.listCategories(branchId);
  });

  fastify.get('/api/expenses/petty-cash', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    return expensesService.listPettyCash(branchId);
  });
};
