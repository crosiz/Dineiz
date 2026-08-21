import { FastifyRequest, FastifyReply } from 'fastify';
import * as svc from './inventory.service';

function actor(req: FastifyRequest) {
  return { id: req.user!.id, name: req.user!.name };
}

// ── Summary ──────────────────────────────────────────────────────────────

export async function handleGetSummary(req: FastifyRequest, reply: FastifyReply) {
  const q = req.query as any;
  const branchId = req.scopedBranchId || q.branchId;
  return svc.getInventorySummary(req.user!.tenantId!, branchId);
}

// ── Suppliers ────────────────────────────────────────────────────────────

export async function handleGetSuppliers(req: FastifyRequest, reply: FastifyReply) {
  return svc.getSuppliers(req.user!.tenantId!, req.query as any);
}

export async function handleCreateSupplier(req: FastifyRequest, reply: FastifyReply) {
  const supplier = await svc.createSupplier(req.user!.tenantId!, req.body as any);
  return reply.status(201).send(supplier);
}

export async function handleUpdateSupplier(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  return svc.updateSupplier(req.user!.tenantId!, id, req.body as any);
}

export async function handleDeleteSupplier(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  await svc.deleteSupplier(req.user!.tenantId!, id);
  return reply.status(204).send();
}

// ── Ingredients ──────────────────────────────────────────────────────────

export async function handleGetIngredients(req: FastifyRequest, reply: FastifyReply) {
  const q = req.query as any;
  const branchId = req.scopedBranchId || q.branchId;
  return svc.getIngredients(req.user!.tenantId!, { ...q, branchId });
}

export async function handleGetIngredientById(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const item = await svc.getIngredientById(req.user!.tenantId!, id);
  if (!item) return reply.status(404).send({ error: 'Ingredient not found' });
  return item;
}

export async function handleGetIngredientUsage(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  return svc.getIngredientUsage(req.user!.tenantId!, id);
}

export async function handleCreateIngredient(req: FastifyRequest, reply: FastifyReply) {
  const item = await svc.createIngredient(req.user!.tenantId!, req.body as any);
  return reply.status(201).send(item);
}

export async function handleUpdateIngredient(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  return svc.updateIngredient(req.user!.tenantId!, id, req.body as any);
}

export async function handleDeleteIngredient(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  await svc.deleteIngredient(req.user!.tenantId!, id);
  return reply.status(204).send();
}

export async function handleImportIngredientsCsv(req: FastifyRequest, reply: FastifyReply) {
  const { csv } = req.body as any;
  return svc.importIngredientsCsv(req.user!.tenantId!, csv);
}

export async function handlePreviewCostImpact(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const { newCostPerUnit } = req.body as any;
  return svc.previewIngredientCostImpact(req.user!.tenantId!, id, newCostPerUnit);
}

// ── Stock ────────────────────────────────────────────────────────────────

export async function handleAdjustStock(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  return svc.adjustStock(req.user!.tenantId!, id, req.body as any, actor(req));
}

export async function handleGetStockHistory(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  return svc.getStockHistory(req.user!.tenantId!, id, req.query as any);
}

export async function handleGetLowStockCount(req: FastifyRequest, reply: FastifyReply) {
  const q = req.query as any;
  const branchId = req.scopedBranchId || q.branchId;
  return svc.getLowStockCount(req.user!.tenantId!, branchId);
}

export async function handleGetStockValuation(req: FastifyRequest, reply: FastifyReply) {
  const q = req.query as any;
  const branchId = req.scopedBranchId || q.branchId;
  return svc.getStockValuation(req.user!.tenantId!, branchId);
}

// ── Purchase orders ──────────────────────────────────────────────────────

export async function handleGetPurchaseOrders(req: FastifyRequest, reply: FastifyReply) {
  const q = req.query as any;
  const branchId = req.scopedBranchId || q.branchId;
  return svc.getPurchaseOrders(req.user!.tenantId!, { ...q, branchId });
}

export async function handleGetPurchaseOrderById(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const po = await svc.getPurchaseOrderById(req.user!.tenantId!, id);
  if (!po) return reply.status(404).send({ error: 'Purchase order not found' });
  return po;
}

export async function handleCreatePurchaseOrder(req: FastifyRequest, reply: FastifyReply) {
  const po = await svc.createPurchaseOrder(req.user!.tenantId!, req.body as any, actor(req));
  return reply.status(201).send(po);
}

export async function handleUpdatePurchaseOrder(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  try {
    const po = await svc.updatePurchaseOrder(req.user!.tenantId!, id, req.body as any);
    if (!po) return reply.status(404).send({ error: 'Purchase order not found' });
    return po;
  } catch (e: any) {
    return reply.status(400).send({ error: e.message });
  }
}

export async function handleSendPurchaseOrder(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  try {
    const po = await svc.sendPurchaseOrder(req.user!.tenantId!, id);
    if (!po) return reply.status(404).send({ error: 'Purchase order not found' });
    return po;
  } catch (e: any) {
    return reply.status(400).send({ error: e.message });
  }
}

export async function handleCancelPurchaseOrder(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  try {
    const po = await svc.cancelPurchaseOrder(req.user!.tenantId!, id);
    if (!po) return reply.status(404).send({ error: 'Purchase order not found' });
    return po;
  } catch (e: any) {
    return reply.status(400).send({ error: e.message });
  }
}

export async function handleReceivePurchaseOrder(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  try {
    const result = await svc.receivePurchaseOrder(req.user!.tenantId!, id, req.body as any, actor(req));
    if (!result) return reply.status(404).send({ error: 'Purchase order not found' });
    return result;
  } catch (e: any) {
    return reply.status(400).send({ error: e.message });
  }
}

export async function handleAutoGeneratePO(req: FastifyRequest, reply: FastifyReply) {
  const branchId = req.scopedBranchId || (req.body as any)?.branchId;
  if (!branchId) return reply.status(400).send({ error: 'branchId is required' });

  const pos = await svc.autoGeneratePurchaseOrder(req.user!.tenantId!, branchId, actor(req));
  if (!pos.length) return reply.status(400).send({ error: 'No items are low on stock' });

  return reply.status(201).send(pos);
}

// ── Wastage ──────────────────────────────────────────────────────────────

export async function handleGetWastageLogs(req: FastifyRequest, reply: FastifyReply) {
  const q = req.query as any;
  const branchId = req.scopedBranchId || q.branchId;
  return svc.getWastageLogs(req.user!.tenantId!, { ...q, branchId });
}

export async function handleCreateWastageLog(req: FastifyRequest, reply: FastifyReply) {
  try {
    const log = await svc.createWastageLog(req.user!.tenantId!, req.body as any, actor(req));
    return reply.status(201).send(log);
  } catch (e: any) {
    return reply.status(400).send({ error: e.message });
  }
}

export async function handleGetWastageAnalytics(req: FastifyRequest, reply: FastifyReply) {
  const q = req.query as any;
  const branchId = req.scopedBranchId || q.branchId;
  return svc.getWastageAnalytics(req.user!.tenantId!, branchId, q.from, q.to);
}

// ── Recipes ──────────────────────────────────────────────────────────────

export async function handleGetRecipes(req: FastifyRequest, reply: FastifyReply) {
  return svc.getRecipes(req.user!.tenantId!);
}

export async function handleGetRecipeForItem(req: FastifyRequest, reply: FastifyReply) {
  const { itemId } = req.params as any;
  const { variationId } = req.query as any;
  return svc.getRecipeForItem(req.user!.tenantId!, itemId, variationId || null);
}

export async function handleUpsertRecipe(req: FastifyRequest, reply: FastifyReply) {
  return svc.upsertRecipe(req.user!.tenantId!, req.body as any);
}

export async function handleDeleteRecipe(req: FastifyRequest, reply: FastifyReply) {
  const { itemId } = req.params as any;
  const { variationId } = req.query as any;
  const result = await svc.deleteRecipe(req.user!.tenantId!, itemId, variationId || null);
  if (!result) return reply.status(404).send({ error: 'Recipe not found' });
  return result;
}

export async function handleCopyRecipe(req: FastifyRequest, reply: FastifyReply) {
  const { sourceItemId, sourceVariationId, targetItemId, targetVariationId } = req.body as any;
  try {
    return await svc.copyRecipe(req.user!.tenantId!, sourceItemId, sourceVariationId, targetItemId, targetVariationId);
  } catch (e: any) {
    return reply.status(400).send({ error: e.message });
  }
}

export async function handleFoodCostReport(req: FastifyRequest, reply: FastifyReply) {
  return svc.getFoodCostReport(req.user!.tenantId!);
}
