import { NextResponse } from 'next';
import crypto from 'crypto';
import { prisma, Role, UserStatus } from '@dineiz/db';
import { getCurrentSuperAdmin, hashPassword } from '@/lib/auth';
import { logAuditAction } from '@/lib/audit';
import { Resend } from 'resend';
import { generateWelcomeEmailHtml } from '@/lib/email-templates';

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key_for_dev');

function makeBranchCode(city?: string | null): string {
  const prefix = (city || 'LHR').replace(/[^A-Za-z]/g, '').substring(0, 3).toUpperCase() || 'LHR';
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `SS-${prefix}-${rand}`;
}

export async function GET(request: Request) {
  try {
    const admin = await getCurrentSuperAdmin();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const planFilter = searchParams.get('plan') || 'ALL';
    const statusFilter = searchParams.get('status') || 'ALL';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const whereClause: any = {};

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { primaryPhone: { contains: search, mode: 'insensitive' } },
        { users: { some: { email: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    if (planFilter !== 'ALL') {
      whereClause.subscription = {
        plan: planFilter,
      };
    }

    if (statusFilter !== 'ALL') {
      if (statusFilter === 'SUSPENDED') {
        whereClause.status = 'SUSPENDED';
      } else {
        whereClause.subscription = {
          ...whereClause.subscription,
          status: statusFilter,
        };
      }
    }

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = new Date(startDate);
      if (endDate) whereClause.createdAt.lte = new Date(endDate);
    }

    const tenants = await prisma.tenant.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        subscription: true,
        branches: {
          select: { id: true, name: true, city: true, branchCode: true, isActive: true },
        },
        users: {
          where: { role: Role.TENANT_ADMIN },
          select: { id: true, name: true, email: true, phone: true },
        },
        _count: {
          select: { orders: true, branches: true },
        },
      },
    });

    // Format clients for table view
    const formattedClients = tenants.map((t) => {
      const owner = t.users?.[0] || { name: 'N/A', email: 'N/A', phone: 'N/A' };
      const sub = t.subscription;

      let mrr = sub?.amount || 0;
      if (!mrr) {
        if (sub?.plan === 'PRO') mrr = 15000;
        else if (sub?.plan === 'STARTER') mrr = 8000;
        else if (sub?.plan === 'ENTERPRISE') mrr = 35000;
        else if (sub?.plan === 'PRO_GO') mrr = 12000;
      }

      return {
        id: t.id,
        name: t.name,
        ownerName: owner.name || 'N/A',
        ownerEmail: owner.email || 'N/A',
        ownerPhone: owner.phone || t.primaryPhone || 'N/A',
        plan: sub?.plan || t.plan || 'STARTER',
        status: t.status === 'SUSPENDED' ? 'SUSPENDED' : (sub?.status || t.status || 'ACTIVE'),
        branchesCount: t._count?.branches ?? (t.branches?.length || 0),
        ordersThisMonth: t._count?.orders ?? 0,
        mrr: mrr,
        billingCycle: sub?.billingCycle || 'MONTHLY',
        joinedDate: t.createdAt ? new Date(t.createdAt).toISOString() : new Date().toISOString(),
        renewalDate: sub?.nextRenewalDate ? new Date(sub.nextRenewalDate).toISOString() : null,
        city: t.branches?.[0]?.city || 'Lahore',
      };
    });

    return NextResponse.json({ clients: formattedClients });
  } catch (error: any) {
    console.error('Clients API error:', error);
    return NextResponse.json({
      error: error?.message || 'Failed to fetch clients',
      details: error?.stack || String(error),
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await getCurrentSuperAdmin();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const {
      name,
      ownerName,
      ownerEmail,
      ownerPhone,
      password,
      plan = 'STARTER',
      billingCycle = 'MONTHLY',
      trialDays = 14,
      trialEndsAt: customTrialEndsAt,
      branchesCount = 1,
      city = 'Lahore',
      notes,
    } = body;

    if (!name || !ownerName || !ownerEmail || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const cleanEmail = ownerEmail.toLowerCase().trim();
    const cleanPhone = ownerPhone?.trim() ? ownerPhone.trim() : null;

    // Check unique email
    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
      include: {
        tenant: { select: { name: true } },
      },
    });

    if (existingUser) {
      const restaurantName = existingUser.tenant?.name ? `"${existingUser.tenant.name}"` : 'an existing organization';
      const roleDisplay = existingUser.role.replace(/_/g, ' ');
      return NextResponse.json(
        {
          error: `Email "${cleanEmail}" is already linked to staff member "${existingUser.name}" (${roleDisplay}) at ${restaurantName}. Please use a different email address.`,
          field: 'email',
          conflictDetails: {
            type: 'email',
            value: cleanEmail,
            userName: existingUser.name,
            role: existingUser.role,
            restaurantName: existingUser.tenant?.name || 'N/A',
          },
        },
        { status: 409 }
      );
    }

    // Check unique phone if provided
    if (cleanPhone) {
      const existingPhone = await prisma.user.findUnique({
        where: { phone: cleanPhone },
        include: {
          tenant: { select: { name: true } },
        },
      });
      if (existingPhone) {
        const restaurantName = existingPhone.tenant?.name ? `"${existingPhone.tenant.name}"` : 'an existing organization';
        const roleDisplay = existingPhone.role.replace(/_/g, ' ');
        return NextResponse.json(
          {
            error: `Phone number "${cleanPhone}" is already linked to staff member "${existingPhone.name}" (${roleDisplay}) at ${restaurantName}. Please use a different phone number or leave it blank.`,
            field: 'phone',
            conflictDetails: {
              type: 'phone',
              value: cleanPhone,
              userName: existingPhone.name,
              role: existingPhone.role,
              restaurantName: existingPhone.tenant?.name || 'N/A',
            },
          },
          { status: 409 }
        );
      }
    }

    const hashedPassword = await hashPassword(password);

    // Compute trial end date
    let trialEndDate = new Date();
    if (customTrialEndsAt) {
      trialEndDate = new Date(customTrialEndsAt);
    } else {
      trialEndDate.setDate(trialEndDate.getDate() + Number(trialDays));
    }

    // Compute default plan amount in PKR
    let planAmount = 8000;
    if (plan === 'FREE' || plan === 'FREE_GO') planAmount = 0;
    else if (plan === 'PRO_GO') planAmount = 12000;
    else if (plan === 'STARTER') planAmount = 8000;
    else if (plan === 'PRO') planAmount = 15000;
    else if (plan === 'ENTERPRISE') planAmount = 35000;

    // Transaction to create Tenant, Branches, User, Subscription
    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: name.trim(),
          plan,
          primaryPhone: cleanPhone,
          status: Number(trialDays) > 0 ? 'TRIALING' : 'ACTIVE',
          notes: notes?.trim() || null,
        },
      });

      // Generate branches with guaranteed unique codes
      const branches = [];
      const branchAccessCodes: { branchName: string; code: string }[] = [];

      for (let i = 1; i <= Math.max(1, Number(branchesCount)); i++) {
        const branchCode = makeBranchCode(city);
        const branchName = i === 1 ? `${name.trim()} - Main Branch` : `${name.trim()} - Branch ${i}`;

        const branch = await tx.branch.create({
          data: {
            tenantId: tenant.id,
            name: branchName,
            city: city.trim(),
            branchCode,
            currency: 'PKR',
            isActive: true,
          },
        });
        branches.push(branch);
        branchAccessCodes.push({ branchName: branch.name, code: branchCode });
      }

      // Create Tenant Admin User
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          branchId: branches[0].id,
          name: ownerName.trim(),
          email: cleanEmail,
          password: hashedPassword,
          phone: cleanPhone,
          role: Role.TENANT_ADMIN,
          status: UserStatus.ACTIVE,
        },
      });

      // Create Subscription
      const subscription = await tx.tenantSubscription.create({
        data: {
          tenantId: tenant.id,
          plan,
          billingCycle,
          status: Number(trialDays) > 0 ? 'TRIALING' : 'ACTIVE',
          amount: planAmount,
          trialDays: Number(trialDays),
          trialEndsAt: Number(trialDays) > 0 ? trialEndDate : null,
          currentPeriodStart: new Date(),
          currentPeriodEnd: trialEndDate,
          nextRenewalDate: trialEndDate,
        },
      });

      // Create Branding Default
      await tx.tenantBranding.create({
        data: {
          tenantId: tenant.id,
          restaurantName: name,
          primaryColor: '#FF5722',
          currency: 'PKR',
        },
      });

      return { tenant, branches, user, subscription, branchAccessCodes };
    });

    // Audit log creation
    const ipAddress = request.headers.get('x-forwarded-for') || '127.0.0.1';
    await logAuditAction({
      superAdminId: admin.id,
      action: 'TENANT_CREATED',
      targetTenantId: result.tenant.id,
      after: {
        name: result.tenant.name,
        plan: result.subscription.plan,
        ownerEmail: result.user.email,
        branchesCount,
      },
      ipAddress,
      notes: `Created new client ${result.tenant.name} (${result.subscription.plan})`,
    });

    // Send Welcome Email via Resend (async failure non-blocking)
    const hostHeader = request.headers.get('host') || '';
    const isLocal = hostHeader.includes('localhost') || hostHeader.includes('127.0.0.1');
    const loginUrl = isLocal ? 'http://localhost:3000/login' : 'https://console.dineiz.com';

    try {
      if (process.env.RESEND_API_KEY) {
        const emailHtml = generateWelcomeEmailHtml({
          restaurantName: name.trim(),
          ownerName: ownerName.trim(),
          ownerEmail: cleanEmail,
          password,
          plan: result.subscription.plan,
          billingCycle: result.subscription.billingCycle,
          trialDays: Number(trialDays),
          trialEndsAt: result.subscription.trialEndsAt,
          branches: result.branchAccessCodes,
          loginUrl,
        });

        await resend.emails.send({
          from: 'Dineiz Onboarding <welcome@dineiz.com>',
          to: cleanEmail,
          subject: `Welcome to Dineiz — ${name.trim()} Account Credentials`,
          html: emailHtml,
        });
      }
    } catch (emailErr) {
      console.warn('Resend email failed:', emailErr);
    }

    return NextResponse.json({
      success: true,
      credentials: {
        tenantId: result.tenant.id,
        restaurantName: result.tenant.name,
        ownerName: result.user.name,
        ownerEmail: result.user.email,
        password: password,
        loginUrl: loginUrl,
        plan: result.subscription.plan,
        trialEndsAt: result.subscription.trialEndsAt,
        branches: result.branchAccessCodes,
      },
    });
  } catch (error: any) {
    console.error('Create Client Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create client' }, { status: 500 });
  }
}
