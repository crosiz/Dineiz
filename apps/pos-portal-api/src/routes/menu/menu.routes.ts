import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireAuth, resolveBranchId } from '../../middleware/auth';
import * as menuService from './menu.service';

const CreateItemSchema = z.object({
  categoryId: z.string(),
  name: z.string().min(1),
  price: z.number().int().positive(),
  popular: z.boolean().optional(),
});

export const menuRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/menu/categories', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = await resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    return menuService.listCategories(branchId);
  });

  fastify.get('/api/menu/items', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = await resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    return menuService.listItems(branchId);
  });

  fastify.post('/api/menu/items', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = await resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    const parsed = CreateItemSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid request', issues: parsed.error.issues });
    return reply.status(201).send(await menuService.createItem(branchId, parsed.data));
  });

  fastify.patch('/api/menu/items/:id/availability', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = await resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    const { id } = request.params as { id: string };
    const { available } = request.body as { available: boolean };
    return menuService.setItemAvailability(branchId, id, available);
  });

  fastify.get('/api/menu/variations', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = await resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    return menuService.listVariationGroups(branchId);
  });

  fastify.get('/api/menu/addons', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = await resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    return menuService.listAddOnGroups(branchId);
  });

  fastify.get('/api/menu/deals', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = await resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    return menuService.listDeals(branchId);
  });
};
