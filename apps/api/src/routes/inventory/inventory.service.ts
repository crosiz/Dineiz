import { prisma } from '@swiftserve/db';
import { sendLowStockIfNeeded } from '../../lib/lowStock';

export async function getInventorySummary(tenantId: string, branchId?: string) {
  const stockFilters = branchId ? { branchId } : {};

  // Find all stock records for the tenant
  const stocks = await prisma.stock.findMany({
    where: { tenantId, ...stockFilters },
    include: { ingredient: true, branch: true }
  });

  // Group by ingredient to compute total stock across requested branches
  const stockMap = new Map<string, { quantity: number, minThreshold: number, name: string }>();
  for (const s of stocks) {
    const existing = stockMap.get(s.ingredientId) || { quantity: 0, minThreshold: s.ingredient.minThreshold, name: s.ingredient.name };
    existing.quantity += s.quantity;
    stockMap.set(s.ingredientId, existing);
  }

  let total = 0;
  let lowStock = 0;
  let outOfStock = 0;
  let healthy = 0;
  const criticalAlerts: string[] = [];

  // Add ingredients with 0 stock (not even in Stock table)
  const allIngredients = await prisma.ingredient.findMany({ where: { tenantId } });
  for (const ing of allIngredients) {
    if (!stockMap.has(ing.id)) {
      stockMap.set(ing.id, { quantity: 0, minThreshold: ing.minThreshold, name: ing.name });
    }
  }

  total = stockMap.size;

  for (const [id, data] of stockMap.entries()) {
    if (data.quantity <= 0) {
      outOfStock++;
      criticalAlerts.push(`${data.name} is completely out of stock`);
    } else if (data.quantity <= data.minThreshold) {
      lowStock++;
      // Only alert if it's very low, e.g. <= minThreshold
      criticalAlerts.push(`${data.name} is running low (${data.quantity})`);
    } else {
      healthy++;
    }
  }

  return { total, lowStock, outOfStock, healthy, criticalAlerts: criticalAlerts.slice(0, 5) }; // Limit alerts to 5
}

export async function getIngredients(tenantId: string, q: any) {
  const { branchId, search, status, sortBy, page = 1, limit = 10 } = q;
  const skip = (page - 1) * limit;

  // We need to fetch all ingredients and their stocks to aggregate
  const ingredients = await prisma.ingredient.findMany({
    where: {
      tenantId,
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {})
    },
    include: {
      stock: {
        include: { branch: true },
        ...(branchId ? { where: { branchId } } : {})
      }
    }
  });

  const processed = ingredients.map(ing => {
    let inStock = 0;
    const branches = new Set<string>();
    
    // If branchId is specified, we only sum up stock for that branch
    for (const s of ing.stock) {
      inStock += s.quantity;
      branches.add(s.branch.name);
    }

    let ingStatus = 'HEALTHY';
    if (inStock <= 0) ingStatus = 'OUT_OF_STOCK';
    else if (inStock <= ing.minThreshold) ingStatus = 'LOW_STOCK';

    return {
      id: ing.id,
      name: ing.name,
      category: ing.category || 'Uncategorized',
      unit: ing.unit,
      inStock,
      minThreshold: ing.minThreshold,
      status: ingStatus,
      branches: Array.from(branches),
      imageUrl: ing.imageUrl
    };
  });

  // Filter by status if provided
  let filtered = processed;
  if (status && status !== 'ALL') {
    filtered = filtered.filter(i => i.status === status);
  }

  // Sort
  if (sortBy === 'name_asc') filtered.sort((a, b) => a.name.localeCompare(b.name));
  else if (sortBy === 'name_desc') filtered.sort((a, b) => b.name.localeCompare(a.name));
  else if (sortBy === 'stock_asc') filtered.sort((a, b) => a.inStock - b.inStock);
  else if (sortBy === 'stock_desc') filtered.sort((a, b) => b.inStock - a.inStock);

  const total = filtered.length;
  const paginated = filtered.slice(skip, skip + limit);

  return {
    ingredients: paginated,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
  };
}

export async function getIngredientById(tenantId: string, id: string) {
  return prisma.ingredient.findFirst({
    where: { id, tenantId },
    include: { stock: { include: { branch: true } } }
  });
}

export async function createIngredient(tenantId: string, data: any) {
  return prisma.$transaction(async (tx) => {
    const ing = await tx.ingredient.create({
      data: {
        tenantId,
        name: data.name,
        category: data.category,
        unit: data.unit,
        minThreshold: data.minThreshold,
        imageUrl: data.imageUrl,
        costPerUnit: data.costPerUnit || 0,
        supplierName: data.supplierName,
      }
    });

    if (data.branchIds && data.branchIds.length > 0) {
      for (const branchId of data.branchIds) {
        await tx.stock.create({
          data: {
            tenantId,
            branchId,
            ingredientId: ing.id,
            quantity: data.initialStock || 0,
            reorderLevel: data.minThreshold
          }
        });
      }
    }

    return ing;
  });
}

export async function updateIngredient(tenantId: string, id: string, data: any) {
  return prisma.ingredient.update({
    where: { id, tenantId }, // Prisma will fail if it's not unique enough, wait, id is @id, so it's fine. We check tenantId just in case
    data
  });
}

export async function deleteIngredient(tenantId: string, id: string) {
  return prisma.ingredient.delete({ where: { id } });
}

export async function adjustStock(tenantId: string, ingredientId: string, data: any) {
  const { branchId, quantity, type, reason, note } = data;
  const delta = type === 'ADD' ? quantity : -quantity;

  const result = await prisma.$transaction(async (tx) => {
    const stock = await tx.stock.upsert({
      where: { branchId_ingredientId: { branchId, ingredientId } },
      create: { tenantId, branchId, ingredientId, quantity: Math.max(0, delta) },
      update: { quantity: { increment: delta } },
      include: { ingredient: true, branch: true },
    });
    
    await tx.stockMovement.create({ 
      data: { 
        tenantId, branchId, ingredientId, 
        type: 'ADJUSTMENT', 
        quantity: delta, 
        note: reason ? `[${reason}] ${note || ''}` : note 
      } 
    });
    return stock;
  });
  
  await sendLowStockIfNeeded({ tenantId, branchId, ingredientId });
  return result;
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
      where,
      skip,
      take: limit,
      include: { lines: { include: { ingredient: true } }, branch: true },
      orderBy: { createdAt: 'desc' }
    })
  ]);

  return {
    orders: pos.map(po => ({
      id: po.id,
      status: po.status,
      supplier: po.supplierName || 'Unknown Supplier',
      items: po.lines.length,
      amount: '-', // Would calculate from prices if we stored them
      date: po.createdAt,
      branchName: po.branch.name
    })),
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
  };
}

export async function createPurchaseOrder(tenantId: string, data: any) {
  return prisma.purchaseOrder.create({
    data: {
      tenantId,
      branchId: data.branchId,
      supplierName: data.supplierName,
      status: 'SENT',
      lines: {
        create: data.lines.map((l: any) => ({
          ingredientId: l.ingredientId,
          orderedQty: l.orderedQty
        }))
      }
    },
    include: { lines: { include: { ingredient: true } } },
  });
}

export async function updatePurchaseOrder(tenantId: string, id: string, data: any) {
  return prisma.purchaseOrder.update({
    where: { id },
    data
  });
}

export async function receivePurchaseOrder(tenantId: string, id: string, data: any) {
  const po = await prisma.purchaseOrder.findFirst({ where: { id, tenantId }, include: { lines: true } });
  if (!po) return null;

  // Assuming full receive for now based on orderedQty
  const updated = await prisma.$transaction(async (tx) => {
    const updatedPo = await tx.purchaseOrder.update({ where: { id }, data: { status: 'RECEIVED' }, include: { lines: true, branch: true } });
    
    for (const line of updatedPo.lines) {
      const received = line.orderedQty;
      await tx.purchaseOrderLine.update({
        where: { purchaseOrderId_ingredientId: { purchaseOrderId: id, ingredientId: line.ingredientId } },
        data: { receivedQty: received },
      });
      
      if (received > 0) {
        await tx.stock.upsert({
          where: { branchId_ingredientId: { branchId: updatedPo.branchId, ingredientId: line.ingredientId } },
          create: { tenantId, branchId: updatedPo.branchId, ingredientId: line.ingredientId, quantity: received },
          update: { quantity: { increment: received } },
        });
        await tx.stockMovement.create({
          data: { tenantId, branchId: updatedPo.branchId, ingredientId: line.ingredientId, type: 'PURCHASE_RECEIPT', quantity: received, reference: id, note: `PO receipt (${id})` },
        });
      }
    }
    return updatedPo;
  });

  return updated;
}

export async function autoGeneratePurchaseOrder(tenantId: string, branchId: string) {
  const ingredients = await prisma.ingredient.findMany({
    where: { tenantId },
    include: { stock: { where: { branchId } } }
  });

  const lines = [];
  for (const ing of ingredients) {
    const stock = ing.stock[0]?.quantity || 0;
    if (stock <= ing.minThreshold && ing.minThreshold > 0) {
      // order enough to bring it to minThreshold * 2 (or just double minThreshold)
      const orderAmount = (ing.minThreshold * 2) - stock;
      if (orderAmount > 0) {
         lines.push({ ingredientId: ing.id, orderedQty: orderAmount, estimatedUnitCost: ing.costPerUnit || 0 });
      }
    }
  }

  if (lines.length === 0) return null;

  return prisma.purchaseOrder.create({
    data: {
      tenantId, branchId,
      supplierName: 'Auto-Generated PO',
      status: 'DRAFT',
      estimatedTotal: lines.reduce((sum, l) => sum + (l.orderedQty * l.estimatedUnitCost), 0),
      lines: {
        create: lines
      }
    },
    include: { lines: { include: { ingredient: true } }, branch: true }
  });
}

export async function getWastageLogs(tenantId: string, q: any) {
  const { branchId, dateFrom, dateTo, page = 1, limit = 10 } = q;
  const skip = (page - 1) * limit;

  const where: any = { tenantId, type: 'WASTAGE' };
  if (branchId) where.branchId = branchId;
  
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(dateTo);
  }

  const [total, logs] = await Promise.all([
    prisma.stockMovement.count({ where }),
    prisma.stockMovement.findMany({
      where,
      skip,
      take: limit,
      include: { ingredient: true, branch: true },
      orderBy: { createdAt: 'desc' }
    })
  ]);

  return {
    logs: logs.map(l => ({
      id: l.id,
      date: l.createdAt,
      ingredientName: l.ingredient.name,
      quantityLost: Math.abs(l.quantity),
      unit: l.ingredient.unit,
      reason: l.note || 'Other',
      reportedBy: 'System', // Would map to user if we stored userId
      branchName: l.branch.name
    })),
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
  };
}

export async function createWastageLog(tenantId: string, data: any) {
  const { branchId, ingredientId, quantity, reason, note } = data;
  
  const result = await prisma.$transaction(async (tx) => {
    const stock = await tx.stock.upsert({
      where: { branchId_ingredientId: { branchId, ingredientId } },
      create: { tenantId, branchId, ingredientId, quantity: 0 },
      update: { quantity: { decrement: quantity } }, // Wastage reduces stock
    });
    
    const movement = await tx.stockMovement.create({ 
      data: { 
        tenantId, branchId, ingredientId, 
        type: 'WASTAGE', 
        quantity: -quantity, // Negative for out
        note: `[${reason}] ${note || ''}` 
      } 
    });
    return movement;
  });
  
  await sendLowStockIfNeeded({ tenantId, branchId, ingredientId });
  return result;
}

export async function getRecipes(tenantId: string) {
  const items = await prisma.item.findMany({
    where: { tenantId },
    include: {
      recipe: {
        include: { lines: { include: { ingredient: true } } }
      },
      category: true
    },
    orderBy: { name: 'asc' }
  });

  return items.map(item => ({
    itemId: item.id,
    itemName: item.name,
    categoryName: item.category?.name || 'Uncategorized',
    hasRecipe: !!item.recipe,
    recipe: item.recipe ? {
      id: item.recipe.id,
      lines: item.recipe.lines.map(l => ({
        id: l.id,
        ingredientId: l.ingredientId,
        ingredientName: l.ingredient.name,
        quantity: l.quantity,
        unit: l.ingredient.unit,
        cost: l.quantity * (l.ingredient.costPerUnit || 0)
      }))
    } : null,
    totalCost: item.recipe 
      ? item.recipe.lines.reduce((sum, l) => sum + (l.quantity * (l.ingredient.costPerUnit || 0)), 0)
      : 0
  }));
}

export async function upsertRecipe(tenantId: string, body: { itemId: string; lines: any[] }) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.recipe.findFirst({ where: { tenantId, itemId: body.itemId } });
    if (existing) {
      await tx.recipeLine.deleteMany({ where: { recipeId: existing.id } });
      return tx.recipe.update({ where: { id: existing.id }, data: { lines: { create: body.lines } }, include: { lines: true } });
    }
    return tx.recipe.create({ data: { tenantId, itemId: body.itemId, lines: { create: body.lines } }, include: { lines: true } });
  });
}

export async function deductInventoryForOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true }
  });
  if (!order || !order.branchId) return;

  const tenantId = order.tenantId;
  const branchId = order.branchId;

  for (const orderItem of order.items) {
    const voids = await prisma.voidRequest.findMany({ where: { orderItemId: orderItem.id, status: 'APPROVED' } });
    const voidQty = voids.reduce((sum, v) => sum + v.quantity, 0);
    const effectiveQty = orderItem.quantity - voidQty;
    if (effectiveQty <= 0) continue;

    const recipe = await prisma.recipe.findUnique({
      where: { itemId: orderItem.itemId },
      include: { lines: { include: { ingredient: true } } }
    });

    if (!recipe) continue;

    for (const line of recipe.lines) {
      const deductionAmount = line.quantity * effectiveQty;
      const ingId = line.ingredientId;

      await prisma.$transaction(async (tx) => {
        const stock = await tx.stock.findUnique({
          where: { branchId_ingredientId: { branchId, ingredientId: ingId } }
        });
        const currentQty = stock?.quantity || 0;
        const newQty = currentQty - deductionAmount;
        const finalQty = newQty < 0 ? 0 : newQty;

        await tx.stock.upsert({
          where: { branchId_ingredientId: { branchId, ingredientId: ingId } },
          create: { tenantId, branchId, ingredientId: ingId, quantity: finalQty },
          update: { quantity: finalQty }
        });

        await tx.stockMovement.create({
          data: {
            tenantId, branchId, ingredientId: ingId,
            type: 'DEDUCT_SALE',
            quantity: -deductionAmount,
            reference: orderId,
            note: `Auto-deduct for order #${order.orderNumber}`
          }
        });

        if (newQty < 0) {
          await tx.anomalyEvent.create({
            data: {
              tenantId, branchId,
              type: 'STOCK_DISCREPANCY',
              description: `Stock for ${line.ingredient.name} fell below 0 due to order #${order.orderNumber}. Expected: ${newQty}, reset to 0.`,
              severity: 'HIGH',
              source: 'INVENTORY_ENGINE'
            }
          });
        }
      });
      
      await sendLowStockIfNeeded({ tenantId, branchId, ingredientId: ingId });
    }
  }
}

