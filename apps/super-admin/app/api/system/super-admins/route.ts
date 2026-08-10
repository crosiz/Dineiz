import { NextResponse } from 'next';
import { prisma, SuperAdminRole } from '@dineiz/db';
import { getCurrentSuperAdmin, hashPassword } from '@/lib/auth';
import { logAuditAction } from '@/lib/audit';

export async function GET() {
  try {
    const admin = await getCurrentSuperAdmin();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (admin.role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden: Only OWNER can view super admin accounts' }, { status: 403 });
    }

    const superAdmins = await prisma.superAdmin.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ superAdmins });
  } catch (error: any) {
    console.error('Fetch super admins error:', error);
    return NextResponse.json({ error: 'Failed to fetch super admins' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await getCurrentSuperAdmin();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (admin.role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden: Only OWNER can create super admins' }, { status: 403 });
    }

    const { name, email, password, role = 'SUPPORT' } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const existing = await prisma.superAdmin.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existing) {
      return NextResponse.json({ error: 'Super Admin with this email already exists' }, { status: 409 });
    }

    const hashedPassword = await hashPassword(password);

    const newAdmin = await prisma.superAdmin.create({
      data: {
        name,
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        role: role as SuperAdminRole,
        isActive: true,
      },
    });

    const ipAddress = request.headers.get('x-forwarded-for') || '127.0.0.1';
    await logAuditAction({
      superAdminId: admin.id,
      action: 'SUPER_ADMIN_CREATED',
      after: { id: newAdmin.id, email: newAdmin.email, role: newAdmin.role },
      ipAddress,
      notes: `Created super admin account ${newAdmin.email} (${newAdmin.role})`,
    });

    return NextResponse.json({
      success: true,
      superAdmin: {
        id: newAdmin.id,
        name: newAdmin.name,
        email: newAdmin.email,
        role: newAdmin.role,
        isActive: newAdmin.isActive,
      },
    });
  } catch (error: any) {
    console.error('Create super admin error:', error);
    return NextResponse.json({ error: 'Failed to create super admin' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await getCurrentSuperAdmin();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (admin.role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden: Only OWNER can update super admins' }, { status: 403 });
    }

    const { superAdminId, isActive, role } = await request.json();

    if (!superAdminId) {
      return NextResponse.json({ error: 'Super Admin ID is required' }, { status: 400 });
    }

    const targetAdmin = await prisma.superAdmin.findUnique({ where: { id: superAdminId } });
    if (!targetAdmin) {
      return NextResponse.json({ error: 'Super Admin not found' }, { status: 404 });
    }

    // Prevent self-deactivation of owner
    if (targetAdmin.id === admin.id && isActive === false) {
      return NextResponse.json({ error: 'Cannot deactivate your own active session' }, { status: 400 });
    }

    const updateData: any = {};
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    if (role) updateData.role = role as SuperAdminRole;

    const updated = await prisma.superAdmin.update({
      where: { id: superAdminId },
      data: updateData,
    });

    const ipAddress = request.headers.get('x-forwarded-for') || '127.0.0.1';
    await logAuditAction({
      superAdminId: admin.id,
      action: 'SUPER_ADMIN_UPDATED',
      before: { isActive: targetAdmin.isActive, role: targetAdmin.role },
      after: { isActive: updated.isActive, role: updated.role },
      ipAddress,
      notes: `Updated super admin ${updated.email} status: active=${updated.isActive}, role=${updated.role}`,
    });

    return NextResponse.json({ success: true, superAdmin: updated });
  } catch (error: any) {
    console.error('Update super admin error:', error);
    return NextResponse.json({ error: 'Failed to update super admin' }, { status: 500 });
  }
}
