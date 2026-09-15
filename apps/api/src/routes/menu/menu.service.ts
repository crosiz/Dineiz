import { prisma } from '@dineiz/db';
import { uploadImage } from '../../lib/cloudinary';
import Anthropic from '@anthropic-ai/sdk';
import Papa from 'papaparse';
import { getIO, emitMenuPriceChanged } from '../../lib/socket';
import { invalidatePattern } from '../../lib/cache';

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

  // If branchId is specified, map availability status and override price.
  // `basePrice` stays the *effective* price (what the card/list shows);
  // `globalBasePrice` / `branchOverridePrice` let the editor tell them apart.
  if (params.branchId && params.branchId !== 'all') {
    return items.map((item) => {
      const branchItem = item.branchMenuItems[0];
      const hasOverride = branchItem?.overridePrice !== null && branchItem?.overridePrice !== undefined;
      return {
        ...item,
        isAvailable: branchItem ? branchItem.isAvailable : true,
        isInStock: branchItem ? branchItem.isInStock : true,
        basePrice: hasOverride ? branchItem!.overridePrice : item.basePrice,
        globalBasePrice: item.basePrice,
        branchOverridePrice: hasOverride ? branchItem!.overridePrice : null,
      };
    });
  }

  return items.map(item => ({
    ...item,
    isInStock: true, // Default to in stock in all-branch view
    globalBasePrice: item.basePrice,
    branchOverridePrice: null,
  }));
}

export async function getItemById(tenantId: string, id: string, branchId?: string) {
  const scoped = branchId && branchId !== 'all' ? branchId : undefined;
  const item = await prisma.item.findFirst({
    where: { id, tenantId },
    include: {
      category: { select: { id: true, name: true } },
      variations: { orderBy: { createdAt: 'asc' } },
      addOns: { orderBy: { createdAt: 'asc' } },
      ...(scoped ? { branchMenuItems: { where: { branchId: scoped } } } : {}),
    },
  });
  if (!item) return item;

  if (scoped) {
    const branchItem = (item as any).branchMenuItems?.[0];
    const { branchMenuItems, ...rest } = item as any;
    return {
      ...rest,
      globalBasePrice: item.basePrice,
      branchOverridePrice: branchItem?.overridePrice ?? null,
      isAvailable: branchItem ? branchItem.isAvailable : true,
      isInStock: branchItem ? branchItem.isInStock : true,
      basePrice:
        branchItem?.overridePrice !== null && branchItem?.overridePrice !== undefined
          ? branchItem.overridePrice
          : item.basePrice,
    };
  }

  return { ...item, globalBasePrice: item.basePrice, branchOverridePrice: null };
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

/**
 * Bulk version of toggleItemAvailability — used by the POS Stock screen's "Mark
 * Items Unavailable" action and the dashboard's bulk item selector. Runs with
 * bounded concurrency rather than one-at-a-time (visibly slow for >5 items) or
 * fully parallel (would blow past the pooled connection limit on the shared
 * dev DB).
 */
export async function bulkToggleItemAvailability(tenantId: string, itemIds: string[], isAvailable: boolean, branchId?: string) {
  const CONCURRENCY = 5;
  const results: Awaited<ReturnType<typeof toggleItemAvailability>>[] = [];
  for (let i = 0; i < itemIds.length; i += CONCURRENCY) {
    const batch = itemIds.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map((id) => toggleItemAvailability(tenantId, id, isAvailable, branchId)));
    results.push(...batchResults);
  }
  return results;
}

/**
 * Per-branch config for a single item: availability + price override for ONE branch,
 * without touching the global item. `overridePrice: null` clears the override
 * (the branch falls back to the item's base price).
 */
export async function updateItemBranchConfig(
  tenantId: string,
  itemId: string,
  data: { branchId?: string; isAvailable?: boolean; overridePrice?: number | null }
) {
  const branchId = data.branchId;
  if (!branchId || branchId === 'all') {
    throw Object.assign(new Error('Select a specific branch to set branch pricing'), { statusCode: 400 });
  }
  const item = await prisma.item.findFirst({ where: { id: itemId, tenantId } });
  if (!item) throw Object.assign(new Error('Item not found'), { statusCode: 404 });

  const update: Record<string, unknown> = {};
  if (data.isAvailable !== undefined) update.isAvailable = data.isAvailable;
  if (data.overridePrice !== undefined) update.overridePrice = data.overridePrice; // null clears

  const branchItem = await prisma.branchMenuItem.upsert({
    where: { branchId_itemId: { branchId, itemId } },
    update,
    create: {
      branchId,
      itemId,
      isAvailable: data.isAvailable ?? true,
      isInStock: true,
      overridePrice: data.overridePrice ?? null,
    },
  });

  if (data.overridePrice !== undefined) {
    emitMenuPriceChanged(tenantId, branchId, {
      itemId,
      price: data.overridePrice ?? item.basePrice,
    });
  }
  invalidatePattern(`menu:${tenantId}:*`).catch(() => {});

  const full = await prisma.item.findFirst({
    where: { id: itemId, tenantId },
    include: { category: { select: { id: true, name: true } }, variations: true, addOns: true },
  });
  const hasOverride = branchItem.overridePrice !== null && branchItem.overridePrice !== undefined;
  return {
    ...full,
    isAvailable: branchItem.isAvailable,
    isInStock: branchItem.isInStock,
    globalBasePrice: full!.basePrice,
    branchOverridePrice: hasOverride ? branchItem.overridePrice : null,
    basePrice: hasOverride ? branchItem.overridePrice : full!.basePrice,
  };
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

/** `Name:price;Name:price` -> [{ name, price }]. Throws on a malformed token. */
function parsePriceOptions(raw: string | undefined, label: string): Array<{ name: string; price: number }> {
  const s = (raw ?? '').trim();
  if (!s) return [];
  return s
    .split(';')
    .map((tok) => tok.trim())
    .filter(Boolean)
    .map((tok) => {
      const idx = tok.lastIndexOf(':');
      if (idx === -1) throw new Error(`${label} "${tok}" must be written as Name:price`);
      const name = tok.slice(0, idx).trim();
      const price = Number(tok.slice(idx + 1).trim());
      if (!name) throw new Error(`${label} "${tok}" is missing a name`);
      if (!Number.isFinite(price) || price < 0) throw new Error(`${label} "${tok}" has an invalid price`);
      return { name, price };
    });
}

function parseCsvBool(raw: unknown, fallback = true): boolean {
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === '') return fallback;
  return !['false', 'no', 'n', '0', 'off'].includes(v);
}

interface BulkUploadOptions {
  branchId?: string;
  mode?: 'insert' | 'upsert';
}

/**
 * Flat-CSV menu importer. One row per item; `variations` / `add_ons` / `tags`
 * are encoded lists in a single cell. Each item is written in its own
 * transaction so one bad row never rolls back the whole file.
 */
export async function bulkUploadMenu(tenantId: string, csvBuffer: Buffer, opts: BulkUploadOptions = {}) {
  const branchId = opts.branchId && opts.branchId !== 'all' ? opts.branchId : undefined;
  const mode: 'insert' | 'upsert' = opts.mode === 'upsert' ? 'upsert' : 'insert';

  // strip a leading UTF-8 BOM (Excel adds one when it saves CSV)
  const csvString = csvBuffer.toString('utf-8').replace(/^\uFEFF/, '');
  const parsed = Papa.parse<Record<string, string>>(csvString, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  if (parsed.errors?.length) {
    throw Object.assign(new Error('Could not read the CSV file'), {
      details: parsed.errors.map((e) => ({ row: (e.row ?? 0) + 2, message: e.message })),
    });
  }

  const rows = (parsed.data ?? []) as Record<string, string>[];
  if (rows.length === 0) {
    throw Object.assign(new Error('The file has a header but no item rows'), { errors: [] });
  }

  const errors: Array<{ row: number; message: string }> = [];
  const valid: Array<{
    rowNum: number;
    category: string;
    categoryDescription: string | null;
    itemName: string;
    itemDescription: string | null;
    basePrice: number;
    unitType: string;
    isAvailable: boolean;
    tags: string[];
    variations: Array<{ name: string; price: number }>;
    addOns: Array<{ name: string; price: number }>;
  }> = [];

  rows.forEach((row, i) => {
    const rowNum = i + 2; // header is line 1
    const problems: string[] = [];

    const category = (row['category'] ?? '').trim();
    const itemName = (row['item_name'] ?? '').trim();
    const basePriceRaw = (row['base_price'] ?? '').trim();
    const basePrice = Number(basePriceRaw);

    if (!category) problems.push('category is required');
    if (!itemName) problems.push('item_name is required');
    if (!basePriceRaw || !Number.isFinite(basePrice) || basePrice < 0) {
      problems.push('base_price must be a number of 0 or more');
    }

    let variations: Array<{ name: string; price: number }> = [];
    let addOns: Array<{ name: string; price: number }> = [];
    try { variations = parsePriceOptions(row['variations'], 'variation'); }
    catch (e: any) { problems.push(e.message); }
    try { addOns = parsePriceOptions(row['add_ons'], 'add-on'); }
    catch (e: any) { problems.push(e.message); }

    if (problems.length) {
      errors.push({ row: rowNum, message: problems.join('; ') });
      return;
    }

    valid.push({
      rowNum,
      category,
      categoryDescription: (row['category_description'] ?? '').trim() || null,
      itemName,
      itemDescription: (row['item_description'] ?? '').trim() || null,
      basePrice,
      unitType: (row['unit_type'] ?? '').trim() || 'Per Item',
      isAvailable: parseCsvBool(row['is_available'], true),
      tags: (row['tags'] ?? '').split(';').map((t) => t.trim()).filter(Boolean),
      variations,
      addOns,
    });
  });

  let created = 0;
  let updated = 0;
  let skipped = 0;

  // Resolve (or create) every distinct category once, case-insensitively.
  const categoryIdByKey = new Map<string, string>();
  let sortBase = await prisma.category.count({ where: { tenantId } });
  for (const v of valid) {
    const key = v.category.toLowerCase();
    if (categoryIdByKey.has(key)) continue;
    let cat = await prisma.category.findFirst({
      where: { tenantId, name: { equals: v.category, mode: 'insensitive' } },
    });
    if (!cat) {
      cat = await prisma.category.create({
        data: { tenantId, name: v.category, description: v.categoryDescription ?? undefined, sortOrder: sortBase++ },
      });
    }
    categoryIdByKey.set(key, cat.id);
    if (branchId) {
      await prisma.branchMenuCategory.upsert({
        where: { branchId_categoryId: { branchId, categoryId: cat.id } },
        update: {},
        create: { branchId, categoryId: cat.id, isAvailable: true },
      });
    }
  }

  for (const v of valid) {
    const categoryId = categoryIdByKey.get(v.category.toLowerCase())!;
    try {
      const existing = await prisma.item.findFirst({
        where: { tenantId, categoryId, name: { equals: v.itemName, mode: 'insensitive' } },
      });

      if (existing && mode === 'insert') {
        skipped++;
        continue;
      }

      if (existing && mode === 'upsert') {
        // Multi-statement (wipe + recreate variations/add-ons) genuinely
        // benefits from atomicity, so this one stays a transaction — just
        // with a longer timeout than Prisma's 5s default. Under real network
        // latency to a remote dev DB, five sequential statements comfortably
        // blow past 5s and the whole row fails with "transaction closed",
        // even though every individual query was fine.
        await prisma.$transaction(async (tx) => {
          await tx.variation.deleteMany({ where: { itemId: existing.id } });
          await tx.addOn.deleteMany({ where: { itemId: existing.id } });
          await tx.item.update({
            where: { id: existing.id },
            data: {
              description: v.itemDescription,
              basePrice: v.basePrice,
              unitType: v.unitType,
              isAvailable: v.isAvailable,
              tags: v.tags,
              variations: { create: v.variations },
              addOns: { create: v.addOns },
            },
          });
          if (branchId) {
            await tx.branchMenuItem.upsert({
              where: { branchId_itemId: { branchId, itemId: existing.id } },
              update: { isAvailable: v.isAvailable },
              create: { branchId, itemId: existing.id, isAvailable: v.isAvailable, isInStock: true },
            });
          }
        }, { timeout: 15_000 });
        updated++;
        continue;
      }

      // A brand-new item's variations/add-ons are created as part of the
      // same `item.create` call (Prisma nests them into one query), so this
      // needs no explicit $transaction wrapper — avoids holding an
      // interactive-transaction connection (and its 5s timeout) across what
      // is really just one write plus an optional second one.
      const itemCount = await prisma.item.count({ where: { tenantId, categoryId } });
      const item = await prisma.item.create({
        data: {
          tenantId,
          categoryId,
          name: v.itemName,
          description: v.itemDescription,
          basePrice: v.basePrice,
          unitType: v.unitType,
          isAvailable: v.isAvailable,
          tags: v.tags,
          sortOrder: itemCount,
          variations: { create: v.variations },
          addOns: { create: v.addOns },
        },
      });
      if (branchId) {
        await prisma.branchMenuItem.create({
          data: { branchId, itemId: item.id, isAvailable: v.isAvailable, isInStock: true },
        });
      }
      created++;
    } catch (e: any) {
      errors.push({ row: v.rowNum, message: e?.message || 'Failed to save this row' });
    }
  }

  if (created || updated) {
    invalidatePattern(`menu:${tenantId}:*`).catch(() => {});
    const io = getIO();
    if (io) {
      const payload = { tenantId, timestamp: new Date().toISOString() };
      if (branchId) io.of('/pos').to(`branch:${branchId}`).emit('menu:published', payload);
      io.of('/pos').to(`tenant:${tenantId}`).emit('menu:published', payload);
    }
  }

  return { created, updated, skipped, failed: errors.length, errors };
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

  invalidatePattern(`menu:${tenantId}:*`).catch(() => {});

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
