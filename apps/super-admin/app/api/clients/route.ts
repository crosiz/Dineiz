import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma, Role, UserStatus } from '@dineiz/db';
import { getCurrentSuperAdmin, hashPassword } from '@/lib/auth';
import { logAuditAction } from '@/lib/audit';
import { Resend } from 'resend';
import { welcomeEmail } from '@dineiz/email';
import { getPlanDefinition } from '@dineiz/schemas';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key_for_dev');

async function makeUniqueBranchCode(tx: any, city?: string | null): Promise<string> {
  const prefix = (city || 'LHR').replace(/[^A-Za-z]/g, '').substring(0, 3).toUpperCase() || 'LHR';
  for (let attempt = 0; attempt < 5; attempt++) {
    const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
    const code = `SS-${prefix}-${rand}`;
    const existing = await tx.branch.findUnique({ where: { branchCode: code } });
    if (!existing) return code;
  }
  // Extremely unlikely fallback: timestamp suffix guarantees uniqueness
  return `SS-${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

export async function GET(request: NextRequest) {
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
      if (!mrr && sub?.plan) {
        mrr = getPlanDefinition(sub.plan).monthlyPrice || 0;
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
      branches: requestedBranches,
      city = 'Lahore',
      notes,
    } = body as {
      name: string; ownerName: string; ownerEmail: string; ownerPhone?: string; password: string;
      plan?: string; billingCycle?: string; trialDays?: number; trialEndsAt?: string;
      branches?: { name: string; city?: string; address?: string }[];
      city?: string; notes?: string;
    };

    if (!name || !ownerName || !ownerEmail || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const planDef = getPlanDefinition(plan);
    if (requestedBranches && requestedBranches.length > 0 && planDef.limits.maxBranches !== -1 && requestedBranches.length > planDef.limits.maxBranches) {
      return NextResponse.json({
        error: `The ${planDef.name} plan allows up to ${planDef.limits.maxBranches} branches. You listed ${requestedBranches.length}.`,
      }, { status: 400 });
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

    // Default plan amount in PKR, from the canonical plan definition
    const planAmount = billingCycle === 'ANNUAL' ? (planDef.annualPrice ?? 0) : (planDef.monthlyPrice ?? 0);

    // Transaction to create Tenant, User, Subscription, Branding (and optional branches only if requested)
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

      // Default: exactly one "Main Branch". Only create a named, multi-location
      // list when the super admin explicitly provided one (chain onboarding) —
      // a plan's branch count is a ceiling, never an instruction to pre-create rows.
      const branchesToCreate = requestedBranches && requestedBranches.length > 0
        ? requestedBranches
        : [{ name: 'Main Branch', city, address: undefined }];

      const branches = [];
      const branchAccessCodes: { branchName: string; code: string }[] = [];

      for (const b of branchesToCreate) {
        const branchCity = (b.city || city).trim();
        const branchCode = await makeUniqueBranchCode(tx, branchCity);
        const branch = await tx.branch.create({
          data: {
            tenantId: tenant.id,
            name: b.name.trim(),
            city: branchCity,
            address: b.address?.trim() || null,
            branchCode,
            currency: 'PKR',
            isActive: true,
          },
        });
        branches.push(branch);
        branchAccessCodes.push({ branchName: branch.name, code: branchCode });
      }

      // Create Tenant Admin User (branchId is null for organization owner)
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          branchId: branches[0]?.id || null,
          name: ownerName.trim(),
          email: cleanEmail,
          password: hashedPassword,
          phone: cleanPhone,
          role: Role.TENANT_ADMIN,
          status: UserStatus.ACTIVE,
        },
      });

      // Create Subscription — maxBranches/maxStaff are a ceiling from the plan,
      // never an instruction to pre-create rows (see branch creation above).
      const subscription = await tx.tenantSubscription.create({
        data: {
          tenantId: tenant.id,
          plan,
          billingCycle,
          status: Number(trialDays) > 0 ? 'TRIALING' : 'ACTIVE',
          amount: planAmount,
          trialDays: Number(trialDays),
          trialStartedAt: new Date(),
          trialEndsAt: Number(trialDays) > 0 ? trialEndDate : null,
          currentPeriodStart: new Date(),
          currentPeriodEnd: trialEndDate,
          nextRenewalDate: trialEndDate,
          maxBranches: planDef.limits.maxBranches,
          maxStaff: planDef.limits.maxStaff,
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
        branchesCount: result.branches.length,
      },
      ipAddress,
      notes: `Created new client ${result.tenant.name} (${result.subscription.plan})`,
    });

    // Send Welcome Email via Resend (async failure non-blocking)
    const hostHeader = request.headers.get('host') || '';
    const isLocal = hostHeader.includes('localhost') || hostHeader.includes('127.0.0.1');
    const loginUrl = isLocal ? 'http://localhost:3000/login' : 'https://console.dineiz.com';

    try {
      const email = welcomeEmail({
        ownerName: ownerName.trim(),
        restaurantName: name.trim(),
        email: cleanEmail,
        password,
        plan: result.subscription.plan,
        trialEndsAt: result.subscription.trialEndsAt ? result.subscription.trialEndsAt.toDateString() : undefined,
        branchCodes: result.branchAccessCodes,
      });

      let sendStatus: 'SENT' | 'FAILED' = 'SENT';
      let providerMessageId: string | undefined;
      let errorMessage: string | undefined;

      if (process.env.RESEND_API_KEY) {
        try {
          const sendResult = await resend.emails.send({
            from: 'Dineiz Onboarding <welcome@dineiz.com>',
            to: cleanEmail,
            subject: email.subject,
            html: email.html,
            text: email.text,
          });
          providerMessageId = sendResult.data?.id;
        } catch (sendErr: any) {
          sendStatus = 'FAILED';
          errorMessage = sendErr?.message || String(sendErr);
        }
      } else {
        sendStatus = 'FAILED';
        errorMessage = 'RESEND_API_KEY not configured';
      }

      await prisma.emailLog.create({
        data: {
          tenantId: result.tenant.id,
          recipientEmail: cleanEmail,
          template: 'WELCOME',
          subject: email.subject,
          status: sendStatus,
          providerMessageId,
          errorMessage,
          attempts: 1,
          sentAt: sendStatus === 'SENT' ? new Date() : null,
        },
      });
    } catch (emailErr) {
      console.warn('Welcome email failed:', emailErr);
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
