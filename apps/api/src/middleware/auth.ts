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
      }
    }
  }

  if (!sessionData || !sessionData.user) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  // Fetch the full user record from Prisma so custom fields (tenantId,
  // branchId, role, posPin) are always available — regardless of whether
  // Better Auth's additionalFields has surfaced them yet.
  try {
    const fullUser = await prisma.user.findUnique({
      where: { id: sessionData.user.id },
    });

    if (!fullUser) {
      return reply.status(401).send({ error: 'Unauthorized: user not found' });
    }

    if (fullUser.role === 'BRANCH_MANAGER' && !fullUser.branchId) {
      return reply.status(403).send({ error: 'No branch assigned to this manager' });
    }

    request.user = fullUser;
    request.session = sessionData.session as unknown as Session;
    request.scopedBranchId = fullUser.role === 'BRANCH_MANAGER' ? fullUser.branchId : null;
  } catch (err: any) {
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
