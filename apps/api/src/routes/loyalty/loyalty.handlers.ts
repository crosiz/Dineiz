import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@swiftserve/db';

export const getSettingsHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  const tenantId = (req.user as any).tenantId;

  let settings = await prisma.loyaltySettings.findUnique({
    where: { tenantId }
  });

  if (!settings) {
    settings = await prisma.loyaltySettings.create({
      data: { tenantId, allowedOrderTypes: ['DINE_IN', 'TAKEAWAY', 'DELIVERY'] }
    });
  }

  const multipliers = await prisma.loyaltyCategoryMultiplier.findMany({
    where: { tenantId }
  });

  return { settings, multipliers };
};

export const updateSettingsHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  const tenantId = (req.user as any).tenantId;
  const data = req.body as any;

  const settings = await prisma.loyaltySettings.upsert({
    where: { tenantId },
    create: { ...data, tenantId },
    update: { ...data }
  });

  return { success: true, settings };
};

export const listTiersHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  const tenantId = (req.user as any).tenantId;

  const tiers = await prisma.loyaltyTier.findMany({
    where: { tenantId },
    orderBy: { minPoints: 'asc' }
  });

  return tiers;
};

export const createTierHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  const tenantId = (req.user as any).tenantId;
  const data = req.body as any;

  const tier = await prisma.loyaltyTier.create({
    data: { ...data, tenantId }
  });

  return tier;
};

export const updateTierHandler = async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
  const tenantId = (req.user as any).tenantId;
  const data = req.body as any;
  const { id } = req.params;

  const tier = await prisma.loyaltyTier.update({
    where: { id, tenantId },
    data
  });

  return tier;
};

export const deleteTierHandler = async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
  const tenantId = (req.user as any).tenantId;
  const { id } = req.params;

  await prisma.loyaltyTier.delete({
    where: { id, tenantId }
  });

  return { success: true };
};

export const listCampaignsHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  const tenantId = (req.user as any).tenantId;

  const campaigns = await prisma.loyaltyCampaign.findMany({
    where: { tenantId },
    orderBy: { validFrom: 'desc' }
  });

  return campaigns;
};

export const createCampaignHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  const tenantId = (req.user as any).tenantId;
  const data = req.body as any;

  const campaign = await prisma.loyaltyCampaign.create({
    data: { ...data, tenantId }
  });

  return campaign;
};

export const updateCampaignHandler = async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
  const tenantId = (req.user as any).tenantId;
  const data = req.body as any;
  const { id } = req.params;

  const campaign = await prisma.loyaltyCampaign.update({
    where: { id, tenantId },
    data
  });

  return campaign;
};

export const deleteCampaignHandler = async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
  const tenantId = (req.user as any).tenantId;
  const { id } = req.params;

  await prisma.loyaltyCampaign.delete({
    where: { id, tenantId }
  });

  return { success: true };
};

export const getDashboardMetricsHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  const tenantId = (req.user as any).tenantId;

  const activeMembers = await prisma.customer.count({
    where: { tenantId, loyaltyPoints: { gt: 0 } }
  });

  const aggregatePoints = await prisma.customer.aggregate({
    where: { tenantId },
    _sum: { loyaltyPoints: true }
  });

  const totalPoints = aggregatePoints._sum.loyaltyPoints || 0;

  const avgPointsPerMember = activeMembers > 0 ? totalPoints / activeMembers : 0;

  // Get members by tier
  const membersByTier = await prisma.customer.groupBy({
    by: ['currentTierId'],
    where: { tenantId, currentTierId: { not: null } },
    _count: true
  });

  const topCustomers = await prisma.customer.findMany({
    where: { tenantId },
    orderBy: { loyaltyPoints: 'desc' },
    take: 10,
    select: { id: true, name: true, phone: true, loyaltyPoints: true, currentTier: true }
  });

  return {
    activeMembers,
    totalPoints,
    avgPointsPerMember,
    membersByTier,
    topCustomers
  };
};
