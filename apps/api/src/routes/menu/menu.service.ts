import { prisma } from '@dineiz/db';
import { uploadImage } from '../../lib/cloudinary';
import Anthropic from '@anthropic-ai/sdk';
import Papa from 'papaparse';
import { getIO, emitMenuPriceChanged } from '../../lib/socket';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

// ─── Full Menu (legacy POS endpoint) ─────────────────────────────────────────

export async function getFullMenu(tenantId: string, branchId?: string) {
  const where: any = { tenantId };
  if (branchId) {
    where.OR = [
      { branchMenuCategories: { some: { branchId, isAvailable: true } } },
      { branchMenuCategories: { none: {} } }
    ];
  }
  
  return prisma.category.findMany({
    where,
    orderBy: { sortOrder: 'asc' },
    include: {
      items: {
        where: branchId ? {
          OR: [
            { branchMenuItems: { some: { branchId, isAvailable: true } } },
            { branchMenuItems: { none: { branchId } }, isAvailable: true }
          ]
        } : { isAvailable: true },
        orderBy: { sortOrder: 'asc' },
        include: { variations: true, addOns: true },
      },
    },
  });
}

// ─── Categories ──────────────────────────────────────────────────────────────

export async function getCategoriesForTenant(tenantId: string, branchId?: string) {
  const where: any = { tenantId };
  if (branchId && branchId !== 'all') {
    where.OR = [
      { branchMenuCategories: { some: { branchId, isAvailable: true } } },
      { branchMenuCategories: { none: {} } }
    ];
  }

  const itemsWhere = (branchId && branchId !== 'all') ? {
    OR: [
      { branchMenuItems: { some: { branchId, isAvailable: true } } },
      { branchMenuItems: { none: {} } }
    ]
  } : {};

  const categories = await prisma.category.findMany({
    where,
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { items: { where: itemsWhere } } } },
  });
  return categories.map((c) => ({
    ...c,
    itemCount: c._count.items,
  }));
}

export async function createCategory(tenantId: string, data: any) {
  const { branchId, ...categoryData } = data;
  const count = await prisma.category.count({ where: { tenantId } });
  return prisma.$transaction(async (tx) => {
    const category = await tx.category.create({
      data: { name: categoryData.name, description: categoryData.description, tenantId, sortOrder: count },
    });
    if (branchId && branchId !== 'all') {
      await tx.branchMenuCategory.create({
        data: {
          branchId,
          categoryId: category.id,
          isAvailable: true,
        },
      });
    }
    return category;
  });
}

export async function updateCategory(tenantId: string, id: string, data: any) {
  return prisma.category.update({ where: { id, tenantId }, data });
}

export async function deleteCategory(tenantId: string, id: string) {
  return prisma.category.delete({ where: { id, tenantId } });
}

export async function toggleCategoryAvailability(
  tenantId: string,
  id: string,
  isAvailable: boolean,
  branchId?: string
) {
  if (branchId && branchId !== 'all') {
    return prisma.branchMenuCategory.upsert({
      where: {
        branchId_categoryId: {
          branchId,
          categoryId: id,
        },
      },
      update: {
        isAvailable,
      },
      create: {
        branchId,
        categoryId: id,
        isAvailable,
      },
    });
  }
  return null;
}

export async function reorderCategories(tenantId: string, ids: string[]) {
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.category.update({
        where: { id, tenantId },
        data: { sortOrder: index },
      })
    )
  );
}

// ─── Items ───────────────────────────────────────────────────────────────────

export async function getItemsForTenant(
  tenantId: string,
  params: { categoryId?: string; search?: string; isAvailable?: boolean; branchId?: string }
) {
  const where: any = { tenantId };
  if (params.categoryId) where.categoryId = params.categoryId;
  if (params.search) where.name = { contains: params.search, mode: 'insensitive' };

  if (params.branchId && params.branchId !== 'all') {
    where.category = {
      OR: [
        { branchMenuCategories: { some: { branchId: params.branchId, isAvailable: true } } },
        { branchMenuCategories: { none: {} } }
      ]
    };
  }

  if (params.isAvailable !== undefined) {
    if (params.branchId && params.branchId !== 'all') {
      if (params.isAvailable) {
        where.OR = [
          { branchMenuItems: { some: { branchId: params.branchId, isAvailable: true } } },
          { branchMenuItems: { none: { branchId: params.branchId } } }
        ];
      } else {
        where.branchMenuItems = { some: { branchId: params.branchId, isAvailable: false } };
      }
    } else {
      where.isAvailable = params.isAvailable;
    }
  }

  const items = await prisma.item.findMany({
    where,
    orderBy: [{ categoryId: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    include: {
      category: { select: { id: true, name: true } },
      variations: { orderBy: { createdAt: 'asc' } },
      addOns: { orderBy: { createdAt: 'asc' } },
      branchMenuItems: {
        where: params.branchId && params.branchId !== 'all' ? { branchId: params.branchId } : undefined,
      },
    },
  });

  // If branchId is specified, map availability status and override price
  if (params.branchId && params.branchId !== 'all') {
    return items.map((item) => {
      const branchItem = item.branchMenuItems[0];
      return {
        ...item,
        isAvailable: branchItem ? branchItem.isAvailable : true,
        isInStock: branchItem ? branchItem.isInStock : true,
        basePrice: branchItem?.overridePrice !== null && branchItem?.overridePrice !== undefined ? branchItem.overridePrice : item.basePrice,
      };
    });
  }

  return items.map(item => ({
    ...item,
    isInStock: true, // Default to in stock in all-branch view
  }));
}

export async function getItemById(tenantId: string, id: string) {
  return prisma.item.findFirst({
    where: { id, tenantId },
    include: {
      category: { select: { id: true, name: true } },
      variations: { orderBy: { createdAt: 'asc' } },
      addOns: { orderBy: { createdAt: 'asc' } },
    },
  });
}

export async function createItem(tenantId: string, body: any) {
  const { variations = [], addOns = [], branchId, ...itemData } = body;
  const count = await prisma.item.count({ where: { tenantId, categoryId: itemData.categoryId } });
  return prisma.$transaction(async (tx) => {
    const item = await tx.item.create({
      data: {
        ...itemData,
        tenantId,
        sortOrder: count,
        variations: { create: variations.map(({ id: _id, ...v }: any) => v) },
        addOns: { create: addOns.map(({ id: _id, ...a }: any) => a) },
      },
      include: {
        category: { select: { id: true, name: true } },
        variations: true,
        addOns: true,
      },
    });

    if (branchId && branchId !== 'all') {
      await tx.branchMenuItem.create({
        data: {
          branchId,
          itemId: item.id,
          isAvailable: true,
          isInStock: true,
        },
      });
    }

    return item;
  });
}

export async function updateItem(tenantId: string, id: string, body: any) {
  const { variations, addOns, ...itemData } = body;
  return prisma.$transaction(async (tx) => {
    if (variations !== undefined) {
      await tx.variation.deleteMany({ where: { itemId: id } });
    }
    if (addOns !== undefined) {
      await tx.addOn.deleteMany({ where: { itemId: id } });
    }
    const updatedItem = await tx.item.update({
      where: { id, tenantId },
      data: {
        ...itemData,
        ...(variations !== undefined && {
          variations: { create: variations.map(({ id: _id, ...v }: any) => v) },
        }),
        ...(addOns !== undefined && {
          addOns: { create: addOns.map(({ id: _id, ...a }: any) => a) },
        }),
      },
      include: {
        category: { select: { id: true, name: true } },
        variations: true,
        addOns: true,
      },
    });

    if (itemData.basePrice !== undefined) {
      emitMenuPriceChanged(tenantId, null, { itemId: id, price: itemData.basePrice });
    }

    return updatedItem;
  });
}

export async function deleteItem(tenantId: string, id: string) {
  return prisma.item.delete({ where: { id, tenantId } });
}

export async function toggleItemAvailability(
  tenantId: string,
  id: string,
  isAvailable: boolean,
  branchId?: string
) {
  if (branchId && branchId !== 'all') {
    const branchItem = await prisma.branchMenuItem.upsert({
      where: {
        branchId_itemId: {
          branchId,
          itemId: id,
        },
      },
      update: {
        isAvailable,
      },
      create: {
        branchId,
        itemId: id,
        isAvailable,
        isInStock: true,
      },
    });
    const item = await prisma.item.findFirst({
      where: { id, tenantId },
      include: { category: { select: { id: true, name: true } }, variations: true, addOns: true },
    });
    if (!item) throw new Error('Item not found');
    return {
      ...item,
      isAvailable: branchItem.isAvailable,
      isInStock: branchItem.isInStock,
      basePrice: branchItem.overridePrice !== null && branchItem.overridePrice !== undefined ? branchItem.overridePrice : item.basePrice,
    };
  }

  return prisma.item.update({
    where: { id, tenantId },
    data: { isAvailable },
    include: { category: { select: { id: true, name: true } }, variations: true, addOns: true },
  });
}

// ─── Image ───────────────────────────────────────────────────────────────────

export async function uploadItemImage(tenantId: string, id: string, buffer: Buffer) {
  const result = await uploadImage(buffer, tenantId, 'menu');
  const item = await prisma.item.update({ where: { id, tenantId }, data: { image: result.url } });
  return { url: result.url, item };
}

export async function deleteItemImage(tenantId: string, id: string) {
  return prisma.item.update({ where: { id, tenantId }, data: { image: null } });
}

// ─── Variations ──────────────────────────────────────────────────────────────

export async function getVariationsForItem(tenantId: string, itemId: string) {
  return prisma.variation.findMany({
    where: { itemId, item: { tenantId } },
    orderBy: { createdAt: 'asc' },
  });
}

export async function createVariation(tenantId: string, itemId: string, data: any) {
  // Verify item belongs to tenant
  const item = await prisma.item.findFirst({ where: { id: itemId, tenantId } });
  if (!item) throw new Error('Item not found');
  return prisma.variation.create({ data: { itemId, name: data.name, price: data.price } });
}

export async function updateVariation(tenantId: string, id: string, data: any) {
  const variation = await prisma.variation.findFirst({
    where: { id },
    include: { item: { select: { tenantId: true } } },
  });
  if (!variation || variation.item.tenantId !== tenantId) throw new Error('Variation not found');
  const updatedVariation = await prisma.variation.update({ where: { id }, data });
  if (data.price !== undefined) {
    emitMenuPriceChanged(tenantId, null, { variationId: id, price: data.price });
  }
  return updatedVariation;
}

export async function deleteVariation(tenantId: string, id: string) {
  const variation = await prisma.variation.findFirst({
    where: { id },
    include: { item: { select: { tenantId: true } } },
  });
  if (!variation || variation.item.tenantId !== tenantId) throw new Error('Variation not found');
  return prisma.variation.delete({ where: { id } });
}

// ─── Add-ons ─────────────────────────────────────────────────────────────────

export async function getAddOnsForItem(tenantId: string, itemId: string) {
  return prisma.addOn.findMany({
    where: { itemId, item: { tenantId } },
    orderBy: { createdAt: 'asc' },
  });
}

export async function createAddOn(tenantId: string, itemId: string, data: any) {
  const item = await prisma.item.findFirst({ where: { id: itemId, tenantId } });
  if (!item) throw new Error('Item not found');
  return prisma.addOn.create({ data: { itemId, name: data.name, price: data.price } });
}

export async function updateAddOn(tenantId: string, id: string, data: any) {
  const addOn = await prisma.addOn.findFirst({
    where: { id },
    include: { item: { select: { tenantId: true } } },
  });
  if (!addOn || addOn.item.tenantId !== tenantId) throw new Error('Add-on not found');
  return prisma.addOn.update({ where: { id }, data });
}

export async function deleteAddOn(tenantId: string, id: string) {
  const addOn = await prisma.addOn.findFirst({
    where: { id },
    include: { item: { select: { tenantId: true } } },
  });
  if (!addOn || addOn.item.tenantId !== tenantId) throw new Error('Add-on not found');
  return prisma.addOn.delete({ where: { id } });
}

// ─── AI Description ──────────────────────────────────────────────────────────

export async function generateAIDescription(itemName: string, categoryName?: string) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      description: `A delicious serving of our finest ${itemName}, prepared fresh daily with the finest ingredients.`,
    };
  }
  const prompt = categoryName
    ? `Write a 2-sentence appetizing menu description for '${itemName}' in the ${categoryName} category. Be concise and mouth-watering.`
    : `Write a 2-sentence appetizing menu description for '${itemName}'. Be concise and mouth-watering.`;

  const response = await anthropic.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 150,
    messages: [{ role: 'user', content: prompt }],
  });
  // @ts-ignore
  return { description: response.content[0].text };
}

// ─── Bulk Upload ─────────────────────────────────────────────────────────────

export async function bulkUploadMenu(tenantId: string, csvBuffer: Buffer) {
  const csvString = csvBuffer.toString('utf-8');
  const parsed = Papa.parse(csvString, { header: true, skipEmptyLines: true, dynamicTyping: true });

  if (parsed.errors?.length > 0) {
    throw Object.assign(new Error('CSV parsing failed'), { details: parsed.errors });
  }

  const rows = parsed.data as Array<any>;
  const rowErrors: Array<{ row: number; message: string }> = [];
  const validRows: any[] = [];

  rows.forEach((row, index) => {
    const rowNum = index + 2;
    const errs: string[] = [];
    if (!row.category_name) errs.push('category_name is required');
    if (!row.item_name) errs.push('item_name is required');
    if (row.base_price === undefined || isNaN(Number(row.base_price))) {
      errs.push('base_price must be a valid number');
    }
    if (errs.length > 0) {
      rowErrors.push({ row: rowNum, message: errs.join('; ') });
    } else {
      validRows.push({
        categoryName: String(row.category_name).trim(),
        itemName: String(row.item_name).trim(),
        basePrice: Number(row.base_price),
        unitType: row.unit_type ? String(row.unit_type).trim() : 'Per Item',
        description: row.description ? String(row.description).trim() : null,
        isAvailable: row.is_available === undefined ? true : row.is_available !== false && row.is_available !== 'false' && row.is_available !== 0,
      });
    }
  });

  let createdItems = 0;

  await prisma.$transaction(async (tx) => {
    const categoriesSet = new Set<string>();
    validRows.forEach((r) => categoriesSet.add(r.categoryName));
    const categoryMap = new Map<string, string>();
    let sortBase = await tx.category.count({ where: { tenantId } });

    for (const catName of categoriesSet) {
      let category = await tx.category.findFirst({ where: { tenantId, name: catName } });
      if (!category) {
        category = await tx.category.create({
          data: { tenantId, name: catName, sortOrder: sortBase++ },
        });
      }
      categoryMap.set(catName, category.id);
    }

    for (const row of validRows) {
      const catId = categoryMap.get(row.categoryName)!;
      const itemCount = await tx.item.count({ where: { tenantId, categoryId: catId } });
      await tx.item.create({
        data: {
          tenantId,
          categoryId: catId,
          name: row.itemName,
          description: row.description,
          basePrice: row.basePrice,
          isAvailable: row.isAvailable,
          sortOrder: itemCount,
        },
      });
      createdItems++;
    }
  });

  return {
    created: createdItems,
    failed: rowErrors.length,
    errors: rowErrors,
  };
}

// ─── Publish ─────────────────────────────────────────────────────────────────

export async function publishMenu(tenantId: string, body?: { sourceBranchId: string; branchIds: string[] }) {
  // Get all branches for this tenant
  const branches = await prisma.branch.findMany({
    where: { tenantId },
    select: { id: true },
  });

  const branchIds = (body?.branchIds && Array.isArray(body.branchIds)) ? body.branchIds : branches.map((b) => b.id);
  const sourceBranchId = body?.sourceBranchId;

  if (sourceBranchId && branchIds.length > 0) {
    // Get all categories & items for this tenant
    const categories = await prisma.category.findMany({ 
      where: { tenantId },
      include: { _count: { select: { branchMenuCategories: true } } }
    });
    const items = await prisma.item.findMany({ 
      where: { tenantId },
      include: { _count: { select: { branchMenuItems: true } } }
    });

    // Get source configurations
    const sourceCategories = await prisma.branchMenuCategory.findMany({ where: { branchId: sourceBranchId } });
    const sourceItems = await prisma.branchMenuItem.findMany({ where: { branchId: sourceBranchId } });

    const sourceCategoryMap = new Map(sourceCategories.map((c) => [c.categoryId, c.isAvailable]));
    const sourceItemMap = new Map(sourceItems.map((i) => [i.itemId, i]));

    // Sync to each target branch
    await prisma.$transaction(async (tx) => {
      for (const targetBranchId of branchIds) {
        // Sync Categories
        for (const category of categories) {
          const isGlobal = category._count.branchMenuCategories === 0;
          const isAvailable = sourceCategoryMap.get(category.id) ?? isGlobal;
          await tx.branchMenuCategory.upsert({
            where: {
              branchId_categoryId: {
                branchId: targetBranchId,
                categoryId: category.id,
              },
            },
            update: { isAvailable },
            create: { branchId: targetBranchId, categoryId: category.id, isAvailable },
          });
        }

        // Sync Items
        for (const item of items) {
          const isGlobal = item._count.branchMenuItems === 0;
          const sourceItem = sourceItemMap.get(item.id);
          const isAvailable = sourceItem ? sourceItem.isAvailable : isGlobal;
          const isInStock = sourceItem ? sourceItem.isInStock : true;
          const overridePrice = sourceItem ? sourceItem.overridePrice : null;

          await tx.branchMenuItem.upsert({
            where: {
              branchId_itemId: {
                branchId: targetBranchId,
                itemId: item.id,
              },
            },
            update: { isAvailable, isInStock, overridePrice },
            create: { branchId: targetBranchId, itemId: item.id, isAvailable, isInStock, overridePrice },
          });
        }
      }
    });
  }

  const io = getIO();
  if (io) {
    for (const branchId of branchIds) {
      io.of('/pos').to(`branch:${branchId}`).emit('menu:published', { tenantId, timestamp: new Date().toISOString() });
    }
    // Also emit on the tenant level
    io.of('/pos').to(`tenant:${tenantId}`).emit('menu:published', { tenantId, timestamp: new Date().toISOString() });
  }

  return {
    success: true,
    syncedChannels: branchIds.length,
    publishedAt: new Date().toISOString(),
  };
}
