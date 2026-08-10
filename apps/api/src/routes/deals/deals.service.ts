import { prisma } from '@dineiz/db';

function isWithinWindow(now: Date, startsAt?: Date | null, endsAt?: Date | null) {
  if (startsAt && now < startsAt) return false;
  if (endsAt && now > endsAt) return false;
  return true;
}

export async function listPromos(tenantId: string) {
  return prisma.promoCode.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
}

export async function createPromo(tenantId: string, body: any) {
  return prisma.promoCode.create({
    data: {
      tenantId,
      code: body.code,
      type: body.type,
      value: body.value,
      minOrder: body.minOrder,
      maxDiscount: body.maxDiscount,
      startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
      endsAt: body.endsAt ? new Date(body.endsAt) : undefined,
      usageLimit: body.usageLimit,
      isActive: body.isActive,
    },
  });
}

export async function listCombos(tenantId: string) {
  return prisma.combo.findMany({
    where: { tenantId },
    include: { items: { include: { item: { select: { name: true, basePrice: true } } } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createCombo(tenantId: string, body: any) {
  return prisma.combo.create({
    data: { tenantId, name: body.name, price: body.price, isActive: body.isActive, items: { create: body.items } },
    include: { items: true },
  });
}

export async function listBxGy(tenantId: string) {
  return prisma.buyXGetYDeal.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    include: {
      buyItem: { select: { name: true, basePrice: true } },
      getItem: { select: { name: true, basePrice: true } },
    },
  });
}

export async function createBxGy(tenantId: string, body: any) {
  return prisma.buyXGetYDeal.create({
    data: {
      tenantId,
      name: body.name,
      buyItemId: body.buyItemId,
      buyQty: body.buyQty,
      getItemId: body.getItemId,
      getQty: body.getQty,
      isActive: body.isActive,
      startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
      endsAt: body.endsAt ? new Date(body.endsAt) : undefined,
    },
  });
}

export async function validateDeals(tenantId: string, body: { items: any[]; promoCode?: string }) {
  const now = new Date();
  const cartTotal = body.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const cartQty = new Map(body.items.map((i) => [i.itemId, i.quantity]));
  const unitPriceMap = new Map(body.items.map((i) => [i.itemId, i.unitPrice]));

  let comboDiscount = 0, bxgyDiscount = 0, promoDiscount = 0;
  const applied: Array<{ type: string; id?: string; code?: string; amount: number; meta?: any }> = [];

  const combos = await prisma.combo.findMany({ where: { tenantId, isActive: true }, include: { items: true } });
  for (const combo of combos) {
    const times = combo.items.reduce((min, line) => Math.min(min, Math.floor((cartQty.get(line.itemId) ?? 0) / line.quantity)), Number.POSITIVE_INFINITY);
    if (!Number.isFinite(times) || times <= 0) continue;
    const itemIds = combo.items.map((i) => i.itemId);
    const items = await prisma.item.findMany({ where: { id: { in: itemIds } }, select: { id: true, basePrice: true } });
    const priceMap = new Map(items.map((i) => [i.id, i.basePrice]));
    const normal = combo.items.reduce((sum, line) => sum + (priceMap.get(line.itemId) ?? 0) * line.quantity, 0);
    const discountPer = Math.max(0, normal - combo.price);
    if (discountPer > 0) {
      const amount = discountPer * times;
      comboDiscount += amount;
      applied.push({ type: 'COMBO', id: combo.id, amount, meta: { times } });
    }
  }

  const deals = await prisma.buyXGetYDeal.findMany({ where: { tenantId, isActive: true } });
  for (const d of deals) {
    if (!isWithinWindow(now, d.startsAt, d.endsAt)) continue;
    const buyHave = cartQty.get(d.buyItemId) ?? 0;
    const getHave = cartQty.get(d.getItemId) ?? 0;
    if (buyHave < d.buyQty || getHave <= 0) continue;
    const bundles = Math.min(Math.floor(buyHave / d.buyQty), Math.floor(getHave / d.getQty));
    if (bundles <= 0) continue;
    const price = unitPriceMap.get(d.getItemId) ?? 0;
    const amount = bundles * d.getQty * price;
    bxgyDiscount += amount;
    applied.push({ type: 'BXGY', id: d.id, amount, meta: { bundles } });
  }

  if (body.promoCode) {
    const code = body.promoCode.trim().toUpperCase();
    const promo = await prisma.promoCode.findFirst({ where: { tenantId, code, isActive: true } });
    if (promo && isWithinWindow(now, promo.startsAt, promo.endsAt)) {
      if (!promo.usageLimit || promo.usedCount < promo.usageLimit) {
        if (!promo.minOrder || cartTotal >= promo.minOrder) {
          const base = Math.max(0, cartTotal - comboDiscount - bxgyDiscount);
          promoDiscount = promo.type === 'FIXED'
            ? Math.min(promo.value, base)
            : promo.maxDiscount
              ? Math.min(base * (promo.value / 100), promo.maxDiscount)
              : base * (promo.value / 100);
          if (promoDiscount > 0) applied.push({ type: 'PROMO', id: promo.id, code: promo.code, amount: promoDiscount });
        }
      }
    }
  }

  const totalDiscount = comboDiscount + bxgyDiscount + promoDiscount;
  return { cartTotal, discounts: { comboDiscount, bxgyDiscount, promoDiscount, totalDiscount }, net: Math.max(0, cartTotal - totalDiscount), applied };
}

// -----------------------------------------------------------------------------
// UNIFIED DEALS API
// -----------------------------------------------------------------------------

export async function listUnifiedDeals(tenantId: string, query: { branchId?: string, status?: string, type?: string } = {}) {
  const where: any = { tenantId, deletedAt: null };
  if (query.branchId) {
    where.OR = [
      { branchIds: { isEmpty: true } },
      { branchIds: { has: query.branchId } }
    ];
  }
  if (query.status) {
    where.isActive = query.status === 'ACTIVE';
  }
  if (query.type) {
    where.type = query.type;
  }

  return prisma.deal.findMany({
    where,
    orderBy: { createdAt: 'desc' }
  });
}

export async function getUnifiedDeal(tenantId: string, dealId: string) {
  return prisma.deal.findFirstOrThrow({
    where: { id: dealId, tenantId, deletedAt: null }
  });
}

export async function createUnifiedDeal(tenantId: string, body: any) {
  // Validations
  if (body.validFrom && body.validUntil && new Date(body.validFrom) >= new Date(body.validUntil)) {
    throw new Error('Valid From must be before Valid Until');
  }
  if (body.minOrderValue && body.minOrderValue < 0) {
    throw new Error('Minimum order value cannot be negative');
  }
  if (body.type === 'PERCENTAGE_DISCOUNT' && body.config?.percent > 100) {
    throw new Error('Percentage discount cannot exceed 100%');
  }
  if (body.type === 'BUY_X_GET_Y' && (body.config?.buyQty < 1 || body.config?.getQty < 1)) {
    throw new Error('Buy X Get Y quantities must be at least 1');
  }

  return prisma.deal.create({
    data: {
      tenantId,
      name: body.name,
      description: body.description,
      type: body.type,
      config: body.config,
      minOrderValue: body.minOrderValue,
      maxUsesTotal: body.maxUsesTotal,
      maxUsesPerCustomer: body.maxUsesPerCustomer,
      validFrom: body.validFrom ? new Date(body.validFrom) : null,
      validUntil: body.validUntil ? new Date(body.validUntil) : null,
      validTimeStart: body.validTimeStart,
      validTimeEnd: body.validTimeEnd,
      validDaysOfWeek: body.validDaysOfWeek || [],
      orderTypeRestriction: body.orderTypeRestriction || [],
      branchIds: body.branchIds || [],
      autoApply: body.autoApply,
      requiresManagerApproval: body.requiresManagerApproval,
      showNameOnReceipt: body.showNameOnReceipt,
      allowStacking: body.allowStacking,
      requiresPromoCode: body.requiresPromoCode,
      promoCode: body.promoCode ? body.promoCode.trim() : null,
      promoCodeCaseSensitive: body.promoCodeCaseSensitive,
      isActive: body.isActive,
    }
  });
}

export async function updateUnifiedDeal(tenantId: string, dealId: string, body: any) {
  const existing = await prisma.deal.findFirst({ where: { id: dealId, tenantId, deletedAt: null } });
  if (!existing) throw new Error("Deal not found or unauthorized");

  const data: any = { ...body };
  if (data.validFrom !== undefined) data.validFrom = data.validFrom ? new Date(data.validFrom) : null;
  if (data.validUntil !== undefined) data.validUntil = data.validUntil ? new Date(data.validUntil) : null;
  if (data.promoCode !== undefined) data.promoCode = data.promoCode ? data.promoCode.trim() : null;

  if (existing.usedCount > 0) {
    // If deal has been redeemed, strictly restrict updatable fields
    const allowedFields = ['name', 'description', 'isActive', 'validFrom', 'validUntil', 'validTimeStart', 'validTimeEnd'];
    for (const key of Object.keys(data)) {
      if (!allowedFields.includes(key)) {
        delete data[key];
      }
    }
  } else {
    // Validation for untouched deals
    if (data.validFrom && data.validUntil && new Date(data.validFrom) >= new Date(data.validUntil)) {
      throw new Error('Valid From must be before Valid Until');
    }
    if (data.type === 'PERCENTAGE_DISCOUNT' && data.config?.percent > 100) {
      throw new Error('Percentage discount cannot exceed 100%');
    }
  }

  const result = await prisma.deal.updateMany({
    where: { id: dealId, tenantId, deletedAt: null },
    data
  });
  
  return prisma.deal.findFirst({ where: { id: dealId } });
}

export async function toggleUnifiedDeal(tenantId: string, dealId: string) {
  const deal = await prisma.deal.findFirst({ where: { id: dealId, tenantId, deletedAt: null } });
  if (!deal) throw new Error("Deal not found");
  
  await prisma.deal.update({
    where: { id: dealId },
    data: { isActive: !deal.isActive }
  });
  return { success: true, isActive: !deal.isActive };
}

export async function deleteUnifiedDeal(tenantId: string, dealId: string) {
  const result = await prisma.deal.updateMany({
    where: { id: dealId, tenantId, deletedAt: null },
    data: { deletedAt: new Date() }
  });
  
  if (result.count === 0) throw new Error("Deal not found or unauthorized");
  return true;
}

// -----------------------------------------------------------------------------
// POS DEAL EVALUATION
// -----------------------------------------------------------------------------

function isDealEligible(deal: any, cartTotal: number, orderType: string, branchId: string, promoCode?: string) {
  if (!deal.isActive) return false;
  
  // Time and Date constraints
  const now = new Date();
  if (deal.validFrom && now < deal.validFrom) return false;
  if (deal.validUntil && now > deal.validUntil) return false;
  
  // Usage limit constraints
  if (deal.maxUsesTotal !== null && deal.usedCount >= deal.maxUsesTotal) return false;
  
  // Order limits
  if (deal.minOrderValue !== null && cartTotal < deal.minOrderValue) return false;
  
  // Branch restriction
  if (deal.branchIds && deal.branchIds.length > 0 && !deal.branchIds.includes(branchId)) return false;
  
  // Order type restriction
  if (deal.orderTypeRestriction && deal.orderTypeRestriction.length > 0 && !deal.orderTypeRestriction.includes(orderType)) return false;
  
  // Days of week
  if (deal.validDaysOfWeek && deal.validDaysOfWeek.length > 0) {
    const day = now.getDay() === 0 ? 7 : now.getDay(); // 1=Mon, 7=Sun
    if (!deal.validDaysOfWeek.includes(day)) return false;
  }
  
  // Time of day (Happy Hour)
  if (deal.validTimeStart && deal.validTimeEnd) {
    const currentStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Karachi' });
    if (currentStr < deal.validTimeStart || currentStr > deal.validTimeEnd) return false;
  }

  // Promo code
  if (deal.requiresPromoCode) {
    if (!promoCode) return false;
    const expected = deal.promoCodeCaseSensitive ? deal.promoCode : deal.promoCode?.toUpperCase();
    const provided = deal.promoCodeCaseSensitive ? promoCode : promoCode.toUpperCase();
    if (expected !== provided) return false;
  }

  return true;
}

export async function evaluateEligibleDeals(tenantId: string, branchId: string, orderTotal: number, orderType: string, items: any[], timeStr?: string) {
  const now = timeStr ? new Date(timeStr) : new Date();

  const deals = await prisma.deal.findMany({
    where: {
      tenantId,
      isActive: true,
      deletedAt: null,
      OR: [{ branchIds: { isEmpty: true } }, { branchIds: { has: branchId } }],
      AND: [
        { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
        { OR: [{ validUntil: null }, { validUntil: { gte: now } }] },
      ],
      requiresPromoCode: false,
    }
  });

  const eligible = deals.filter(deal => {
    if (deal.minOrderValue !== null && orderTotal < deal.minOrderValue) return false;
    if (deal.orderTypeRestriction && deal.orderTypeRestriction.length > 0 && !deal.orderTypeRestriction.includes(orderType)) return false;
    if (deal.maxUsesTotal !== null && deal.usedCount >= deal.maxUsesTotal) return false;
    if (deal.validDaysOfWeek && deal.validDaysOfWeek.length > 0) {
      const day = now.getDay() === 0 ? 7 : now.getDay();
      if (!deal.validDaysOfWeek.includes(day)) return false;
    }
    if (deal.validTimeStart && deal.validTimeEnd) {
      const currentStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Karachi' });
      if (currentStr < deal.validTimeStart || currentStr > deal.validTimeEnd) return false;
    }
    return true;
  });

  return eligible;
}

export async function validatePromoCodeUnified(tenantId: string, branchId: string, orderTotal: number, orderType: string, items: any[], promoCode: string, timeStr?: string) {
  const now = timeStr ? new Date(timeStr) : new Date();
  
  const deals = await prisma.deal.findMany({
    where: { 
      tenantId, 
      isActive: true,
      deletedAt: null,
      requiresPromoCode: true,
      OR: [{ branchIds: { isEmpty: true } }, { branchIds: { has: branchId } }],
      AND: [
        { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
        { OR: [{ validUntil: null }, { validUntil: { gte: now } }] },
      ],
    }
  });

  const eligible = deals.find(deal => {
    if (!deal.promoCode) return false;
    const expected = deal.promoCodeCaseSensitive ? deal.promoCode : deal.promoCode.toUpperCase();
    const provided = deal.promoCodeCaseSensitive ? promoCode : promoCode.toUpperCase();
    if (expected !== provided) return false;

    if (deal.minOrderValue !== null && orderTotal < deal.minOrderValue) return false;
    if (deal.orderTypeRestriction && deal.orderTypeRestriction.length > 0 && !deal.orderTypeRestriction.includes(orderType)) return false;
    if (deal.maxUsesTotal !== null && deal.usedCount >= deal.maxUsesTotal) return false;
    if (deal.validDaysOfWeek && deal.validDaysOfWeek.length > 0) {
      const day = now.getDay() === 0 ? 7 : now.getDay();
      if (!deal.validDaysOfWeek.includes(day)) return false;
    }
    if (deal.validTimeStart && deal.validTimeEnd) {
      const currentStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Karachi' });
      if (currentStr < deal.validTimeStart || currentStr > deal.validTimeEnd) return false;
    }
    return true;
  });

  if (!eligible) {
    throw new Error('Invalid, expired, or inapplicable promo code');
  }
  return eligible;
}

