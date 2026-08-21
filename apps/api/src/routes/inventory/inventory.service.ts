import { prisma } from '@dineiz/db';
import { sendLowStockIfNeeded } from '../../lib/lowStock';
import {
  emitInventoryUpdated, emitLowStock, emitOutOfStock,
  emitMenuItemAvailable, emitMenuItemUnavailable, emitPoReceived,
} from '../../lib/socket';
import { sendWhatsAppMessage } from '../../lib/whatsapp';
import { sendEmail } from '../../lib/email.service';

// ═══════════════════════════════════════════════════════════════════════════
// SHARED HELPERS — threshold checks, socket emits, auto-disable menu items
// ═══════════════════════════════════════════════════════════════════════════

/** Items whose (active, non-optional) recipe lines depend on this ingredient. */
export async function getAffectedItems(tenantId: string, ingredientId: string) {
  const lines = await prisma.recipeLine.findMany({
    where: { ingredientId, isOptional: false, recipe: { tenantId, isActive: true } },
    include: { recipe: { include: { item: { select: { id: true, name: true } } } } },
  });
  const map = new Map<string, string>();
  for (const l of lines) map.set(l.recipe.item.id, l.recipe.item.name);
  return Array.from(map, ([id, name]) => ({ id, name }));
}

/**
 * Flips BranchMenuItem.isInStock for every item depending on this ingredient.
 * Uses `isInStock` (not `isAvailable`) so the item stays on the menu with a
 * SOLD OUT badge instead of vanishing — `isAvailable` stays a manager-only
 * override (see bulk-availability in the menu module).
 */
async function syncMenuAvailabilityForIngredient(tenantId: string, branchId: string, ingredientId: string, available: boolean) {
  const affected = await getAffectedItems(tenantId, ingredientId);
  for (const item of affected) {
    const existing = await prisma.branchMenuItem.findUnique({
      where: { branchId_itemId: { branchId, itemId: item.id } },
    });
    if (existing && existing.isInStock === available) continue;

    await prisma.branchMenuItem.upsert({
      where: { branchId_itemId: { branchId, itemId: item.id } },
      create: { branchId, itemId: item.id, isAvailable: true, isInStock: available },
      update: { isInStock: available },
    });

    if (available) emitMenuItemAvailable(branchId, item.id, item.name);
    else emitMenuItemUnavailable(branchId, item.id, item.name);
  }
  return affected;
}

/**
 * Central post-mutation hook: run after any stock quantity change (deduction,
 * adjustment, wastage, PO receipt, transfer, count-apply). Emits socket
 * events, pushes FCM low-stock alerts, and keeps menu-item availability in
 * sync with actual stock — a pure function of the *current* quantity, so
 * it's safe to call after every mutation regardless of direction.
 */
export async function postStockChangeEffects(tenantId: string, branchId: string, ingredientId: string) {
  const stock = await prisma.stock.findUnique({
    where: { branchId_ingredientId: { branchId, ingredientId } },
    include: { ingredient: true },
  });
  if (!stock) return;

  emitInventoryUpdated(tenantId, branchId, [ingredientId]);

  if (stock.quantity <= 0) {
    const affected = await syncMenuAvailabilityForIngredient(tenantId, branchId, ingredientId, false);
    emitOutOfStock({ branchId, ingredientId, name: stock.ingredient.name, affectedItems: affected });
  } else {
    await syncMenuAvailabilityForIngredient(tenantId, branchId, ingredientId, true);
    if (stock.reorderLevel > 0 && stock.quantity <= stock.reorderLevel) {
      const affected = await getAffectedItems(tenantId, ingredientId);
      emitLowStock({
        branchId, ingredientId, name: stock.ingredient.name,
        currentQty: stock.quantity, unit: stock.ingredient.unit, threshold: stock.reorderLevel,
        affectedItems: affected.map(a => a.name),
      });
    }
  }

  await sendLowStockIfNeeded({ tenantId, branchId, ingredientId }).catch(() => {});
}

// ═══════════════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════════════

export async function getInventorySummary(tenantId: string, branchId?: string) {
  const stockFilters = branchId ? { branchId } : {};

  const stocks = await prisma.stock.findMany({
    where: { tenantId, ...stockFilters },
    include: { ingredient: true, branch: true },
  });

  const stockMap = new Map<string, { quantity: number; minThreshold: number; maxThreshold: number | null; name: string; averageCost: number; costPerUnit: number }>();
  for (const s of stocks) {
    const existing = stockMap.get(s.ingredientId) || {
      quantity: 0, minThreshold: s.reorderLevel, maxThreshold: s.maxThreshold,
      name: s.ingredient.name, averageCost: s.averageCost, costPerUnit: s.ingredient.costPerUnit,
    };
    existing.quantity += s.quantity;
    stockMap.set(s.ingredientId, existing);
  }

  const allIngredients = await prisma.ingredient.findMany({ where: { tenantId, isDeleted: false } });
  for (const ing of allIngredients) {
    if (!stockMap.has(ing.id)) {
      stockMap.set(ing.id, { quantity: 0, minThreshold: ing.minThreshold, maxThreshold: null, name: ing.name, averageCost: 0, costPerUnit: ing.costPerUnit });
    }
  }

  let lowStock = 0, outOfStock = 0, healthy = 0, overstocked = 0;
  let stockValue = 0;
  const criticalAlerts: string[] = [];

  for (const [, data] of stockMap.entries()) {
    stockValue += Math.max(0, data.quantity) * (data.averageCost || data.costPerUnit);
    if (data.quantity <= 0) {
      outOfStock++;
      criticalAlerts.push(`${data.name} is completely out of stock`);
    } else if (data.quantity <= data.minThreshold) {
      lowStock++;
      criticalAlerts.push(`${data.name} is running low (${data.quantity})`);
    } else if (data.maxThreshold && data.quantity > data.maxThreshold) {
      overstocked++;
      healthy++;
    } else {
      healthy++;
    }
  }

  return {
    total: stockMap.size, lowStock, outOfStock, healthy, overstocked,
    stockValue: Math.round(stockValue * 100) / 100,
    criticalAlerts: criticalAlerts.slice(0, 5),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SUPPLIERS
// ═══════════════════════════════════════════════════════════════════════════

export async function getSuppliers(tenantId: string, q: any) {
  const { search, isActive } = q || {};
  return prisma.supplier.findMany({
    where: {
      tenantId,
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    },
    orderBy: { name: 'asc' },
  });
}

export async function createSupplier(tenantId: string, data: any) {
  return prisma.supplier.create({ data: { tenantId, ...data } });
}

export async function updateSupplier(tenantId: string, id: string, data: any) {
  return prisma.supplier.update({ where: { id, tenantId }, data });
}

export async function deleteSupplier(tenantId: string, id: string) {
  return prisma.supplier.update({ where: { id, tenantId }, data: { isActive: false } });
}

// ═══════════════════════════════════════════════════════════════════════════
// INGREDIENTS
// ═══════════════════════════════════════════════════════════════════════════

export async function getIngredients(tenantId: string, q: any) {
  const { branchId, search, status, category, sortBy, page = 1, limit = 10 } = q;
  const skip = (page - 1) * limit;

  const ingredients = await prisma.ingredient.findMany({
    where: {
      tenantId,
      isDeleted: false,
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      ...(category ? { category } : {}),
    },
    include: {
      stock: { include: { branch: true }, ...(branchId ? { where: { branchId } } : {}) },
      supplier: { select: { id: true, name: true } },
    },
  });

  const processed = ingredients.map(ing => {
    let inStock = 0;
    let averageCost = 0;
    const branches = new Set<string>();

    for (const s of ing.stock) {
      inStock += s.quantity;
      averageCost = s.averageCost || averageCost;
      branches.add(s.branch.name);
    }

    let ingStatus = 'HEALTHY';
    const maxThreshold = ing.stock[0]?.maxThreshold;
    if (inStock <= 0) ingStatus = 'OUT_OF_STOCK';
    else if (inStock <= ing.minThreshold) ingStatus = 'LOW_STOCK';
    else if (maxThreshold && inStock > maxThreshold) ingStatus = 'OVERSTOCKED';

    return {
      id: ing.id,
      name: ing.name,
      nameUrdu: ing.nameUrdu,
      sku: ing.sku,
      barcode: ing.barcode,
      category: ing.category || 'Uncategorized',
      unit: ing.unit,
      purchaseUnit: ing.purchaseUnit,
      purchaseToBase: ing.purchaseToBase,
      inStock,
      minThreshold: ing.minThreshold,
      costPerUnit: ing.costPerUnit,
      stockValue: Math.round(Math.max(0, inStock) * (averageCost || ing.costPerUnit) * 100) / 100,
      status: ingStatus,
      branches: Array.from(branches),
      imageUrl: ing.imageUrl,
      supplier: ing.supplier,
      supplierName: ing.supplierName,
      shelfLifeDays: ing.shelfLifeDays,
      storageType: ing.storageType,
      isActive: ing.isActive,
    };
  });

  let filtered = processed;
  if (status && status !== 'ALL') filtered = filtered.filter(i => i.status === status);

  // Problems-first sort: OUT > LOW > OVERSTOCKED/HEALTHY, alphabetical within each group
  const statusRank: Record<string, number> = { OUT_OF_STOCK: 0, LOW_STOCK: 1, OVERSTOCKED: 2, HEALTHY: 2 };
  if (sortBy === 'name_asc') filtered.sort((a, b) => a.name.localeCompare(b.name));
  else if (sortBy === 'name_desc') filtered.sort((a, b) => b.name.localeCompare(a.name));
  else if (sortBy === 'stock_asc') filtered.sort((a, b) => a.inStock - b.inStock);
  else if (sortBy === 'stock_desc') filtered.sort((a, b) => b.inStock - a.inStock);
  else filtered.sort((a, b) => (statusRank[a.status] - statusRank[b.status]) || a.name.localeCompare(b.name));

  const total = filtered.length;
  const paginated = filtered.slice(skip, skip + limit);

  return { ingredients: paginated, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
}

export async function getIngredientById(tenantId: string, id: string) {
  return prisma.ingredient.findFirst({
    where: { id, tenantId, isDeleted: false },
    include: { stock: { include: { branch: true } }, supplier: true },
  });
}

export async function getIngredientUsage(tenantId: string, id: string) {
  const lines = await prisma.recipeLine.findMany({
    where: { ingredientId: id, recipe: { tenantId } },
    include: { recipe: { include: { item: { select: { id: true, name: true } } } } },
  });
  const map = new Map<string, string>();
  for (const l of lines) map.set(l.recipe.item.id, l.recipe.item.name);
  return Array.from(map, ([itemId, itemName]) => ({ itemId, itemName }));
}

export async function createIngredient(tenantId: string, data: any) {
  const purchaseToBase = data.purchaseToBase || 1;
  const costPerUnit = data.costPerPurchaseUnit != null
    ? data.costPerPurchaseUnit / purchaseToBase
    : (data.costPerUnit || 0);

  return prisma.$transaction(async (tx) => {
    const ing = await tx.ingredient.create({
      data: {
        tenantId,
        name: data.name,
        nameUrdu: data.nameUrdu,
        sku: data.sku,
        barcode: data.barcode,
        category: data.category,
        unit: data.unit,
        purchaseUnit: data.purchaseUnit,
        purchaseToBase,
        minThreshold: data.minThreshold,
        imageUrl: data.imageUrl,
        costPerUnit,
        supplierId: data.supplierId,
        supplierName: data.supplierName,
        shelfLifeDays: data.shelfLifeDays,
        storageType: data.storageType,
      },
    });

    // Per-branch stock settings grid takes priority over the legacy flat branchIds+initialStock shape
    if (Array.isArray(data.branchStocks) && data.branchStocks.length > 0) {
      for (const bs of data.branchStocks) {
        await tx.stock.create({
          data: {
            tenantId, branchId: bs.branchId, ingredientId: ing.id,
            quantity: bs.initialStock || 0,
            reorderLevel: bs.minThreshold ?? data.minThreshold ?? 0,
            maxThreshold: bs.maxThreshold ?? null,
            averageCost: costPerUnit,
          },
        });
      }
    } else if (data.branchIds?.length > 0) {
      for (const branchId of data.branchIds) {
        await tx.stock.create({
          data: { tenantId, branchId, ingredientId: ing.id, quantity: data.initialStock || 0, reorderLevel: data.minThreshold, averageCost: costPerUnit },
        });
      }
    }

    return ing;
  });
}

export async function updateIngredient(tenantId: string, id: string, data: any) {
  const patch: any = { ...data };
  if (data.costPerPurchaseUnit != null) {
    const existing = await prisma.ingredient.findFirst({ where: { id, tenantId } });
    const purchaseToBase = data.purchaseToBase ?? existing?.purchaseToBase ?? 1;
    patch.costPerUnit = data.costPerPurchaseUnit / purchaseToBase;
    delete patch.costPerPurchaseUnit;
  }
  return prisma.ingredient.update({ where: { id, tenantId }, data: patch });
}

export async function deleteIngredient(tenantId: string, id: string) {
  // Soft delete only — recipes referencing this ingredient filter deleted
  // ingredients out on load, and deduction skips them silently (Edge Case 3).
  return prisma.ingredient.update({ where: { id, tenantId }, data: { isDeleted: true, isActive: false, deletedAt: new Date() } });
}

export async function importIngredientsCsv(tenantId: string, csvText: string) {
  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return { created: 0, errors: ['CSV has no data rows'] };

  const header = lines[0].split(',').map(h => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const idx = {
    name: col('name'), category: col('category'), unit: col('unit'),
    purchaseUnit: col('purchaseunit'), purchaseToBase: col('purchasetobase'),
    costPerPurchaseUnit: col('costperpurchaseunit'), minThreshold: col('minthreshold'),
    supplierName: col('suppliername'),
  };

  let created = 0;
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    const name = idx.name >= 0 ? cells[idx.name] : undefined;
    if (!name) { errors.push(`Row ${i + 1}: missing name`); continue; }

    const purchaseToBase = idx.purchaseToBase >= 0 ? Number(cells[idx.purchaseToBase]) || 1 : 1;
    const costPerPurchaseUnit = idx.costPerPurchaseUnit >= 0 ? Number(cells[idx.costPerPurchaseUnit]) || 0 : 0;

    try {
      await prisma.ingredient.create({
        data: {
          tenantId,
          name,
          category: idx.category >= 0 ? cells[idx.category] : undefined,
          unit: (idx.unit >= 0 ? cells[idx.unit] : 'GRAM') as any,
          purchaseUnit: idx.purchaseUnit >= 0 ? (cells[idx.purchaseUnit] as any) : undefined,
          purchaseToBase,
          costPerUnit: purchaseToBase ? costPerPurchaseUnit / purchaseToBase : 0,
          minThreshold: idx.minThreshold >= 0 ? Number(cells[idx.minThreshold]) || 0 : 0,
          supplierName: idx.supplierName >= 0 ? cells[idx.supplierName] : undefined,
        },
      });
      created++;
    } catch (e: any) {
      errors.push(`Row ${i + 1} (${name}): ${e.message}`);
    }
  }

  return { created, errors };
}

// ═══════════════════════════════════════════════════════════════════════════
// STOCK
// ═══════════════════════════════════════════════════════════════════════════

export async function adjustStock(tenantId: string, ingredientId: string, data: any, performedBy: { id: string; name: string }) {
  const { branchId, quantity, type, reason, note } = data;
  const delta = type === 'ADD' ? quantity : -quantity;

  const result = await prisma.$transaction(async (tx) => {
    const before = await tx.stock.findUnique({ where: { branchId_ingredientId: { branchId, ingredientId } } });
    const quantityBefore = before?.quantity ?? 0;
    const quantityAfter = Math.max(0, quantityBefore + delta);

    const stock = await tx.stock.upsert({
      where: { branchId_ingredientId: { branchId, ingredientId } },
      create: { tenantId, branchId, ingredientId, quantity: quantityAfter },
      update: { quantity: quantityAfter },
      include: { ingredient: true, branch: true },
    });

    await tx.stockMovement.create({
      data: {
        tenantId, branchId, ingredientId,
        type: 'ADJUSTMENT',
        quantity: quantityAfter - quantityBefore,
        quantityBefore, quantityAfter,
        performedById: performedBy.id, performedByName: performedBy.name,
        note: reason ? `[${reason}] ${note || ''}` : note,
      },
    });
    return stock;
  });

  await postStockChangeEffects(tenantId, branchId, ingredientId);
  return result;
}

export async function getStockHistory(tenantId: string, ingredientId: string, q: any) {
  const { branchId, from, to, page = 1, limit = 50 } = q;
  const where: any = { tenantId, ingredientId };
  if (branchId) where.branchId = branchId;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }
  const skip = (page - 1) * limit;
  const [total, movements] = await Promise.all([
    prisma.stockMovement.count({ where }),
    prisma.stockMovement.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit, include: { branch: true } }),
  ]);
  return { movements, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
}

export async function getLowStockCount(tenantId: string, branchId?: string) {
  const summary = await getInventorySummary(tenantId, branchId);
  return { lowStock: summary.lowStock, outOfStock: summary.outOfStock };
}

export async function getStockValuation(tenantId: string, branchId?: string) {
  const stocks = await prisma.stock.findMany({
    where: { tenantId, ...(branchId ? { branchId } : {}) },
    include: { ingredient: true },
  });
  let total = 0;
  const byIngredient = stocks.map(s => {
    const value = Math.max(0, s.quantity) * (s.averageCost || s.ingredient.costPerUnit);
    total += value;
    return { ingredientId: s.ingredientId, name: s.ingredient.name, quantity: s.quantity, unitCost: s.averageCost || s.ingredient.costPerUnit, value: Math.round(value * 100) / 100 };
  });
  return { total: Math.round(total * 100) / 100, byIngredient: byIngredient.sort((a, b) => b.value - a.value) };
}

// ═══════════════════════════════════════════════════════════════════════════
// RECIPES
// ═══════════════════════════════════════════════════════════════════════════

function computeRecipeCost(lines: { quantity: number; conversionToBase: number; wastagePercent: number; ingredient: { costPerUnit: number } }[]) {
  return lines.reduce((sum, l) => sum + (l.quantity * l.conversionToBase * (1 + l.wastagePercent / 100) * l.ingredient.costPerUnit), 0);
}

export async function getRecipes(tenantId: string) {
  const items = await prisma.item.findMany({
    where: { tenantId },
    include: {
      recipes: { include: { lines: { include: { ingredient: true }, orderBy: { sortOrder: 'asc' } }, variation: true } },
      category: true,
      variations: true,
    },
    orderBy: { name: 'asc' },
  });

  return items.map(item => {
    const baseRecipe = item.recipes.find(r => !r.variationId) || null;
    const variationRecipes = item.recipes.filter(r => r.variationId);
    const hasRecipe = item.recipes.length > 0;
    const primary = baseRecipe || item.recipes[0] || null;
    const cost = primary ? computeRecipeCost(primary.lines) / (primary.yieldQty || 1) : 0;
    const price = item.basePrice || 0;
    const foodCostPercent = price > 0 ? (cost / price) * 100 : 0;

    return {
      itemId: item.id,
      itemName: item.name,
      categoryName: item.category?.name || 'Uncategorized',
      price,
      hasRecipe,
      hasVariations: item.variations.length > 0,
      variations: item.variations.map(v => ({
        id: v.id, name: v.name, price: v.price,
        hasRecipe: variationRecipes.some(r => r.variationId === v.id),
      })),
      recipe: baseRecipe ? serializeRecipe(baseRecipe) : null,
      totalCost: Math.round(cost * 100) / 100,
      foodCostPercent: Math.round(foodCostPercent * 10) / 10,
    };
  });
}

function serializeRecipe(recipe: any) {
  return {
    id: recipe.id,
    itemId: recipe.itemId,
    variationId: recipe.variationId,
    yieldQty: recipe.yieldQty,
    prepTimeMinutes: recipe.prepTimeMinutes,
    instructions: recipe.instructions,
    lines: recipe.lines
      .filter((l: any) => !l.ingredient.isDeleted)
      .map((l: any) => ({
        id: l.id,
        ingredientId: l.ingredientId,
        ingredientName: l.ingredient.name,
        quantity: l.quantity,
        unit: l.unit,
        conversionToBase: l.conversionToBase,
        isOptional: l.isOptional,
        wastagePercent: l.wastagePercent,
        sortOrder: l.sortOrder,
        cost: l.quantity * l.conversionToBase * (1 + l.wastagePercent / 100) * l.ingredient.costPerUnit,
      })),
    hasDeletedIngredients: recipe.lines.some((l: any) => l.ingredient.isDeleted),
  };
}

export async function getRecipeForItem(tenantId: string, itemId: string, variationId?: string | null) {
  const recipe = await prisma.recipe.findFirst({
    where: { tenantId, itemId, variationId: variationId || null },
    include: { lines: { include: { ingredient: true }, orderBy: { sortOrder: 'asc' } } },
  });
  return recipe ? serializeRecipe(recipe) : null;
}

export async function upsertRecipe(tenantId: string, body: { itemId: string; variationId?: string | null; yieldQty?: number; prepTimeMinutes?: number; instructions?: string; lines: any[] }) {
  return prisma.$transaction(async (tx) => {
    const variationId = body.variationId || null;
    const existing = await tx.recipe.findFirst({ where: { tenantId, itemId: body.itemId, variationId } });

    const lineData = body.lines.map((l, i) => ({
      ingredientId: l.ingredientId,
      quantity: l.quantity,
      unit: l.unit || 'GRAM',
      conversionToBase: l.conversionToBase ?? 1,
      isOptional: l.isOptional ?? false,
      wastagePercent: l.wastagePercent ?? 0,
      notes: l.notes,
      sortOrder: l.sortOrder ?? i,
    }));

    if (existing) {
      await tx.recipeLine.deleteMany({ where: { recipeId: existing.id } });
      return tx.recipe.update({
        where: { id: existing.id },
        data: {
          yieldQty: body.yieldQty ?? existing.yieldQty,
          prepTimeMinutes: body.prepTimeMinutes,
          instructions: body.instructions,
          lines: { create: lineData },
        },
        include: { lines: true },
      });
    }

    return tx.recipe.create({
      data: {
        tenantId, itemId: body.itemId, variationId,
        yieldQty: body.yieldQty ?? 1,
        prepTimeMinutes: body.prepTimeMinutes,
        instructions: body.instructions,
        lines: { create: lineData },
      },
      include: { lines: true },
    });
  });
}

export async function deleteRecipe(tenantId: string, itemId: string, variationId?: string | null) {
  const existing = await prisma.recipe.findFirst({ where: { tenantId, itemId, variationId: variationId || null } });
  if (!existing) return null;
  await prisma.recipe.delete({ where: { id: existing.id } });
  return { deleted: true };
}

export async function copyRecipe(tenantId: string, sourceItemId: string, sourceVariationId: string | null | undefined, targetItemId: string, targetVariationId?: string | null) {
  const source = await prisma.recipe.findFirst({
    where: { tenantId, itemId: sourceItemId, variationId: sourceVariationId || null },
    include: { lines: true },
  });
  if (!source) throw new Error('Source recipe not found');

  return upsertRecipe(tenantId, {
    itemId: targetItemId,
    variationId: targetVariationId || null,
    yieldQty: source.yieldQty,
    prepTimeMinutes: source.prepTimeMinutes ?? undefined,
    instructions: source.instructions ?? undefined,
    lines: source.lines.map(l => ({
      ingredientId: l.ingredientId, quantity: l.quantity, unit: l.unit,
      conversionToBase: l.conversionToBase, isOptional: l.isOptional,
      wastagePercent: l.wastagePercent, sortOrder: l.sortOrder,
    })),
  });
}

export async function getFoodCostReport(tenantId: string) {
  const recipes = await getRecipes(tenantId);
  return recipes
    .filter(r => r.hasRecipe)
    .map(r => ({ ...r, isHighFoodCost: r.foodCostPercent > 40 }))
    .sort((a, b) => b.foodCostPercent - a.foodCostPercent);
}

/** Preview the effect of an ingredient cost change on every recipe using it, before saving (Edge Case 6). */
export async function previewIngredientCostImpact(tenantId: string, ingredientId: string, newCostPerUnit: number) {
  const lines = await prisma.recipeLine.findMany({
    where: { ingredientId, recipe: { tenantId, isActive: true } },
    include: { recipe: { include: { item: true, lines: { include: { ingredient: true } } } } },
  });

  const seen = new Set<string>();
  const impacts: any[] = [];
  for (const line of lines) {
    const recipe = line.recipe;
    if (seen.has(recipe.id)) continue;
    seen.add(recipe.id);

    const oldCost = computeRecipeCost(recipe.lines) / (recipe.yieldQty || 1);
    const newLines = recipe.lines.map(l => l.ingredientId === ingredientId ? { ...l, ingredient: { ...l.ingredient, costPerUnit: newCostPerUnit } } : l);
    const newCost = computeRecipeCost(newLines) / (recipe.yieldQty || 1);
    const price = recipe.item.basePrice || 0;
    const newFoodCostPercent = price > 0 ? (newCost / price) * 100 : 0;

    impacts.push({
      itemId: recipe.itemId, itemName: recipe.item.name,
      oldCost: Math.round(oldCost * 100) / 100, newCost: Math.round(newCost * 100) / 100,
      changePercent: oldCost > 0 ? Math.round(((newCost - oldCost) / oldCost) * 1000) / 10 : 0,
      newFoodCostPercent: Math.round(newFoodCostPercent * 10) / 10,
      exceedsThreshold: newFoodCostPercent > 40,
    });
  }
  return { affectedCount: impacts.length, impacts };
}

// ═══════════════════════════════════════════════════════════════════════════
// PURCHASE ORDERS
// ═══════════════════════════════════════════════════════════════════════════

async function generatePoNumber(tenantId: string) {
  const year = new Date().getFullYear();
  const count = await prisma.purchaseOrder.count({ where: { tenantId, createdAt: { gte: new Date(`${year}-01-01`) } } });
  const seq = String(count + 1).padStart(4, '0');
  return `PO-${year}-${seq}`;
}

export async function getPurchaseOrders(tenantId: string, q: any) {
  const { branchId, status, page = 1, limit = 10 } = q;
  const skip = (page - 1) * limit;

  const where: any = { tenantId };
  if (branchId) where.branchId = branchId;
  if (status && status !== 'ALL') where.status = status;

  const [total, pos] = await Promise.all([
    prisma.purchaseOrder.count({ where }),
    prisma.purchaseOrder.findMany({
      where, skip, take: limit,
      include: { lines: { include: { ingredient: true } }, branch: true, supplier: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    orders: pos.map(po => ({
      id: po.id,
      poNumber: po.poNumber,
      status: po.status,
      supplier: po.supplier?.name || po.supplierName || 'Unknown Supplier',
      items: po.lines.length,
      amount: po.totalActual ?? po.estimatedTotal,
      estimatedTotal: po.estimatedTotal,
      totalActual: po.totalActual,
      date: po.createdAt,
      expectedDate: po.expectedDate,
      receivedDate: po.receivedDate,
      branchName: po.branch.name,
    })),
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}

export async function getPurchaseOrderById(tenantId: string, id: string) {
  return prisma.purchaseOrder.findFirst({
    where: { id, tenantId },
    include: { lines: { include: { ingredient: true } }, branch: true, supplier: true },
  });
}

export async function createPurchaseOrder(tenantId: string, data: any, createdBy: { id: string; name: string }) {
  const poNumber = await generatePoNumber(tenantId);
  const estimatedTotal = data.lines.reduce((sum: number, l: any) => sum + (l.orderedQty * (l.estimatedUnitCost || 0)), 0);

  return prisma.purchaseOrder.create({
    data: {
      tenantId,
      branchId: data.branchId,
      supplierId: data.supplierId,
      supplierName: data.supplierName,
      poNumber,
      status: 'DRAFT',
      estimatedTotal,
      expectedDate: data.expectedDate ? new Date(data.expectedDate) : undefined,
      notes: data.notes,
      createdById: createdBy.id,
      createdByName: createdBy.name,
      lines: {
        create: data.lines.map((l: any) => ({
          ingredientId: l.ingredientId,
          orderedQty: l.orderedQty,
          unit: l.unit,
          estimatedUnitCost: l.estimatedUnitCost || 0,
          lineTotal: l.orderedQty * (l.estimatedUnitCost || 0),
        })),
      },
    },
    include: { lines: { include: { ingredient: true } }, supplier: true },
  });
}

export async function updatePurchaseOrder(tenantId: string, id: string, data: any) {
  const po = await prisma.purchaseOrder.findFirst({ where: { id, tenantId } });
  if (!po) return null;
  if (po.status !== 'DRAFT') throw new Error('Only draft purchase orders can be edited');
  return prisma.purchaseOrder.update({ where: { id }, data });
}

export async function sendPurchaseOrder(tenantId: string, id: string) {
  const po = await prisma.purchaseOrder.findFirst({ where: { id, tenantId }, include: { supplier: true, lines: { include: { ingredient: true } }, branch: true } });
  if (!po) return null;
  if (po.status !== 'DRAFT') throw new Error('Only draft purchase orders can be sent');

  const updated = await prisma.purchaseOrder.update({ where: { id }, data: { status: 'SENT' } });

  // Best-effort supplier notification — never blocks the status change.
  if (po.supplier?.whatsapp) {
    const body = `New Purchase Order ${po.poNumber} from ${po.branch.name}:\n` +
      po.lines.map(l => `- ${l.ingredient.name}: ${l.orderedQty} ${l.unit || ''}`).join('\n');
    sendWhatsAppMessage({ to: po.supplier.whatsapp, body }).catch(() => {});
  }
  if (po.supplier?.email) {
    const rows = po.lines.map(l => `<tr><td>${l.ingredient.name}</td><td>${l.orderedQty} ${l.unit || ''}</td><td>${l.estimatedUnitCost}</td></tr>`).join('');
    sendEmail({
      to: po.supplier.email,
      subject: `Purchase Order ${po.poNumber}`,
      html: `<p>New purchase order from ${po.branch.name}</p><table border="1" cellpadding="6"><tr><th>Ingredient</th><th>Qty</th><th>Est. Cost</th></tr>${rows}</table>`,
    }).catch(() => {});
  }

  return updated;
}

export async function cancelPurchaseOrder(tenantId: string, id: string) {
  const po = await prisma.purchaseOrder.findFirst({ where: { id, tenantId } });
  if (!po) return null;
  if (po.status === 'FULLY_RECEIVED') throw new Error('A fully received purchase order cannot be cancelled');
  return prisma.purchaseOrder.update({ where: { id }, data: { status: 'CANCELLED' } });
}

export async function receivePurchaseOrder(
  tenantId: string,
  id: string,
  data: { lines?: { ingredientId: string; receivedQty: number; actualUnitCost?: number; updateIngredientCost?: boolean; expiryDate?: string; batchNumber?: string }[]; invoiceNumber?: string; invoiceImageUrl?: string; notes?: string },
  receivedBy: { id: string; name: string }
) {
  const po = await prisma.purchaseOrder.findFirst({ where: { id, tenantId }, include: { lines: true, branch: true } });
  if (!po) return null;
  if (po.status === 'FULLY_RECEIVED') return { ...po, costVarianceWarnings: [] }; // idempotent: already fully received, no-op (Edge Case 11)
  if (po.status === 'CANCELLED') throw new Error('Cannot receive a cancelled purchase order');

  // If the caller sent an explicit lines array, it's a partial receive: any
  // ordered line NOT in it simply wasn't received this time (0, not full —
  // otherwise omitting a short-shipped line would silently over-receive it).
  // Only fall back to "receive everything as ordered" when no lines array is
  // sent at all (the plain "receive the whole PO" convenience call).
  const explicitLines = data.lines !== undefined;
  const receiveMap = new Map((data.lines || []).map(l => [l.ingredientId, l]));

  const costVarianceWarnings: any[] = [];
  const touchedIngredientIds: string[] = [];

  const updated = await prisma.$transaction(async (tx) => {
    let allFullyReceived = true;

    for (const line of po.lines) {
      const override = receiveMap.get(line.ingredientId);
      const receivedNow = override ? override.receivedQty : (explicitLines ? 0 : line.orderedQty);
      const totalReceived = (line.receivedQty || 0) + receivedNow;
      if (totalReceived < line.orderedQty) allFullyReceived = false;

      const actualUnitCost = override?.actualUnitCost ?? line.estimatedUnitCost;

      await tx.purchaseOrderLine.update({
        where: { purchaseOrderId_ingredientId: { purchaseOrderId: id, ingredientId: line.ingredientId } },
        data: {
          receivedQty: totalReceived,
          actualUnitCost,
          lineTotal: totalReceived * actualUnitCost,
          expiryDate: override?.expiryDate ? new Date(override.expiryDate) : undefined,
          batchNumber: override?.batchNumber,
        },
      });

      if (receivedNow <= 0) continue;
      touchedIngredientIds.push(line.ingredientId);

      const ingredient = await tx.ingredient.findUnique({ where: { id: line.ingredientId } });
      const purchaseToBase = ingredient?.purchaseToBase || 1;
      const baseQty = receivedNow * purchaseToBase;
      const baseUnitCost = purchaseToBase ? actualUnitCost / purchaseToBase : actualUnitCost;

      const before = await tx.stock.findUnique({ where: { branchId_ingredientId: { branchId: po.branchId, ingredientId: line.ingredientId } } });
      const quantityBefore = before?.quantity ?? 0;
      const oldAvg = before?.averageCost ?? 0;
      const newAvg = (quantityBefore + baseQty) > 0
        ? ((quantityBefore * oldAvg) + (baseQty * baseUnitCost)) / (quantityBefore + baseQty)
        : baseUnitCost;
      const quantityAfter = quantityBefore + baseQty;

      await tx.stock.upsert({
        where: { branchId_ingredientId: { branchId: po.branchId, ingredientId: line.ingredientId } },
        create: { tenantId, branchId: po.branchId, ingredientId: line.ingredientId, quantity: quantityAfter, averageCost: newAvg },
        update: { quantity: quantityAfter, averageCost: newAvg },
      });

      await tx.stockMovement.create({
        data: {
          tenantId, branchId: po.branchId, ingredientId: line.ingredientId,
          type: 'PURCHASE_RECEIPT', quantity: baseQty,
          quantityBefore, quantityAfter,
          unitCost: baseUnitCost, totalCost: baseUnitCost * baseQty,
          purchaseOrderId: id, reference: id,
          performedById: receivedBy.id, performedByName: receivedBy.name,
          note: `PO receipt (${po.poNumber})`,
        },
      });

      // Cost variance detection (Edge Case 6 trigger point)
      if (ingredient && ingredient.costPerUnit > 0) {
        const variancePercent = Math.abs((baseUnitCost - ingredient.costPerUnit) / ingredient.costPerUnit) * 100;
        if (variancePercent > 5) {
          costVarianceWarnings.push({ ingredientId: line.ingredientId, name: ingredient.name, oldCostPerUnit: ingredient.costPerUnit, newCostPerUnit: baseUnitCost, variancePercent: Math.round(variancePercent * 10) / 10 });
          if (override?.updateIngredientCost) {
            await tx.ingredient.update({ where: { id: line.ingredientId }, data: { costPerUnit: baseUnitCost } });
          }
        }
      }
    }

    const newStatus = allFullyReceived ? 'FULLY_RECEIVED' : 'PARTIALLY_RECEIVED';
    const totalActual = await tx.purchaseOrderLine.aggregate({ where: { purchaseOrderId: id }, _sum: { lineTotal: true } });

    return tx.purchaseOrder.update({
      where: { id },
      data: {
        status: newStatus,
        totalActual: totalActual._sum.lineTotal || 0,
        receivedDate: allFullyReceived ? new Date() : po.receivedDate,
        receivedById: receivedBy.id, receivedByName: receivedBy.name,
        invoiceNumber: data.invoiceNumber ?? po.invoiceNumber,
        invoiceImageUrl: data.invoiceImageUrl ?? po.invoiceImageUrl,
        notes: data.notes ?? po.notes,
      },
      include: { lines: { include: { ingredient: true } }, branch: true },
    });
  });

  for (const ingredientId of touchedIngredientIds) {
    await postStockChangeEffects(tenantId, po.branchId, ingredientId);
  }
  emitPoReceived(po.branchId, { poNumber: po.poNumber, itemCount: touchedIngredientIds.length });

  return { ...updated, costVarianceWarnings };
}

export async function autoGeneratePurchaseOrder(tenantId: string, branchId: string, createdBy: { id: string; name: string }) {
  const ingredients = await prisma.ingredient.findMany({
    where: { tenantId, isDeleted: false, isActive: true },
    include: { stock: { where: { branchId } }, supplier: true },
  });

  const bySupplier = new Map<string, { supplierId: string | null; supplierName: string; lines: any[] }>();

  for (const ing of ingredients) {
    const stock = ing.stock[0]?.quantity || 0;
    const maxThreshold = ing.stock[0]?.maxThreshold;
    if (stock > ing.minThreshold || ing.minThreshold <= 0) continue;

    const orderAmountBase = maxThreshold ? (maxThreshold - stock) : (ing.minThreshold * 3);
    if (orderAmountBase <= 0) continue;

    const purchaseToBase = ing.purchaseUnit ? ing.purchaseToBase : 1;
    const orderQtyInPurchaseUnit = orderAmountBase / (purchaseToBase || 1);
    const key = ing.supplierId || ing.supplierName || 'unassigned';
    if (!bySupplier.has(key)) {
      bySupplier.set(key, { supplierId: ing.supplierId, supplierName: ing.supplier?.name || ing.supplierName || 'General Supplier', lines: [] });
    }
    bySupplier.get(key)!.lines.push({
      ingredientId: ing.id,
      orderedQty: Math.round(orderQtyInPurchaseUnit * 100) / 100,
      unit: ing.purchaseUnit || ing.unit,
      estimatedUnitCost: (ing.costPerUnit || 0) * (purchaseToBase || 1),
    });
  }

  const created = [];
  for (const [, group] of bySupplier) {
    if (group.lines.length === 0) continue;
    const poNumber = await generatePoNumber(tenantId);
    const po = await prisma.purchaseOrder.create({
      data: {
        tenantId, branchId,
        supplierId: group.supplierId, supplierName: group.supplierName,
        poNumber, status: 'DRAFT',
        estimatedTotal: group.lines.reduce((sum, l) => sum + l.orderedQty * l.estimatedUnitCost, 0),
        createdById: createdBy.id, createdByName: createdBy.name,
        lines: { create: group.lines },
      },
      include: { lines: { include: { ingredient: true } }, supplier: true },
    });
    created.push(po);
  }

  return created;
}

// ═══════════════════════════════════════════════════════════════════════════
// WASTAGE
// ═══════════════════════════════════════════════════════════════════════════

export async function getWastageLogs(tenantId: string, q: any) {
  const { branchId, dateFrom, dateTo, reason, page = 1, limit = 10 } = q;
  const skip = (page - 1) * limit;

  const where: any = { tenantId };
  if (branchId) where.branchId = branchId;
  if (reason) where.reason = reason;
  if (dateFrom || dateTo) {
    where.timestamp = {};
    if (dateFrom) where.timestamp.gte = new Date(dateFrom);
    if (dateTo) where.timestamp.lte = new Date(dateTo);
  }

  const [total, logs] = await Promise.all([
    prisma.wastageLog.count({ where }),
    prisma.wastageLog.findMany({ where, skip, take: limit, include: { ingredient: true, branch: true }, orderBy: { timestamp: 'desc' } }),
  ]);

  return {
    logs: logs.map(l => ({
      id: l.id, date: l.timestamp, ingredientName: l.ingredient.name, quantityLost: l.quantity,
      unit: l.unit, reason: l.reason, notes: l.notes, costImpact: l.costImpact,
      reportedBy: l.reportedByName, approvedBy: l.approvedByName, branchName: l.branch.name, photoUrl: l.photoUrl,
    })),
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}

export async function createWastageLog(
  tenantId: string,
  data: { branchId: string; ingredientId: string; quantity: number; reason: string; notes?: string; photoUrl?: string; shiftId?: string; approvedById?: string; approvedByName?: string },
  reportedBy: { id: string; name: string }
) {
  const ingredient = await prisma.ingredient.findFirst({ where: { id: data.ingredientId, tenantId } });
  if (!ingredient) throw new Error('Ingredient not found');

  const result = await prisma.$transaction(async (tx) => {
    const before = await tx.stock.findUnique({ where: { branchId_ingredientId: { branchId: data.branchId, ingredientId: data.ingredientId } } });
    const quantityBefore = before?.quantity ?? 0;
    const quantityAfter = Math.max(0, quantityBefore - data.quantity); // Edge Case 12: allow it, clamp at 0

    const stock = await tx.stock.upsert({
      where: { branchId_ingredientId: { branchId: data.branchId, ingredientId: data.ingredientId } },
      create: { tenantId, branchId: data.branchId, ingredientId: data.ingredientId, quantity: 0 },
      update: { quantity: quantityAfter },
    });

    const costImpact = data.quantity * ingredient.costPerUnit;

    const wastage = await tx.wastageLog.create({
      data: {
        tenantId, branchId: data.branchId, ingredientId: data.ingredientId,
        quantity: data.quantity, unit: ingredient.unit, reason: data.reason,
        costImpact, notes: data.notes, photoUrl: data.photoUrl, shiftId: data.shiftId,
        reportedById: reportedBy.id, reportedByName: reportedBy.name,
        approvedById: data.approvedById, approvedByName: data.approvedByName,
      },
    });

    await tx.stockMovement.create({
      data: {
        tenantId, branchId: data.branchId, ingredientId: data.ingredientId,
        type: 'WASTAGE', quantity: -(quantityBefore - quantityAfter),
        quantityBefore, quantityAfter, unitCost: ingredient.costPerUnit, totalCost: costImpact,
        wastageLogId: wastage.id, performedById: reportedBy.id, performedByName: reportedBy.name,
        note: `[${data.reason}] ${data.notes || ''}`,
      },
    });

    if (data.quantity > quantityBefore) {
      await tx.anomalyEvent.create({
        data: {
          tenantId, branchId: data.branchId, type: 'WASTAGE_EXCEEDS_STOCK', severity: 'MEDIUM',
          description: `Logged wastage of ${data.quantity} ${ingredient.unit} for ${ingredient.name} exceeds recorded stock of ${quantityBefore}.`,
          affectedEntityId: wastage.id,
        },
      });
    }

    return wastage;
  });

  await postStockChangeEffects(tenantId, data.branchId, data.ingredientId);
  return result;
}

export async function getWastageAnalytics(tenantId: string, branchId: string | undefined, from?: string, to?: string) {
  const where: any = { tenantId };
  if (branchId) where.branchId = branchId;
  const range: any = {};
  if (from) range.gte = new Date(from);
  if (to) range.lte = new Date(to);
  if (from || to) where.timestamp = range;

  const logs = await prisma.wastageLog.findMany({ where, include: { ingredient: true } });

  const byDay = new Map<string, number>();
  const byReason = new Map<string, number>();
  const byIngredient = new Map<string, number>();
  let totalCost = 0;

  for (const l of logs) {
    totalCost += l.costImpact;
    const day = l.timestamp.toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) || 0) + l.costImpact);
    byReason.set(l.reason, (byReason.get(l.reason) || 0) + l.costImpact);
    byIngredient.set(l.ingredient.name, (byIngredient.get(l.ingredient.name) || 0) + l.costImpact);
  }

  const topIngredients = Array.from(byIngredient, ([name, cost]) => ({ name, cost: Math.round(cost * 100) / 100 }))
    .sort((a, b) => b.cost - a.cost).slice(0, 10);

  const topInsight = topIngredients[0]
    ? `${topIngredients[0].name} accounts for ${Math.round((topIngredients[0].cost / (totalCost || 1)) * 100)}% of your wastage in this period.`
    : null;

  return {
    totalCost: Math.round(totalCost * 100) / 100,
    byDay: Array.from(byDay, ([date, cost]) => ({ date, cost: Math.round(cost * 100) / 100 })).sort((a, b) => a.date.localeCompare(b.date)),
    byReason: Array.from(byReason, ([reason, cost]) => ({ reason, cost: Math.round(cost * 100) / 100 })),
    topIngredients,
    insight: topInsight,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DEDUCTION ON ORDER COMPLETION (Sync Point 1)
// ═══════════════════════════════════════════════════════════════════════════

export async function deductInventoryForOrder(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order || !order.branchId) return;

  const tenantId = order.tenantId;
  const branchId = order.branchId;
  const touchedIngredientIds = new Set<string>();

  for (const orderItem of order.items) {
    const voids = await prisma.voidRequest.findMany({ where: { orderItemId: orderItem.id, status: 'APPROVED' } });
    const voidQty = voids.reduce((sum, v) => sum + v.quantity, 0);
    const effectiveQty = orderItem.quantity - voidQty;
    if (effectiveQty <= 0) continue;

    // Per-variation recipe first, falling back to the item's base recipe (Edge Case 7/8).
    // The chosen variation travels as JSON on OrderItem.options — there's no dedicated column.
    const variationId = (orderItem.options as any)?.variationId as string | undefined;
    const recipeInclude = { lines: { include: { ingredient: true } } } as const;
    const recipe = variationId
      ? (await prisma.recipe.findFirst({ where: { itemId: orderItem.itemId, variationId, isActive: true }, include: recipeInclude }))
        ?? (await prisma.recipe.findFirst({ where: { itemId: orderItem.itemId, variationId: null, isActive: true }, include: recipeInclude }))
      : await prisma.recipe.findFirst({ where: { itemId: orderItem.itemId, variationId: null, isActive: true }, include: recipeInclude });

    if (!recipe) continue; // Edge Case 2: no recipe, skip silently

    const yieldQty = recipe.yieldQty || 1;

    for (const line of recipe.lines) {
      if (line.ingredient.isDeleted) continue; // Edge Case 3

      const deductionAmount = (line.quantity * line.conversionToBase * (1 + line.wastagePercent / 100) * effectiveQty) / yieldQty;
      const ingId = line.ingredientId;
      touchedIngredientIds.add(ingId);

      await prisma.$transaction(async (tx) => {
        const stock = await tx.stock.findUnique({ where: { branchId_ingredientId: { branchId, ingredientId: ingId } } });
        const currentQty = stock?.quantity || 0;
        const newQty = currentQty - deductionAmount;
        const finalQty = Math.max(0, newQty); // Never block payment — clamp at 0 (Edge Case 1/4)

        await tx.stock.upsert({
          where: { branchId_ingredientId: { branchId, ingredientId: ingId } },
          create: { tenantId, branchId, ingredientId: ingId, quantity: finalQty },
          update: { quantity: finalQty },
        });

        await tx.stockMovement.create({
          data: {
            tenantId, branchId, ingredientId: ingId,
            type: 'DEDUCT_SALE', quantity: -(currentQty - finalQty),
            quantityBefore: currentQty, quantityAfter: finalQty,
            reference: orderId, performedById: 'SYSTEM', performedByName: 'System (order completion)',
            note: `Auto-deduct for order #${order.orderNumber}`,
          },
        });

        if (newQty < 0 && !line.isOptional) {
          await tx.anomalyEvent.create({
            data: {
              tenantId, branchId, type: 'STOCK_DISCREPANCY', severity: 'HIGH',
              description: `Stock for ${line.ingredient.name} fell below 0 due to order #${order.orderNumber}. Expected: ${newQty.toFixed(2)}, reset to 0.`,
              affectedEntityId: orderId,
            },
          });
        }
      });
    }
  }

  for (const ingredientId of touchedIngredientIds) {
    await postStockChangeEffects(tenantId, branchId, ingredientId);
  }
}

/**
 * Sync Point 4: order cancelled → restore stock (if never sent to kitchen) or
 * log wastage (if food was already being prepared). Call from order.service.ts
 * right after an order transitions to CANCELLED.
 */
export async function reverseOrDiscardInventoryForCancelledOrder(orderId: string, priorStatus: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || !order.branchId) return;

  const movements = await prisma.stockMovement.findMany({ where: { reference: orderId, type: 'DEDUCT_SALE' } });
  if (movements.length === 0) return;

  const tenantId = order.tenantId;
  const branchId = order.branchId;
  const touched = new Set<string>();

  if (priorStatus === 'PENDING') {
    // Never reached the kitchen — restore the deducted stock.
    for (const m of movements) {
      const restoreQty = Math.abs(m.quantity);
      await prisma.$transaction(async (tx) => {
        const before = await tx.stock.findUnique({ where: { branchId_ingredientId: { branchId, ingredientId: m.ingredientId } } });
        const quantityBefore = before?.quantity ?? 0;
        const quantityAfter = quantityBefore + restoreQty;
        await tx.stock.upsert({
          where: { branchId_ingredientId: { branchId, ingredientId: m.ingredientId } },
          create: { tenantId, branchId, ingredientId: m.ingredientId, quantity: quantityAfter },
          update: { quantity: quantityAfter },
        });
        await tx.stockMovement.create({
          data: {
            tenantId, branchId, ingredientId: m.ingredientId, type: 'ADJUSTMENT', quantity: restoreQty,
            quantityBefore, quantityAfter, reference: orderId,
            performedById: 'SYSTEM', performedByName: 'System (order cancelled)',
            note: 'Order cancelled before reaching the kitchen — stock restored',
          },
        });
      });
      touched.add(m.ingredientId);
    }
  } else {
    // Food was already in prep — log it as wastage instead of restoring stock.
    for (const m of movements) {
      const ingredient = await prisma.ingredient.findUnique({ where: { id: m.ingredientId } });
      if (!ingredient) continue;
      const qty = Math.abs(m.quantity);
      await prisma.wastageLog.create({
        data: {
          tenantId, branchId, ingredientId: m.ingredientId, quantity: qty, unit: ingredient.unit,
          reason: 'OVER_PREP', costImpact: qty * ingredient.costPerUnit,
          reportedById: 'SYSTEM', reportedByName: 'System (order cancelled after prep started)',
          notes: `Order #${order.orderNumber} cancelled after prep started`,
        },
      });
      await prisma.stockMovement.update({ where: { id: m.id }, data: { note: `${m.note || ''} — cancelled post-prep, logged as wastage` } });
    }
  }

  for (const ingredientId of touched) {
    await postStockChangeEffects(tenantId, branchId, ingredientId);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPIRY CHECK (Edge Case 13) — daily job, see lib/queue.ts's 'inventory' worker
// ═══════════════════════════════════════════════════════════════════════════

export async function checkExpiringIngredients() {
  const stocks = await prisma.stock.findMany({
    where: { quantity: { gt: 0 }, ingredient: { shelfLifeDays: { not: null }, isDeleted: false } },
    include: { ingredient: true },
  });

  let flagged = 0;
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  for (const stock of stocks) {
    const shelfLifeDays = stock.ingredient.shelfLifeDays!;
    const lastReceipt = await prisma.stockMovement.findFirst({
      where: { branchId: stock.branchId, ingredientId: stock.ingredientId, type: 'PURCHASE_RECEIPT' },
      orderBy: { createdAt: 'desc' },
    });
    if (!lastReceipt) continue;

    const daysSinceReceipt = (Date.now() - lastReceipt.createdAt.getTime()) / (24 * 60 * 60 * 1000);
    if (daysSinceReceipt <= shelfLifeDays) continue;

    const alreadyFlagged = await prisma.anomalyEvent.findFirst({
      where: { type: 'EXPIRED_INGREDIENT', affectedEntityId: stock.ingredientId, branchId: stock.branchId, status: 'OPEN', detectedAt: { gte: oneDayAgo } },
    });
    if (alreadyFlagged) continue;

    await prisma.anomalyEvent.create({
      data: {
        tenantId: stock.tenantId, branchId: stock.branchId, type: 'EXPIRED_INGREDIENT', severity: 'MEDIUM',
        description: `${stock.ingredient.name} may be expired — received ${Math.floor(daysSinceReceipt)} day(s) ago, shelf life is ${shelfLifeDays} day(s).`,
        affectedEntityId: stock.ingredientId,
      },
    });
    flagged++;
  }

  return { flagged };
}
