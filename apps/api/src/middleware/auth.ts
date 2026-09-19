import { auth } from '../lib/auth';
import { prisma } from '@dineiz/db';
import { fromNodeHeaders } from 'better-auth/node';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { User, Session } from '@dineiz/db';

declare module 'fastify' {
  interface FastifyRequest {
    user?: User;
    session?: Session;
    scopedBranchId?: string | null;
  }
}

// PIN sessions (pin-login) last 12 hours from the PIN. A POS terminal is used
// all day and left on overnight, so its session used to lapse mid-shift: every
// sync attempt from then on was refused and the terminal's payments sat in its
// queue, unseen by the server and the dashboard, until someone happened to
// enter a PIN again. A session in use now slides: once it has under 6 hours
// left, each request moves its expiry to 12 hours from now, up to 7 days after
// the PIN was entered (the same window lib/offline-auth.ts allows offline).
// One write per session every ~6 hours at most. An idle terminal still expires.
const SLIDE_WHEN_LEFT_MS = 6 * 60 * 60 * 1000;
const PIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const PIN_SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

async function slidePinSession(s: { id: string; createdAt: Date; expiresAt: Date }): Promise<Date> {
  const now = Date.now();
  if (s.expiresAt.getTime() - now > SLIDE_WHEN_LEFT_MS) return s.expiresAt;
  const next = new Date(Math.min(now + PIN_SESSION_TTL_MS, s.createdAt.getTime() + PIN_SESSION_MAX_AGE_MS));
  if (next <= s.expiresAt) return s.expiresAt;
  try {
    await prisma.session.update({ where: { id: s.id }, data: { expiresAt: next } });
    return next;
  } catch {
    return s.expiresAt;
  }
}

/**
 * Resolves the authenticated user for a request.
 *
 * Better Auth's session cookie carries the core user (email, name, id).
 * Custom fields (tenantId, branchId, role) are added via `additionalFields`
 * in auth.ts, but as a safety net we also fetch the full Prisma row so
 * middleware can always rely on those fields being present.
 */
export const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
  let sessionData = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });

  // Fallback: If Better Auth fails to parse or find the session (e.g. because it was manually
  // inserted by pin-login without populating Redis), manually extract the cookie or Bearer token and check Prisma.
  if (!sessionData || !sessionData.user) {
    let token: string | undefined;

    // 1. Try Bearer token
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    // 2. Try Cookie
    if (!token && request.headers.cookie) {
      const match = request.headers.cookie.match(/better-auth\.session_token=([^;]+)/);
      if (match && match[1]) token = match[1];
    }

    if (token) {
      const dbSession = await prisma.session.findFirst({
        where: { token },
        include: { user: true }
      });
      if (dbSession && dbSession.user && dbSession.expiresAt > new Date()) {
        sessionData = {
          session: dbSession as any,
          user: dbSession.user as any
        };
        reply.header('X-Session-Expires-At', (await slidePinSession(dbSession)).toISOString());
      }
    }
  }

  if (!sessionData || !sessionData.user) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  // additionalFields in lib/auth.ts (tenantId, branchId, role, posPin) means
  // Better Auth's own session resolution already queries the User row and
  // surfaces these fields most of the time — re-fetching the full user again
  // unconditionally here duplicated that DB round-trip on every single
  // authenticated request across the whole API. Only pay for a second fetch
  // when those fields are genuinely absent from the session (the actual
  // "hasn't surfaced yet" case this was guarding against), not on every call.
  const sessionUser = sessionData.user as any;
  const hasCoreFields = 'tenantId' in sessionUser && 'role' in sessionUser;

  try {
    const fullUser: User = hasCoreFields
      ? (sessionUser as User)
      : await (async () => {
          const u = await prisma.user.findUnique({ where: { id: sessionUser.id } });
          if (!u) throw new Error('USER_NOT_FOUND');
          return u;
        })();

    if (fullUser.role === 'BRANCH_MANAGER' && !fullUser.branchId) {
      return reply.status(403).send({ error: 'No branch assigned to this manager' });
    }

    request.user = fullUser;
    request.session = sessionData.session as unknown as Session;
    request.scopedBranchId = fullUser.role === 'BRANCH_MANAGER' ? fullUser.branchId : null;
  } catch (err: any) {
    if (err?.message === 'USER_NOT_FOUND') {
      return reply.status(401).send({ error: 'Unauthorized: user not found' });
    }
    request.log?.error?.({ err }, 'requireAuth: DB lookup failed');
    return reply.status(500).send({ error: 'Auth error: failed to load user', details: err?.message });
  }
};

export const requireRole = (roles: string[]) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await requireAuth(request, reply);

    // If requireAuth sent a reply (401), stop execution
    if (reply.sent) return;

    if (!request.user || !roles.includes(request.user.role)) {
      console.error(`[auth] 403 Forbidden on ${request.method} ${request.url}. User role: ${request.user?.role}, Required: ${roles.join(', ')}`);
      return reply.status(403).send({ error: 'Forbidden: Insufficient permissions' });
    }
  };
};

export const requireTenant = async (request: FastifyRequest, reply: FastifyReply) => {
  await requireAuth(request, reply);

  if (reply.sent) return;

  if (!request.user?.tenantId) {
    return reply.status(403).send({ error: 'Forbidden: No tenant assigned' });
  }
};
