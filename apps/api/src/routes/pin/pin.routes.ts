import { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../../middleware/auth';
import { prisma } from '@swiftserve/db';
import { z } from 'zod';
import crypto from 'crypto';
import { redis } from '../../lib/redis';

/**
 * Simple SHA-256 hash for PIN storage (enough for a short numeric PIN,
 * recommend upgrading to bcrypt if stricter security is required).
 */
function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

const PinLoginSchema = z.object({
  branchId: z.string().min(1),
  staffId: z.string().min(1),
  hashedPin: z.string().min(64), // SHA-256 hash length is 64 hex chars
});

const SetPinSchema = z.object({
  userId: z.string().min(1),
  pin: z.string().min(4).max(6),
});

const GetCashiersSchema = z.object({
  branchId: z.string().min(1),
});

const GetActiveShiftsSchema = z.object({
  branchId: z.string().min(1),
});

/** Session duration: 12 hours (a typical shift length) */
const SESSION_TTL_SECONDS = 12 * 60 * 60;

export const pinRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/pos/auth/pin-login
   * Verifies a cashier's PIN using client-side hashing.
   */
  fastify.post('/api/pos/auth/pin-login', async (request, reply) => {
    const parsed = PinLoginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid body', issues: parsed.error.issues });
    }

    const { branchId, staffId, hashedPin } = parsed.data;

    const lockoutKey = `pos_pin_lockout:${staffId}`;
    const attemptsKey = `pos_pin_attempts:${staffId}`;

    const isLockedOut = await redis.get(lockoutKey);
    if (isLockedOut) {
      const ttl = await redis.ttl(lockoutKey);
      return reply.status(429).send({ error: 'Too many failed attempts. Try again later.', retryAfter: ttl });
    }

    const user = await prisma.user.findFirst({
      where: {
        id: staffId,
        branchId,
        role: { notIn: ['SUPER_ADMIN', 'CALL_CENTER_AGENT', 'READ_ONLY'] },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        tenantId: true,
        branchId: true,
        avatarColor: true,
        posPin: true,
      },
    });

    if (!user || user.posPin !== hashedPin) {
      const attempts = await redis.incr(attemptsKey);
      if (attempts === 1) {
        await redis.expire(attemptsKey, 300); // 5 minutes window
      }

      if (attempts >= 5) {
        await redis.setex(lockoutKey, 60, '1'); // Lock out for 60 seconds
        await redis.del(attemptsKey);
        return reply.status(429).send({ error: 'Too many failed attempts. Try again later.', retryAfter: 60 });
      }

      return reply.status(401).send({ error: 'Invalid PIN', attemptsLeft: 5 - attempts });
    }

    // Reset attempts on success
    await redis.del(attemptsKey);

    // Fetch tenant branding (including dual-tax config)
    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId! },
      select: { name: true, colorPrimary: true, logoUrl: true }
    });

    const tenantBranding = await prisma.tenantBranding.findUnique({
      where: { tenantId: user.tenantId! },
      select: {
        restaurantName: true,
        primaryColor: true,
        secondaryColor: true,
        accentColor: true,
        logoUrl: true,
        fbrNtn: true,
        receiptFooter: true,
        receiptHeader: true,
        showCashierName: true,
        showTableNumber: true,
        // Dual-tax fields
        cashTaxEnabled: true,
        cashTaxRate: true,
        cashTaxLabel: true,
        cardTaxEnabled: true,
        cardTaxRate: true,
        cardTaxLabel: true,
        showDualTaxOnReceipt: true,
        cashTaxNote: true,
        cardTaxNote: true,
        taxRoundingMethod: true,
        serviceChargeEnabled: true,
        serviceChargeRate: true,
      }
    });

    const branding = {
      restaurantName: tenantBranding?.restaurantName || tenant?.name || 'Dineiz Go',
      primaryColor: tenantBranding?.primaryColor || tenant?.colorPrimary || '#F59E0B',
      secondaryColor: tenantBranding?.secondaryColor || '#1A1A2E',
      accentColor: tenantBranding?.accentColor || '#FFB300',
      logoUrl: tenantBranding?.logoUrl || tenant?.logoUrl,
      fbrNtn: tenantBranding?.fbrNtn,
      receiptFooter: tenantBranding?.receiptFooter,
      receiptHeader: tenantBranding?.receiptHeader,
      showCashierName: tenantBranding?.showCashierName ?? false,
      showTableNumber: tenantBranding?.showTableNumber ?? false,
      // Dual-tax config (these travel with pos_branding into localStorage)
      cashTaxEnabled: tenantBranding?.cashTaxEnabled ?? false,
      cashTaxRate: tenantBranding?.cashTaxRate ?? 5,
      cashTaxLabel: tenantBranding?.cashTaxLabel ?? 'GST (Cash)',
      cardTaxEnabled: tenantBranding?.cardTaxEnabled ?? false,
      cardTaxRate: tenantBranding?.cardTaxRate ?? 17,
      cardTaxLabel: tenantBranding?.cardTaxLabel ?? 'GST (Card/Digital)',
      showDualTaxOnReceipt: tenantBranding?.showDualTaxOnReceipt ?? true,
      cashTaxNote: tenantBranding?.cashTaxNote ?? null,
      cardTaxNote: tenantBranding?.cardTaxNote ?? null,
      taxRoundingMethod: tenantBranding?.taxRoundingMethod ?? 'ROUND',
      serviceChargeEnabled: tenantBranding?.serviceChargeEnabled ?? false,
      serviceChargeRate: tenantBranding?.serviceChargeRate ?? 10,
    };

    // â”€â”€ Create a Better Auth-compatible session â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

    await prisma.session.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        token: sessionToken,
        expiresAt,
      },
    });

    const activeShift = await prisma.shift.findFirst({
      where: { branchId, userId: user.id, status: 'OPEN' },
      select: { id: true, openedAt: true, openingFloat: true }
    });

    const cookieValue = [
      `better-auth.session_token=${sessionToken}`,
      'Path=/',
      'HttpOnly',
      'SameSite=None',
      'Secure',
      `Max-Age=${SESSION_TTL_SECONDS}`,
    ].join('; ');

    reply.header('set-cookie', cookieValue);

    return {
      success: true,
      token: sessionToken,
      user,
      branding,
      activeShift,
    };
  });

  /**
   * POST /api/pos/set-pin
   * Admin endpoint â€” sets or updates the posPin for a specific user.
   */
  fastify.post('/api/pos/set-pin', async (request, reply) => {
    const parsed = SetPinSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid body', issues: parsed.error.issues });
    }

    const { userId, pin } = parsed.data;
    
    // For backwards compatibility and the admin panel, we keep server-side
    // hashing here if they send raw pin. But wait, if client sends raw pin, 
    // it won't match the new SHA-256(pin + staffId) salted logic.
    // So we must hash it with the staffId.
    const newHashedPin = crypto.createHash('sha256').update(pin + userId).digest('hex');

    await prisma.user.update({
      where: { id: userId },
      data: { posPin: newHashedPin },
    });

    return { success: true, message: 'PIN updated successfully' };
  });

  /**
   * GET /api/pos/staff
   * Fetch staff for a specific branch.
   */
  fastify.get('/api/pos/staff', async (request, reply) => {
    const query = request.query as { branchId?: string };
    if (!query.branchId) {
      return reply.status(400).send({ error: 'branchId is required' });
    }

    const branch = await prisma.branch.findUnique({
      where: { id: query.branchId },
      select: { name: true }
    });

    if (!branch) {
      return reply.status(404).send({ error: 'Branch not found' });
    }

    const cashiers = await prisma.user.findMany({
      where: {
        branchId: query.branchId,
        role: { notIn: ['SUPER_ADMIN', 'TENANT_ADMIN', 'CALL_CENTER_AGENT', 'READ_ONLY'] },
      },
      select: {
        id: true,
        name: true,
        role: true,
        avatarColor: true,
      },
      orderBy: {
        name: 'asc'
      }
    });

    return { success: true, staff: cashiers, branchName: branch.name };
  });

  /**
   * GET /api/pos/link
   * Verifies a POS Code and returns the branch details to link the terminal.
   */
  fastify.get('/api/pos/link', async (request, reply) => {
    const query = request.query as { code?: string };
    if (!query.code) {
      return reply.status(400).send({ error: 'code is required' });
    }

    const branch = await prisma.branch.findUnique({
      where: { branchCode: query.code },
      select: { id: true, name: true }
    });

    if (!branch) {
      return reply.status(404).send({ error: 'Invalid POS code' });
    }

    return { success: true, branchId: branch.id, branchName: branch.name };
  });

  // Keep the old route for backwards compatibility if needed, aliased to the same logic
  fastify.get('/api/pos/cashiers', async (request, reply) => {
    const query = request.query as { branchId?: string };
    if (!query.branchId) return reply.status(400).send({ error: 'branchId is required' });
    
    const cashiers = await prisma.user.findMany({
      where: { 
        branchId: query.branchId,
        role: { notIn: ['SUPER_ADMIN', 'TENANT_ADMIN', 'CALL_CENTER_AGENT', 'READ_ONLY'] }
      },
      select: { id: true, name: true, role: true, avatarColor: true },
      orderBy: { name: 'asc' }
    });
    return { success: true, cashiers };
  });

  /**
   * GET /api/pos/waiters
   * Fetch waiters for a specific branch (public for POS clients).
   */
  fastify.get('/api/pos/waiters', async (request, reply) => {
    const query = request.query as { branchId?: string };
    if (!query.branchId) {
      return reply.status(400).send({ error: 'branchId is required' });
    }

    const waiters = await prisma.user.findMany({
      where: {
        branchId: query.branchId,
        role: 'WAITER',
        status: 'ACTIVE',
      },
      select: { id: true, name: true, role: true, avatarColor: true },
      orderBy: { name: 'asc' }
    });
    return { success: true, waiters };
  });
  
  /**
   * GET /api/pos/shifts/active
   * Public endpoint to check if a branch has an active shift.
   */
  fastify.get('/api/pos/shifts/active', async (request, reply) => {
    const query = request.query as { branchId?: string };
    if (!query.branchId) {
      return reply.status(400).send({ error: 'branchId is required' });
    }

    const activeShift = await prisma.shift.findFirst({
      where: {
        branchId: query.branchId,
        status: 'OPEN',
      },
      select: { id: true }
    });

    return { success: true, hasActiveShift: !!activeShift };
  });
  /**
   * POST /api/pos/auth/validate-manager-pin
   * Validates a manager PIN for admin access
   */
  fastify.post('/api/pos/auth/validate-manager-pin', {
    onRequest: [requireAuth]
  }, async (req, reply) => {
    const { pin, branchId } = req.body as { pin: string; branchId: string }
    const { tenantId } = req.user

    const hashedPin = crypto.createHash('sha256').update(pin).digest('hex')

    // Find any manager or admin with this PIN in this branch or tenant
    const manager = await prisma.user.findFirst({
      where: {
        tenantId,
        posPin: hashedPin,
        status: 'ACTIVE',
        role: { in: ['TENANT_ADMIN', 'BRANCH_MANAGER'] }
      }
    })

    if (!manager) {
      return reply.status(401).send({ error: 'Invalid PIN' })
    }

    return reply.send({
      valid: true,
      manager: { id: manager.id, name: manager.name, role: manager.role }
    })
  })
};
