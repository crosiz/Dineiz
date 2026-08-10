import { prisma } from '@swiftserve/db';
import { Prisma } from '@swiftserve/db';

export class CustomersService {
  static normalizePhone(phone: string) {
    let cleaned = phone.replace(/[\s-]/g, '');
    if (cleaned.startsWith('03')) {
      cleaned = '+923' + cleaned.slice(2);
    }
    return cleaned;
  }
  static async listCustomers(tenantId: string, query: any) {
    const { page, limit, search, segment, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.CustomerWhereInput = {
      tenantId,
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (segment) {
      where.segment = segment === 'ALL' ? undefined : segment;
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.customer.count({ where }),
    ]);

    // Compute active/new/avg LTV stats
    const [totalCustomers, activeCustomers, newCustomers, aggStats] = await Promise.all([
      prisma.customer.count({ where: { tenantId, deletedAt: null } }),
      prisma.customer.count({
        where: { tenantId, deletedAt: null, lastVisitAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      }),
      prisma.customer.count({
        where: { tenantId, deletedAt: null, createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      }),
      prisma.customer.aggregate({
        where: { tenantId, deletedAt: null },
        _avg: { totalSpend: true },
      }),
    ]);

    return {
      data: customers,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        totalCustomers,
        activeCustomers,
        newCustomers,
        avgLtv: aggStats._avg.totalSpend || 0,
      }
    };
  }

  static async getCustomerById(tenantId: string, customerId: string) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId, tenantId },
      include: {
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { items: { include: { item: true } } }
        },
        staffNotes: {
          orderBy: { createdAt: 'desc' }
        },
        points: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      },
    });

    if (!customer || customer.deletedAt) return null;
    return customer;
  }

  static async lookupCustomerByPhone(tenantId: string, phone: string) {
    const normalizedPhone = this.normalizePhone(phone);
    const customer = await prisma.customer.findUnique({
      where: { tenantId_phone: { tenantId, phone: normalizedPhone } },
      select: {
        id: true,
        name: true,
        loyaltyPoints: true,
        segment: true,
        lastVisitAt: true,
        deletedAt: true,
        _count: { select: { orders: true } }
      }
    });
    
    if (customer?.deletedAt) return null;
    return customer;
  }

  static async createCustomer(tenantId: string, data: any) {
    return prisma.customer.create({
      data: {
        ...data,
        tenantId,
      },
    });
  }

  static async updateCustomer(tenantId: string, customerId: string, data: any) {
    return prisma.customer.update({
      where: { id: customerId, tenantId },
      data,
    });
  }

  static async deleteCustomer(tenantId: string, customerId: string) {
    // Soft delete
    return prisma.customer.update({
      where: { id: customerId, tenantId },
      data: { 
        deletedAt: new Date(),
        name: 'DELETED_USER',
        phone: null,
        email: null,
        notes: null
      },
    });
  }

  static async addNote(tenantId: string, customerId: string, staffName: string, noteText: string) {
    return prisma.customerNote.create({
      data: {
        tenantId,
        customerId,
        staffName,
        noteText,
      }
    });
  }

  static async getCustomerOrders(tenantId: string, customerId: string, query: any) {
    const { page, limit } = query;
    const skip = (page - 1) * limit;
    
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { tenantId, customerId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { items: { include: { item: true } } }
      }),
      prisma.order.count({ where: { tenantId, customerId } })
    ]);
    
    return {
      data: orders,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
    };
  }

  static async getCustomerLoyalty(tenantId: string, customerId: string, query: any) {
    const { page, limit } = query;
    const skip = (page - 1) * limit;
    
    const [ledger, total] = await Promise.all([
      prisma.loyaltyPointLedger.findMany({
        where: { tenantId, customerId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.loyaltyPointLedger.count({ where: { tenantId, customerId } })
    ]);
    
    return {
      data: ledger,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
    };
  }

  static async adjustPoints(tenantId: string, customerId: string, userId: string, data: { points: number, reason: string }) {
    return prisma.$transaction(async (tx) => {
      const ledger = await tx.loyaltyPointLedger.create({
        data: {
          tenantId,
          customerId,
          type: data.points > 0 ? 'ADJUST_ADD' : 'ADJUST_DEDUCT',
          points: data.points,
          note: data.reason,
          reference: `manual_${userId}`
        }
      });
      
      const customer = await tx.customer.update({
        where: { id: customerId, tenantId },
        data: { loyaltyPoints: { increment: data.points } }
      });
      
      return { ledger, customer };
    });
  }

  static async importCustomers(tenantId: string, branchId: string, customers: any[]) {
    const results = { created: 0, updated: 0, errors: [] as any[] };
    
    for (const c of customers) {
      try {
        const phone = c.phone ? this.normalizePhone(c.phone) : null;
        if (!phone) {
          results.errors.push({ customer: c, error: 'Phone number is required for deduplication' });
          continue;
        }
        
        await prisma.customer.upsert({
          where: { tenantId_phone: { tenantId, phone } },
          update: {
            name: c.name,
            email: c.email || undefined,
            totalSpend: c.totalSpend !== undefined ? { increment: c.totalSpend } : undefined,
            totalOrders: c.totalOrders !== undefined ? { increment: c.totalOrders } : undefined,
            loyaltyPoints: c.loyaltyPoints !== undefined ? { increment: c.loyaltyPoints } : undefined,
          },
          create: {
            tenantId,
            name: c.name,
            phone,
            email: c.email || undefined,
            totalSpend: c.totalSpend || 0,
            totalOrders: c.totalOrders || 0,
            loyaltyPoints: c.loyaltyPoints || 0,
          }
        });
        // We cannot accurately count created vs updated without checking first, but for performance we just use upsert
        results.updated++; 
      } catch (e: any) {
        results.errors.push({ customer: c, error: e.message });
      }
    }
    
    return results;
  }
}
