import { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../../middleware/auth';
import { prisma } from '@dineiz/db';
import { z } from 'zod';
import crypto from 'crypto';
import { upstash } from '../../lib/redis';

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

    let isLockedOut: unknown = null;
    try {
      isLockedOut = await upstash.get(lockoutKey);
    } catch (err: any) {
      request.log?.warn?.({ err: err?.message }, '[pin-login] Redis lockout check error, proceeding');
    }

    if (isLockedOut) {
      let ttl = 60;
      try {
        const remaining = await upstash.ttl(lockoutKey);
        if (typeof remaining === 'number' && remaining > 0) ttl = remaining;
      } catch {}
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
      let attempts = 1;
      try {
        attempts = await upstash.incr(attemptsKey);
        if (attempts === 1) {
          await upstash.expire(attemptsKey, 300); // 5 minutes window
        }

        if (attempts >= 5) {
          await upstash.set(lockoutKey, '1', { ex: 60 }); // Lock out for 60 seconds
          await upstash.del(attemptsKey);
          return reply.status(429).send({ error: 'Too many failed attempts. Try again later.', retryAfter: 60 });
        }
      } catch (err: any) {
        request.log?.warn?.({ err: err?.message }, '[pin-login] Redis attempt tracking error');
      }

      return reply.status(401).send({ error: 'Invalid PIN', attemptsLeft: Math.max(0, 5 - attempts) });
    }

    // Reset attempts on success
    try {
      await upstash.del(attemptsKey);
    } catch {}

    // Fetch tenant branding (including dual-tax config)
    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId! },
      select: { name: true, colorPrimary: true, logoUrl: true, settings: true }
    });

    // Branch-level operational config — previously never reached the
    // terminal at all, so every branch silently behaved like a PKR/Asia
    // Karachi branch with only the tenant-wide Kitchen toggle in effect.
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: {
        currency: true,
        timezone: true,
        kdsEnabled: true,
        kotAutoPrint: true,
        openingTime: true,
        closingTime: true,
      }
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
        // Receipt rendering fields — print.service.ts on the POS already
        // reads these (logo gate, paper size, layout, PDF-vs-printer mode,
        // "powered by" footer); previously omitted here, so a freshly
        // logged-in terminal fell back to receipt defaults until a live
        // tenant:branding_updated socket event happened to arrive later.
        showLogoOnReceipt: true,
        receiptPaperSize: true,
        receiptLayout: true,
        downloadPdfReceipt: true,
        showPoweredBy: true,
        // Part 13 operational settings — the POS Settings screen shows these
        // read-only; the sync engine, close flow and jobs read them live.
        orderNumberFormat: true, tenantShortCode: true, tableCleaningMinutes: true,
        requireShiftOpen: true, allowLoginWithoutShift: true,
        allowOrderReopen: true, orderReopenWindowMinutes: true,
        maxDiscountPercent: true, allowCashierDiscounts: true,
        voidRequiresManagerApproval: true, autoKotPrint: true, autoReceiptPrint: true,
        blockOutOfStock: true, kotEnabled: true, posMarkReadyEnabled: true,
        staleShiftWarnHours: true, autoCloseAbandonedHours: true,
        cashCountRequired: true, varianceAlertThreshold: true,
        managerOverlayEnabled: true, managerOverlayIdleMinutes: true, managerOverlayRequireReason: true,
        syncBatchSize: true, syncRequestTimeoutMs: true, syncMaxEventLifetimeHours: true,
        shiftCloseSyncTimeoutSec: true, allowCloseWithUnsynced: true, closeWithUnsyncedRequiresPin: true,
      }
    });
    const tb = tenantBranding as any;

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
      // Receipt rendering config — print.service.ts reads these directly;
      // without them a fresh login silently fell back to 80mm/CLASSIC/PDF
      // defaults and never showed the tenant's logo until a live socket
      // update happened to arrive.
      showLogoOnReceipt: tenantBranding?.showLogoOnReceipt ?? true,
      receiptPaperSize: tenantBranding?.receiptPaperSize ?? '80mm',
      receiptLayout: tenantBranding?.receiptLayout ?? 'CLASSIC',
      downloadPdfReceipt: tenantBranding?.downloadPdfReceipt ?? false,
      showPoweredBy: tenantBranding?.showPoweredBy ?? true,
      // Branch-level operational config — this branch's own currency/timezone
      // and KDS/auto-print hardware presence, previously never sent to the
      // terminal at all (it silently assumed PKR/Asia-Karachi and only the
      // tenant-wide Kitchen tab for every branch).
      currency: branch?.currency ?? 'PKR',
      timezone: branch?.timezone ?? 'Asia/Karachi',
      branchKdsEnabled: branch?.kdsEnabled ?? false,
      branchKotAutoPrint: branch?.kotAutoPrint ?? false,
      openingTime: branch?.openingTime ?? null,
      closingTime: branch?.closingTime ?? null,
      // Tenant-wide POS/Kitchen settings blob (Settings → Point of Sale /
      // Kitchen tabs) — same gap: configurable in the admin UI, never read
      // by the terminal. The structured Part 13 TenantBranding columns are
      // layered on top so the POS Settings screen and the sync engine see
      // the authoritative values.
      pos: {
        ...((tenant?.settings as any)?.pos ?? {}),
        orderNumberFormat: tb?.orderNumberFormat ?? 'STANDARD',
        tenantShortCode: tb?.tenantShortCode ?? null,
        tableCleaningMinutes: tb?.tableCleaningMinutes ?? 5,
        requireShiftOpen: tb?.requireShiftOpen ?? true,
        requireShiftOpening: tb?.requireShiftOpen ?? true, // POSLayout reads this alias
        allowLoginWithoutShift: tb?.allowLoginWithoutShift ?? false,
        allowOrderReopen: tb?.allowOrderReopen ?? false,
        orderReopenWindowMinutes: tb?.orderReopenWindowMinutes ?? 30,
        maxDiscountPercent: tb?.maxDiscountPercent ?? 0,
        allowCashierDiscounts: tb?.allowCashierDiscounts ?? false,
        voidRequiresManagerApproval: tb?.voidRequiresManagerApproval ?? true,
        autoKotPrint: tb?.autoKotPrint ?? true,
        autoReceiptPrint: tb?.autoReceiptPrint ?? true,
        blockOutOfStock: tb?.blockOutOfStock ?? true,
        kotEnabled: tb?.kotEnabled ?? true,
        posMarkReadyEnabled: tb?.posMarkReadyEnabled ?? true,
        staleShiftWarnHours: tb?.staleShiftWarnHours ?? 16,
        autoCloseAbandonedHours: tb?.autoCloseAbandonedHours ?? 24,
        cashCountRequired: tb?.cashCountRequired ?? true,
        varianceAlertThreshold: tb?.varianceAlertThreshold ?? 500,
        managerOverlayEnabled: tb?.managerOverlayEnabled ?? true,
        managerOverlayIdleMinutes: tb?.managerOverlayIdleMinutes ?? 5,
        managerOverlayRequireReason: tb?.managerOverlayRequireReason ?? true,
        syncBatchSize: tb?.syncBatchSize ?? 50,
        syncRequestTimeoutMs: tb?.syncRequestTimeoutMs ?? 8000,
        syncMaxEventLifetimeHours: tb?.syncMaxEventLifetimeHours ?? 24,
        shiftCloseSyncTimeoutSec: tb?.shiftCloseSyncTimeoutSec ?? 45,
        allowCloseWithUnsynced: tb?.allowCloseWithUnsynced ?? true,
        closeWithUnsyncedRequiresPin: tb?.closeWithUnsyncedRequiresPin ?? true,
      },
      // Also flat, so print.service / branding-store consumers that read
      // b.orderNumberFormat directly keep working.
      orderNumberFormat: tb?.orderNumberFormat ?? 'STANDARD',
      tenantShortCode: tb?.tenantShortCode ?? null,
      tableCleaningMinutes: tb?.tableCleaningMinutes ?? 5,
      kitchen: (tenant?.settings as any)?.kitchen ?? {},
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
    
    const newHashedPin = hashPin(pin);

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
