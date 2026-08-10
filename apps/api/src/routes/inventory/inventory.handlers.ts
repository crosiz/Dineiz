import { FastifyRequest, FastifyReply } from 'fastify';
import {
  getInventorySummary, getIngredients, getIngredientById, createIngredient,
  updateIngredient, deleteIngredient, adjustStock, getPurchaseOrders,
  createPurchaseOrder, updatePurchaseOrder, receivePurchaseOrder, autoGeneratePurchaseOrder,
  getWastageLogs, createWastageLog, upsertRecipe, getRecipes
} from './inventory.service';

export async function handleGetSummary(req: FastifyRequest, reply: FastifyReply) {
  const q = req.query as any;
  const branchId = req.scopedBranchId || q.branchId;
  return getInventorySummary(req.user!.tenantId!, branchId);
}

export async function handleGetIngredients(req: FastifyRequest, reply: FastifyReply) {
  const q = req.query as any;
  const branchId = req.scopedBranchId || q.branchId;
  return getIngredients(req.user!.tenantId!, { ...q, branchId });
}

export async function handleGetIngredientById(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const item = await getIngredientById(req.user!.tenantId!, id);
  if (!item) return reply.status(404).send({ error: 'Ingredient not found' });
  return item;
}

export async function handleCreateIngredient(req: FastifyRequest, reply: FastifyReply) {
  const item = await createIngredient(req.user!.tenantId!, req.body as any);
  return reply.status(201).send(item);
}

export async function handleUpdateIngredient(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  return updateIngredient(req.user!.tenantId!, id, req.body as any);
}

export async function handleDeleteIngredient(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  await deleteIngredient(req.user!.tenantId!, id);
  return reply.status(204).send();
}

export async function handleAdjustStock(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  return adjustStock(req.user!.tenantId!, id, req.body as any);
}

export async function handleGetPurchaseOrders(req: FastifyRequest, reply: FastifyReply) {
  const q = req.query as any;
  const branchId = req.scopedBranchId || q.branchId;
  return getPurchaseOrders(req.user!.tenantId!, { ...q, branchId });
}

export async function handleCreatePurchaseOrder(req: FastifyRequest, reply: FastifyReply) {
  const po = await createPurchaseOrder(req.user!.tenantId!, req.body as any);
  return reply.status(201).send(po);
}

export async function handleUpdatePurchaseOrder(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  return updatePurchaseOrder(req.user!.tenantId!, id, req.body as any);
}

export async function handleReceivePurchaseOrder(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const result = await receivePurchaseOrder(req.user!.tenantId!, id, req.body as any);
  if (!result) return reply.status(404).send({ error: 'Purchase order not found' });
  return result;
}

export async function handleAutoGeneratePO(req: FastifyRequest, reply: FastifyReply) {
  const branchId = req.scopedBranchId || (req.body as any)?.branchId;
  if (!branchId) return reply.status(400).send({ error: 'branchId is required' });
  
  const po = await autoGeneratePurchaseOrder(req.user!.tenantId!, branchId);
  if (!po) return reply.status(400).send({ error: 'No items are low on stock' });
  
  return reply.status(201).send(po);
}

export async function handleGetWastageLogs(req: FastifyRequest, reply: FastifyReply) {
  const q = req.query as any;
  const branchId = req.scopedBranchId || q.branchId;
  return getWastageLogs(req.user!.tenantId!, { ...q, branchId });
}

export async function handleCreateWastageLog(req: FastifyRequest, reply: FastifyReply) {
  const log = await createWastageLog(req.user!.tenantId!, req.body as any);
  return reply.status(201).send(log);
}

export async function handleUpsertRecipe(req: FastifyRequest, reply: FastifyReply) {
  return upsertRecipe(req.user!.tenantId!, req.body as any);
}

export async function handleGetRecipes(req: FastifyRequest, reply: FastifyReply) {
  return getRecipes(req.user!.tenantId!);
}
