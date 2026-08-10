import { NextResponse } from 'next';
import { prisma, Role } from '@dineiz/db';
import { getCurrentSuperAdmin } from '@/lib/auth';
import { logAuditAction } from '@/lib/audit';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const admin = await getCurrentSuperAdmin();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { tenantId } = await params;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        subscription: true,
        branding: true,
        branches: {
          include: {
            tables: { select: { id: true } },
          },
        },
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            status: true,
            createdAt: true,
          },
        },
        featureOverrides: true,
        _count: {
          select: { orders: true, users: true, branches: true },
        },
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Revenue and order stats
    const totalOrdersCount = tenant._count.orders;

    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const monthOrdersCount = await prisma.order.count({
      where: {
        tenantId,
        createdAt: { gte: startOfMonth },
      },
    });

    const totalRevenueAggregate = await prisma.order.aggregate({
      where: { tenantId, status: 'COMPLETED' },
      _sum: { total: true },
    });

    const monthRevenueAggregate = await prisma.order.aggregate({
      where: {
        tenantId,
        status: 'COMPLETED',
        createdAt: { gte: startOfMonth },
      },
      _sum: { total: true },
    });

    // Recent 10 orders across branches
    const recentOrders = await prisma.order.findMany({
      where: { tenantId },
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orderNumber: true,
        total: true,
        paymentMethod: true,
        status: true,
        createdAt: true,
        table: { select: { name: true, tableNumber: true } },
        branch: { select: { name: true } },
      },
    });

    // Owner user
    const owner = tenant.users.find((u) => u.role === Role.TENANT_ADMIN) || tenant.users[0];

    return NextResponse.json({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        domain: tenant.domain,
        logoUrl: tenant.logoUrl,
        colorPrimary: tenant.colorPrimary,
        status: tenant.status,
        notes: tenant.notes,
        createdAt: tenant.createdAt.toISOString(),
        owner: owner
          ? {
              id: owner.id,
              name: owner.name,
              email: owner.email,
              phone: owner.phone,
            }
          : null,
        subscription: tenant.subscription
          ? {
              id: tenant.subscription.id,
              plan: tenant.subscription.plan,
              billingCycle: tenant.subscription.billingCycle,
              status: tenant.subscription.status,
              amount: tenant.subscription.amount,
              trialDays: tenant.subscription.trialDays,
              trialEndsAt: tenant.subscription.trialEndsAt
                ? tenant.subscription.trialEndsAt.toISOString()
                : null,
              currentPeriodStart: tenant.subscription.currentPeriodStart.toISOString(),
              currentPeriodEnd: tenant.subscription.currentPeriodEnd.toISOString(),
              nextRenewalDate: tenant.subscription.nextRenewalDate.toISOString(),
            }
          : null,
        stats: {
          totalOrdersAllTime: totalOrdersCount,
          ordersThisMonth: monthOrdersCount,
          totalRevenueAllTime: totalRevenueAggregate._sum.total || 0,
          revenueThisMonth: monthRevenueAggregate._sum.total || 0,
          activeBranchesCount: tenant.branches.filter((b) => b.isActive).length,
          totalStaffCount: tenant.users.length,
        },
        branches: tenant.branches.map((b) => ({
          id: b.id,
          name: b.name,
          branchCode: b.branchCode,
          city: b.city,
          tableCount: b.tables.length,
          isActive: b.isActive,
          todayOrders: 0, // Placeholder populated via real-time query
          todayRevenue: 0,
        })),
        recentOrders: recentOrders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          total: o.total,
          paymentMethod: o.paymentMethod || 'CASH',
          status: o.status,
          time: o.createdAt.toISOString(),
          branchName: o.branch.name,
          tableName: o.table ? `Table ${o.table.tableNumber || o.table.name}` : 'Takeaway / Delivery',
        })),
        featureOverrides: tenant.featureOverrides.map((fo) => ({
          featureKey: fo.featureKey,
          enabled: fo.enabled,
        })),
      },
    });
  } catch (error: any) {
    console.error('Fetch Client Detail Error:', error);
    return NextResponse.json({ error: 'Failed to fetch client detail' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const admin = await getCurrentSuperAdmin();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { tenantId } = await params;
    const body = await request.json();
    const { status, notes, branchToggleId, branchIsActive } = body;

    const existingTenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { subscription: true },
    });

    if (!existingTenant) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Branch active status toggle
    if (branchToggleId !== undefined) {
      await prisma.branch.update({
        where: { id: branchToggleId },
        data: { isActive: Boolean(branchIsActive) },
      });
      return NextResponse.json({ success: true, message: 'Branch status updated' });
    }

    // Tenant status / notes update
    const updateData: any = {};
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;

    const updatedTenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: updateData,
    });

    // Sync subscription status if suspending / reactivating
    if (status === 'SUSPENDED') {
      await prisma.tenantSubscription.updateMany({
        where: { tenantId },
        data: { status: 'CANCELLED' },
      });
    } else if (status === 'ACTIVE' && existingTenant.status === 'SUSPENDED') {
      await prisma.tenantSubscription.updateMany({
        where: { tenantId },
        data: { status: 'ACTIVE' },
      });
    }

    const ipAddress = request.headers.get('x-forwarded-for') || '127.0.0.1';
    await logAuditAction({
      superAdminId: admin.id,
      action: status === 'SUSPENDED' ? 'ACCOUNT_SUSPENDED' : 'ACCOUNT_UPDATED',
      targetTenantId: tenantId,
      before: { status: existingTenant.status, notes: existingTenant.notes },
      after: { status: updatedTenant.status, notes: updatedTenant.notes },
      ipAddress,
      notes: `Updated tenant status to ${updatedTenant.status}`,
    });

    return NextResponse.json({ success: true, tenant: updatedTenant });
  } catch (error: any) {
    console.error('Update Client Error:', error);
    return NextResponse.json({ error: 'Failed to update client' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const admin = await getCurrentSuperAdmin();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // RBAC check: Only OWNER can delete tenants
    if (admin.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'Forbidden: Only super admins with OWNER role can delete clients' },
        { status: 403 }
      );
    }

    const { tenantId } = await params;
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });

    if (!tenant) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    await prisma.tenant.delete({ where: { id: tenantId } });

    const ipAddress = request.headers.get('x-forwarded-for') || '127.0.0.1';
    await logAuditAction({
      superAdminId: admin.id,
      action: 'TENANT_DELETED',
      targetTenantId: tenantId,
      before: { name: tenant.name, domain: tenant.domain },
      ipAddress,
      notes: `Deleted tenant ${tenant.name} (${tenant.id})`,
    });

    return NextResponse.json({ success: true, message: 'Client deleted successfully' });
  } catch (error: any) {
    console.error('Delete Client Error:', error);
    return NextResponse.json({ error: 'Failed to delete client' }, { status: 500 });
  }
}
