import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { prisma } from '@dineiz/pos-portal-db';

const PIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000; // a shift length
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60 * 1000;

const PinLoginSchema = z.object({
  userId: z.string(),
  pin: z.string().min(4).max(6),
});

export const pinRoutes: FastifyPluginAsync = async (fastify) => {
  // Who to show on the lock screen / staff grid before a PIN is entered —
  // deliberately excludes posPinHash.
  fastify.get('/api/auth/pin-candidates', async (request, reply) => {
    const { branchId } = request.query as { branchId?: string };
    if (!branchId) return reply.status(400).send({ error: 'branchId is required' });

    const users = await prisma.user.findMany({
      where: { branchId, active: true },
      select: { id: true, name: true, role: true, avatarBg: true, avatarFg: true },
    });
    return users;
  });

  fastify.post('/api/auth/pin-login', async (request, reply) => {
    const parsed = PinLoginSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid request', issues: parsed.error.issues });
    const { userId, pin } = parsed.data;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.posPinHash) return reply.status(401).send({ error: 'Invalid PIN' });

    if (user.pinLockedUntil && user.pinLockedUntil > new Date()) {
      const secondsLeft = Math.ceil((user.pinLockedUntil.getTime() - Date.now()) / 1000);
      return reply.status(429).send({ error: `Too many attempts. Try again in ${secondsLeft}s.` });
    }

    const valid = await bcrypt.compare(pin, user.posPinHash);
    if (!valid) {
      const attempts = user.pinFailedAttempts + 1;
      const lockedUntil = attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MS) : null;
      await prisma.user.update({
        where: { id: user.id },
        data: { pinFailedAttempts: lockedUntil ? 0 : attempts, pinLockedUntil: lockedUntil },
      });
      return reply.status(401).send({ error: 'Invalid PIN' });
    }

    await prisma.user.update({ where: { id: user.id }, data: { pinFailedAttempts: 0, pinLockedUntil: null } });

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + PIN_SESSION_TTL_MS);
    await prisma.session.create({ data: { userId: user.id, token, expiresAt } });

    reply.header(
      'set-cookie',
      `better-auth.session_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${PIN_SESSION_TTL_MS / 1000}`
    );
    return reply.send({ user: { id: user.id, name: user.name, role: user.role, branchId: user.branchId } });
  });
};
