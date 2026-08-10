import { prisma } from '@dineiz/db';
import { CreateStaff, StaffQuery, UpdateStaff, ResetPin } from './staff.schema';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

export class StaffService {
  static async getSummary(tenantId: string, branchId?: string) {
    const whereClause: any = {
      tenantId,
      role: { notIn: ['TENANT_ADMIN'] }, // owner is never in staff stats
    };
    if (branchId) whereClause.branchId = branchId;

    const users = await prisma.user.findMany({
      where: whereClause
    });

    const total = users.length;
    const activeNow = users.filter(u => {
      if (!u.lastActiveAt) return false;
      return (new Date().getTime() - new Date(u.lastActiveAt).getTime()) < 15 * 60 * 1000;
    }).length;
    const managers = users.filter(u => u.role === 'BRANCH_MANAGER').length;
    const pendingInvites = users.filter(u => u.status === 'PENDING').length;

    return { total, activeNow, managers, pendingInvites };
  }

  static async getStaffList(tenantId: string, query: StaffQuery) {
    const { branchId, role, status, search, page, limit, hasOrders } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId,
      role: { notIn: ['TENANT_ADMIN'] }, // owner never appears in staff list
    };
    if (branchId) where.branchId = branchId;
    // If role filter is applied, handle pseudo-filters
    if (role && role !== 'All Roles') {
      if (role === 'POS') {
        where.role = { in: ['CASHIER', 'WAITER', 'KITCHEN_STAFF', 'RIDER', 'BRANCH_MANAGER'] };
      } else if (role === 'ATTENDANCE') {
        where.role = { in: ['WORKER', 'COOK', 'GUARD'] };
      } else {
        where.role = role;
      }
    }
    if (status && status !== 'All Status') where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (hasOrders) {
      const distinctUsers = await prisma.shift.findMany({
        where: { tenantId, ...(branchId && { branchId }), orders: { some: { tenantId } } },
        select: { userId: true },
        distinct: ['userId']
      });
      const userIds = distinctUsers.map(s => s.userId);
      where.id = { in: userIds };
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        include: { 
          branch: true,
          StaffZktecoEnrollment: true,
          AttendancePunch: {
            where: {
              punchTime: {
                gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    const staff = users.map(u => {
      const uniqueDays = new Set(u.AttendancePunch.map(p => new Date(p.punchTime).toISOString().split('T')[0]));
      
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        branch: u.branch ? { id: u.branch.id, name: u.branch.name, branchCode: u.branch.branchCode } : null,
        status: u.status,
        lastActiveAt: u.lastActiveAt ? u.lastActiveAt.toISOString() : null,
        avatarInitials: u.name.substring(0, 2).toUpperCase(),
        avatarColor: u.avatarColor || '#94A3B8', // Default slate-400
        hasPin: !!u.posPin,
        zktecoEnrollment: !!u.StaffZktecoEnrollment,
        attendanceDaysThisMonth: uniqueDays.size
      };
    });

    return {
      staff,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  static async createStaff(tenantId: string, data: CreateStaff) {
    // Check email uniqueness across tenant
    const existing = await prisma.user.findUnique({
      where: { email: data.email }
    });
    if (existing) {
      throw new Error('This email is already registered');
    }

    const avatarColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');

    // If it's a manager, create with auth password logic
    // Currently relying on basic user creation
    // To handle passwords, we would integrate with the local auth provider mechanism
    // But for this exercise, we will just create the user directly. Better Auth / NextAuth handles passwords separately in Accounts table typically
    // We'll stub this based on the existing DB schema. `User` doesn't have a `password` field in `schema.prisma`. 
    // Usually BetterAuth uses `Account` or a credential table. 
    // We will just create the User record.

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        role: data.role as any,
        tenantId,
        branchId: data.branchId,
        posPin: data.posPin, // Already hashed in handler
        status: 'ACTIVE',
        avatarColor,
      }
    });

    return user;
  }

  static async updateStaff(tenantId: string, id: string, data: UpdateStaff) {
    const user = await prisma.user.findFirst({ where: { id, tenantId } });
    if (!user) throw new Error('Staff member not found');

    return prisma.user.update({
      where: { id },
      data: {
        name: data.name,
        phone: data.phone,
        branchId: data.branchId,
      }
    });
  }

  static async toggleStatus(tenantId: string, id: string) {
    const user = await prisma.user.findFirst({ where: { id, tenantId } });
    if (!user) throw new Error('Staff member not found');

    const newStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    
    return prisma.user.update({
      where: { id },
      data: { status: newStatus }
    });
  }

  static async resetPin(tenantId: string, id: string, hashedPin: string) {
    const user = await prisma.user.findFirst({ where: { id, tenantId } });
    if (!user) throw new Error('Staff member not found');

    return prisma.user.update({
      where: { id },
      data: { posPin: hashedPin }
    });
  }

  static async deleteStaff(tenantId: string, id: string) {
    const user = await prisma.user.findFirst({ where: { id, tenantId } });
    if (!user) throw new Error('Staff member not found');

    // Soft-delete: mark as INACTIVE and clear PIN so they can't log in.
    // Hard delete fails due to related Sessions/Accounts/Shifts that don't all cascade.
    await prisma.user.update({
      where: { id },
      data: {
        status: 'INACTIVE' as any,
        posPin: null,
        email: `deleted_${id}@dineiz.invalid`, // prevent email reuse conflicts
      }
    });
    return { success: true };
  }
}
