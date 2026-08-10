import { prisma } from '@swiftserve/db';
import { CreateBranchInput, UpdateBranchInput } from '@swiftserve/schemas';
import crypto from 'crypto';
import { startOfDay, endOfDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const BRANCH_COLORS = [
  '#FF5722', '#3B82F6', '#10B981', '#8B5CF6', 
  '#F59E0B', '#EC4899', '#14B8A6', '#F43F5E'
];

export async function listBranches(tenantId: string) {
  const branches = await prisma.branch.findMany({
    where: { tenantId, deletedAt: null },
    orderBy: { createdAt: 'asc' }
  });

  const nowUTC = new Date();

  const branchesWithStats = await Promise.all(
    branches.map(async (branch) => {
      // Midnight today in branch timezone
      let tz = branch.timezone || 'Asia/Karachi';
      let zonedNow = toZonedTime(nowUTC, tz);
      
      // If the frontend sent an invalid timezone (e.g. "(GMT+05:00) Karachi"), fallback to default
      if (isNaN(zonedNow.getTime())) {
        tz = 'Asia/Karachi';
        zonedNow = toZonedTime(nowUTC, tz);
      }
      
      const startOfTodayZoned = startOfDay(zonedNow);
      const endOfTodayZoned = endOfDay(zonedNow);

      const [revenueResult, orderCount, activeOrdersCount] = await Promise.all([
        prisma.order.aggregate({
          where: {
            branchId: branch.id,
            status: 'COMPLETED',
            createdAt: {
              gte: startOfTodayZoned,
              lte: endOfTodayZoned
            }
          },
          _sum: { netAmount: true }
        }),
        prisma.order.count({
          where: {
            branchId: branch.id,
            status: { not: 'CANCELLED' },
            createdAt: {
              gte: startOfTodayZoned,
              lte: endOfTodayZoned
            }
          }
        }),
        prisma.order.count({
          where: {
            branchId: branch.id,
            status: { in: ['PENDING', 'IN_KITCHEN', 'READY'] }
          }
        })
      ]);

      let isCurrentlyOpen = false;
      if (branch.openingTime && branch.closingTime) {
        // Simple string comparison for times like "09:00" and "23:00"
        const currentHourMin = `${zonedNow.getHours().toString().padStart(2, '0')}:${zonedNow.getMinutes().toString().padStart(2, '0')}`;
        if (branch.openingTime <= branch.closingTime) {
          isCurrentlyOpen = currentHourMin >= branch.openingTime && currentHourMin <= branch.closingTime;
        } else {
          // Crosses midnight, e.g. 18:00 to 02:00
          isCurrentlyOpen = currentHourMin >= branch.openingTime || currentHourMin <= branch.closingTime;
        }
      }

      return {
        ...branch,
        stats: {
          todayRevenue: revenueResult._sum.netAmount || 0,
          todayOrders: orderCount,
          activeOrders: activeOrdersCount,
          isCurrentlyOpen
        }
      };
    })
  );

  const activeCount = branches.filter(b => b.isActive).length;
  
  // Calculate primary city
  const cityCounts = branches.reduce((acc, b) => {
    if (b.city) {
      acc[b.city] = (acc[b.city] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);
  
  let primaryCity = 'N/A';
  let maxCityCount = 0;
  for (const [city, count] of Object.entries(cityCounts)) {
    if (count > maxCityCount) {
      maxCityCount = count;
      primaryCity = city;
    }
  }

  const primaryCountry = branches[0]?.country || 'Pakistan';
  const displayCity = primaryCity !== 'N/A' ? `${primaryCity.toUpperCase()}, ${primaryCountry.toUpperCase()}` : 'No Branches Yet';

  return {
    branches: branchesWithStats,
    summary: {
      total: branches.length,
      active: activeCount,
      inactive: branches.length - activeCount,
      primaryCity: displayCity
    }
  };
}

export async function checkPlanLimit(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new Error("Tenant not found");

  const PLAN_LIMITS: Record<string, { maxBranches: number }> = {
    'STARTER': { maxBranches: 1 },
    'PRO': { maxBranches: 3 },
    'ENTERPRISE': { maxBranches: 999 }
  };

  const limit = PLAN_LIMITS[tenant.plan]?.maxBranches || 1;
  const existingCount = await prisma.branch.count({ where: { tenantId, deletedAt: null } });

  if (existingCount >= limit) {
    throw {
      isLimitError: true,
      error: 'PLAN_LIMIT_REACHED',
      message: `Your plan allows ${limit} branches. Upgrade to add more.`,
      currentCount: existingCount,
      limit
    };
  }
  return { existingCount, tenant };
}

export async function createBranch(tenantId: string, data: CreateBranchInput) {
  const { existingCount } = await checkPlanLimit(tenantId);

  const colorIndex = existingCount % BRANCH_COLORS.length;
  const colorHex = BRANCH_COLORS[colorIndex];
  const initial = data.name.trim()[0].toUpperCase();
  const cityCode = data.city ? data.city.substring(0, 3).toUpperCase() : 'BRN';
  const randomStr = crypto.randomBytes(3).toString('hex').toUpperCase();
  const branchCode = `SS-${cityCode}-${randomStr}`;

  const branch = await prisma.branch.create({
    data: {
      ...data,
      tenantId,
      colorHex,
      initial,
      branchCode
    }
  });

  return branch;
}

export async function updateBranch(tenantId: string, branchId: string, data: UpdateBranchInput) {
  const branch = await prisma.branch.update({
    where: { id: branchId, tenantId },
    data
  });
  return branch;
}

export async function toggleBranchStatus(tenantId: string, branchId: string) {
  const branch = await prisma.branch.findUnique({ where: { id: branchId, tenantId } });
  if (!branch) throw new Error("Branch not found");

  const updated = await prisma.branch.update({
    where: { id: branchId },
    data: { isActive: !branch.isActive }
  });
  return { isActive: updated.isActive };
}

export async function deleteBranch(tenantId: string, branchId: string) {
  // Check active orders
  const activeOrdersCount = await prisma.order.count({
    where: {
      branchId,
      status: { in: ['PENDING', 'IN_KITCHEN', 'READY'] }
    }
  });

  if (activeOrdersCount > 0) {
    throw {
      isConflict: true,
      message: "Cannot delete branch with active orders. Complete or cancel all orders first."
    };
  }

  await prisma.branch.update({
    where: { id: branchId, tenantId },
    data: { 
      deletedAt: new Date(),
      isActive: false
    }
  });

  return { success: true };
}
