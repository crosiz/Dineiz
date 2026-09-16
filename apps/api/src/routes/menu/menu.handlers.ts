import { FastifyRequest, FastifyReply } from 'fastify';
import { enqueueCustomWebhookEvent } from '../../lib/webhooks';
import {
  getFullMenu,
  getCategoriesForTenant,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
  getItemsForTenant,
  getItemById,
  createItem,
  updateItem,
  deleteItem,
  toggleItemAvailability,
  bulkToggleItemAvailability,
  updateItemBranchConfig,
  toggleCategoryAvailability,
  getVariationsForItem,
  createVariation,
  updateVariation,
  deleteVariation,
  getAddOnsForItem,
  createAddOn,
  updateAddOn,
  deleteAddOn,
  uploadItemImage,
  deleteItemImage,
  bulkUploadMenu,
  generateAIDescription,
  publishMenu,
} from './menu.service';

// ─── Categories ──────────────────────────────────────────────────────────────

export async function handleGetCategories(request: FastifyRequest, reply: FastifyReply) {
  const { branchId } = request.query as any;
  return getCategoriesForTenant(request.user!.tenantId!, branchId);
}

export async function handleCreateCategory(request: FastifyRequest, reply: FastifyReply) {
  const cat = await createCategory(request.user!.tenantId!, request.body as any);
  return reply.status(201).send(cat);
}

export async function handleUpdateCategory(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as any;
  return updateCategory(request.user!.tenantId!, id, request.body as any);
}

export async function handleToggleCategoryAvailability(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as any;
  const { isAvailable, branchId } = request.body as any;
  return toggleCategoryAvailability(request.user!.tenantId!, id, isAvailable, branchId);
}

export async function handleDeleteCategory(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as any;
  await deleteCategory(request.user!.tenantId!, id);
  return { success: true };
}

export async function handleReorderCategories(request: FastifyRequest, reply: FastifyReply) {
  const { ids } = request.body as { ids: string[] };
  await reorderCategories(request.user!.tenantId!, ids);
  return { success: true };
}

// ─── Items ───────────────────────────────────────────────────────────────────

export async function handleGetItems(request: FastifyRequest, reply: FastifyReply) {
  const { categoryId, search, isAvailable, availability, branchId } = request.query as any;
  let avail: boolean | undefined;
  if (isAvailable !== undefined) avail = isAvailable === 'true' || isAvailable === true;
  if (availability === 'available') avail = true;
  if (availability === 'unavailable') avail = false;
  return getItemsForTenant(request.user!.tenantId!, { categoryId, search, isAvailable: avail, branchId });
}

export async function handleGetItem(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as any;
  const { branchId } = request.query as any;
  const item = await getItemById(request.user!.tenantId!, id, branchId);
  if (!item) return reply.status(404).send({ error: 'Item not found' });
  return item;
}

export async function handleCreateItem(request: FastifyRequest, reply: FastifyReply) {
  const item = await createItem(request.user!.tenantId!, request.body as any);
  return reply.status(201).send(item);
}

export async function handleUpdateItem(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as any;
  const tenantId = request.user!.tenantId!;
  const item = await updateItem(tenantId, id, request.body as any);
  enqueueCustomWebhookEvent({ tenantId, event: 'menu.item_updated', payload: item }).catch(() => {});
  return item;
}

export async function handleDeleteItem(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as any;
  try {
    await deleteItem(request.user!.tenantId!, id);
    return { success: true };
  } catch (err: any) {
    if (err.isConflict) {
      // apiFetch (dashboard) reads body.error as the human-readable message — every
      // other handler in this codebase follows that convention, so a separate
      // 'CONFLICT' code here would silently swallow the real reason on the client.
      return reply.status(409).send({ error: err.message });
    }
    throw err;
  }
}

export async function handleToggleAvailability(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as any;
  const { isAvailable, branchId } = request.body as any;
  const user = request.user!;
  // BRANCH_MANAGER can only toggle — validated in route (requireRole includes BRANCH_MANAGER)
  return toggleItemAvailability(user.tenantId!, id, isAvailable, branchId || user.branchId || undefined);
}

export async function handleBulkToggleAvailability(request: FastifyRequest, reply: FastifyReply) {
  const { itemIds, isAvailable, branchId } = request.body as any;
  const user = request.user!;
  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    return reply.status(400).send({ error: 'itemIds is required' });
  }
  return bulkToggleItemAvailability(user.tenantId!, itemIds, isAvailable, branchId || user.branchId || undefined);
}

export async function handleUpdateItemBranchConfig(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as any;
  const { branchId, isAvailable, overridePrice } = request.body as any;
  const user = request.user!;
  try {
    return await updateItemBranchConfig(user.tenantId!, id, {
      branchId: branchId || user.branchId || undefined,
      isAvailable,
      overridePrice,
    });
  } catch (err: any) {
    return reply.status(err.statusCode ?? 400).send({ error: err.message || 'Failed to update branch pricing' });
  }
}

// ─── Image ───────────────────────────────────────────────────────────────────

export async function handleUploadItemImage(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as any;
  const data = await request.file();
  if (!data) return reply.status(400).send({ error: 'No file uploaded' });
  try {
    const buffer = await data.toBuffer();
    const result = await uploadItemImage(request.user!.tenantId!, id, buffer);
    return { imageUrl: result.url, item: result.item };
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Failed to upload image' });
  }
}

export async function handleDeleteItemImage(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as any;
  await deleteItemImage(request.user!.tenantId!, id);
  return { success: true };
}

// ─── Variations ──────────────────────────────────────────────────────────────

export async function handleGetVariations(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as any;
  return getVariationsForItem(request.user!.tenantId!, id);
}

export async function handleCreateVariation(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as any;
  const variation = await createVariation(request.user!.tenantId!, id, request.body as any);
  return reply.status(201).send(variation);
}

export async function handleUpdateVariation(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as any;
  return updateVariation(request.user!.tenantId!, id, request.body as any);
}

export async function handleDeleteVariation(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as any;
  await deleteVariation(request.user!.tenantId!, id);
  return { success: true };
}

// ─── Add-ons ─────────────────────────────────────────────────────────────────

export async function handleGetAddOns(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as any;
  return getAddOnsForItem(request.user!.tenantId!, id);
}

export async function handleCreateAddOn(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as any;
  const addOn = await createAddOn(request.user!.tenantId!, id, request.body as any);
  return reply.status(201).send(addOn);
}

export async function handleUpdateAddOn(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as any;
  return updateAddOn(request.user!.tenantId!, id, request.body as any);
}

export async function handleDeleteAddOn(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as any;
  await deleteAddOn(request.user!.tenantId!, id);
  return { success: true };
}

// ─── AI Description ──────────────────────────────────────────────────────────

export async function handleAIDescription(request: FastifyRequest, reply: FastifyReply) {
  const body = request.body as any;
  const itemName = body.itemName || body.name || '';
  const categoryName = body.categoryName || body.category || '';
  try {
    const result = await generateAIDescription(itemName, categoryName);
    return result;
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Failed to generate AI description' });
  }
}

// ─── Bulk Upload ─────────────────────────────────────────────────────────────

export async function handleBulkUpload(request: FastifyRequest, reply: FastifyReply) {
  const data = await request.file();
  if (!data) return reply.status(400).send({ error: 'No CSV file uploaded' });
  const buffer = await data.toBuffer();

  // Non-file multipart fields ride alongside the upload. The client sends
  // `branchId` and `mode` before the file part so they're parsed by now.
  const field = (name: string): string | undefined => {
    const f: any = (data.fields as any)?.[name];
    const v = Array.isArray(f) ? f[0]?.value : f?.value;
    return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
  };
  const branchId = field('branchId') ?? request.user?.branchId ?? undefined;
  const mode = field('mode') === 'upsert' ? 'upsert' : 'insert';

  try {
    const result = await bulkUploadMenu(request.user!.tenantId!, buffer, { branchId, mode });
    return reply.status(201).send(result);
  } catch (err: any) {
    if (err.details) return reply.status(400).send({ error: err.message, details: err.details });
    if (err.errors) return reply.status(400).send({ error: err.message, errors: err.errors });
    request.log.error(err);
    return reply.status(500).send({ error: 'Import failed', details: err.message });
  }
}

// ─── Publish ─────────────────────────────────────────────────────────────────

export async function handlePublishMenu(request: FastifyRequest, reply: FastifyReply) {
  const tenantId = request.user!.tenantId!;
  const result = await publishMenu(tenantId, request.body as any);
  enqueueCustomWebhookEvent({ tenantId, event: 'menu.published', payload: result }).catch(() => {});
  return result;
}
