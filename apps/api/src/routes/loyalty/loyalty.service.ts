import { prisma } from '@dineiz/db';

export async function redeemLoyaltyForOrder(order: any, redeemedPointsAmount: number) {
  if (!order.customerId || !redeemedPointsAmount || redeemedPointsAmount <= 0) return;

  const tenantId = order.tenantId;

  const settings = await prisma.loyaltySettings.findUnique({
    where: { tenantId }
  });

  if (!settings || !settings.isActive) return;

  const customer = await prisma.customer.findUnique({
    where: { id: order.customerId }
  });

  if (!customer) return;

  if (redeemedPointsAmount >= settings.minPointsToRedeem && customer.loyaltyPoints >= redeemedPointsAmount) {
    await prisma.loyaltyPointLedger.create({
      data: {
        tenantId,
        customerId: customer.id,
        type: 'REDEEM',
        points: -redeemedPointsAmount,
        reference: order.id,
        note: `Redeemed on order ${order.orderNumber}`
      }
    });
    await prisma.customer.update({
      where: { id: customer.id },
      data: { loyaltyPoints: { decrement: redeemedPointsAmount } }
    });
  }
}

export async function earnLoyaltyForOrder(order: any) {
  if (!order.customerId) return;

  const tenantId = order.tenantId;

  const settings = await prisma.loyaltySettings.findUnique({
    where: { tenantId }
  });

  if (!settings || !settings.isActive) return;
  if (!settings.allowedOrderTypes.includes(order.orderType || order.type)) return;

  // Branch isolation
  if (settings.isolateBranches) {
    // If we have complex branch isolation logic, we handle here
  }

  const customer = await prisma.customer.findUnique({
    where: { id: order.customerId },
    include: { currentTier: true }
  });

  if (!customer) return;

  // Process Earning
  if (order.netAmount >= settings.minOrderValue) {
    let earnedPoints = 0;

    // 1. Base Earn Rate
    // e.g. 1 point per 10 PKR
    earnedPoints += (order.netAmount / settings.baseEarnRateSpend) * settings.baseEarnRatePoints;

    // 2. Category Multipliers (needs order items)
    const items = await prisma.orderItem.findMany({
      where: { orderId: order.id },
      include: { item: { include: { category: true } } }
    });

    const multipliers = await prisma.loyaltyCategoryMultiplier.findMany({
      where: { tenantId }
    });
    const multiplierMap = new Map(multipliers.map(m => [m.categoryId, m.multiplier]));

    let categoryBonus = 0;
    for (const oi of items) {
      if (oi.item?.categoryId) {
        const mul = multiplierMap.get(oi.item.categoryId);
        if (mul && mul > 1) {
          const itemVal = oi.price * oi.quantity;
          const baseItemPoints = (itemVal / settings.baseEarnRateSpend) * settings.baseEarnRatePoints;
          categoryBonus += baseItemPoints * (mul - 1); // Only add the extra
        }
      }
    }
    earnedPoints += categoryBonus;

    // 3. Campaigns (e.g. active campaigns on Date)
    const activeCampaigns = await prisma.loyaltyCampaign.findMany({
      where: {
        tenantId,
        isActive: true,
        OR: [
          { validFrom: null, validTo: null },
          { validFrom: { lte: new Date() }, validTo: { gte: new Date() } }
        ]
      }
    });

    for (const camp of activeCampaigns) {
      if (camp.type === 'MULTIPLIER') {
        earnedPoints *= camp.value;
      } else if (camp.type === 'BONUS') {
        earnedPoints += camp.value;
      }
      await prisma.loyaltyCampaign.update({
        where: { id: camp.id },
        data: { usageCount: { increment: 1 } }
      });
    }

    // 4. Tier Multiplier
    if (customer.currentTier && customer.currentTier.multiplier > 1) {
      earnedPoints *= customer.currentTier.multiplier;
    }

    earnedPoints = Math.floor(earnedPoints); // Round down to nearest whole point

    if (earnedPoints > 0) {
      let expiresAt: Date | undefined;
      if (settings.expiryType === 'MONTHS' && settings.expiryMonths) {
        expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + settings.expiryMonths);
      } else if (settings.expiryType === 'FIXED_DATE' && settings.expiryFixedDate) {
        expiresAt = settings.expiryFixedDate;
      }

      await prisma.loyaltyPointLedger.create({
        data: {
          tenantId,
          customerId: customer.id,
          type: 'EARN',
          points: earnedPoints,
          reference: order.id,
          expiresAt,
          note: `Earned on order ${order.orderNumber}`
        }
      });

      const updatedCustomer = await prisma.customer.update({
        where: { id: customer.id },
        data: { loyaltyPoints: { increment: earnedPoints } }
      });

      // Check Tier Upgrade
      const tiers = await prisma.loyaltyTier.findMany({
        where: { tenantId },
        orderBy: { minPoints: 'desc' }
      });

      let nextTier = null;
      for (const t of tiers) {
        if (updatedCustomer.loyaltyPoints >= t.minPoints) {
          nextTier = t;
          break;
        }
      }

      if (nextTier && nextTier.id !== customer.currentTierId) {
        await prisma.customer.update({
          where: { id: customer.id },
          data: { currentTierId: nextTier.id }
        });
        // Flag for congratulations whatsapp message
      }
    }
  }
}
